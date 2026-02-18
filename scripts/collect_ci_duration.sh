#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

CI_RUN_LIMIT="${CI_RUN_LIMIT:-20}"
WORKFLOW_NAME="${WORKFLOW_NAME:-CI}"
METRICS_DIR="${ROOT_DIR}/docs/validation/metrics"
OUTPUT_FILE="${METRICS_DIR}/ci-duration-latest.md"
GH_REPO="${GH_REPO:-}"

mkdir -p "${METRICS_DIR}"

write_blocked_report() {
  local reason="$1"
  cat > "${OUTPUT_FILE}" <<EOF
# CI Duration Snapshot

Generated at: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

## Status

Blocked: ${reason}

## Next Step

1. Install/login GitHub CLI: \`gh auth login\`
2. Ensure repository access for: \`${GH_REPO:-<owner/repo>}\`
3. Re-run: \`CI_RUN_LIMIT=${CI_RUN_LIMIT} GH_REPO=<owner/repo> ./scripts/collect_ci_duration.sh\`
EOF
  echo "Wrote ${OUTPUT_FILE} (blocked)"
}

if ! command -v gh >/dev/null 2>&1; then
  write_blocked_report "GitHub CLI (gh) is not installed."
  exit 0
fi

if ! gh auth status -h github.com >/dev/null 2>&1; then
  write_blocked_report "GitHub CLI is not authenticated."
  exit 0
fi

if ! [[ "${CI_RUN_LIMIT}" =~ ^[0-9]+$ ]] || [ "${CI_RUN_LIMIT}" -lt 1 ]; then
  echo "CI_RUN_LIMIT must be an integer >= 1" >&2
  exit 1
fi

resolve_repo_from_origin() {
  local remote_url
  local owner
  local repo
  remote_url="$(git remote get-url origin 2>/dev/null || true)"
  if [ -z "${remote_url}" ]; then
    return 1
  fi

  if [[ "${remote_url}" =~ ^git@[^:]+:([^/]+)/([^/]+)(\.git)?$ ]]; then
    owner="${BASH_REMATCH[1]}"
    repo="${BASH_REMATCH[2]}"
    repo="${repo%.git}"
    printf "%s/%s" "${owner}" "${repo}"
    return 0
  fi
  if [[ "${remote_url}" =~ ^https?://[^/]+/([^/]+)/([^/]+)(\.git)?$ ]]; then
    owner="${BASH_REMATCH[1]}"
    repo="${BASH_REMATCH[2]}"
    repo="${repo%.git}"
    printf "%s/%s" "${owner}" "${repo}"
    return 0
  fi
  return 1
}

if [ -z "${GH_REPO}" ]; then
  GH_REPO="$(resolve_repo_from_origin || true)"
fi

if [ -z "${GH_REPO}" ]; then
  write_blocked_report "Could not resolve GitHub repository from origin remote."
  exit 0
fi

TMP_JSON="$(mktemp)"
TMP_ERR="$(mktemp)"
trap 'rm -f "${TMP_JSON}" "${TMP_ERR}"' EXIT

set +e
gh run list \
  --repo "${GH_REPO}" \
  --workflow "${WORKFLOW_NAME}" \
  --limit "${CI_RUN_LIMIT}" \
  --json databaseId,displayTitle,status,conclusion,startedAt,updatedAt,url,headBranch \
  > "${TMP_JSON}" 2> "${TMP_ERR}"
gh_status=$?
set -e

if [ "${gh_status}" -ne 0 ]; then
  gh_output="$(cat "${TMP_ERR}")"
  write_blocked_report "GitHub Actions metadata query failed: ${gh_output}"
  exit 0
fi

python3 - <<'PY' "${TMP_JSON}" "${OUTPUT_FILE}" "${CI_RUN_LIMIT}"
import json
import statistics
import sys
from datetime import datetime, timezone

input_path = sys.argv[1]
output_path = sys.argv[2]
run_limit = int(sys.argv[3])

with open(input_path, "r", encoding="utf-8") as handle:
    raw_runs = json.load(handle)

def parse_ts(value: str) -> datetime:
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    return datetime.fromisoformat(value).astimezone(timezone.utc)

runs = []
for entry in raw_runs:
    started = entry.get("startedAt")
    updated = entry.get("updatedAt")
    if not started or not updated:
        continue
    start_dt = parse_ts(started)
    end_dt = parse_ts(updated)
    duration_seconds = int((end_dt - start_dt).total_seconds())
    runs.append(
        {
            "id": entry.get("databaseId"),
            "title": entry.get("displayTitle") or "(untitled)",
            "status": entry.get("status") or "unknown",
            "conclusion": entry.get("conclusion") or "n/a",
            "branch": entry.get("headBranch") or "n/a",
            "url": entry.get("url") or "",
            "duration_seconds": max(duration_seconds, 0),
        }
    )

if not runs:
    raise SystemExit("No workflow runs with duration metadata were found.")

durations = [item["duration_seconds"] for item in runs]
mean_seconds = int(statistics.mean(durations))
p50_seconds = int(statistics.median(durations))
durations_sorted = sorted(durations)
p90_index = max(0, int(len(durations_sorted) * 0.9) - 1)
p90_seconds = durations_sorted[p90_index]

def humanize(seconds: int) -> str:
    minutes = seconds / 60
    return f"{minutes:.2f} min"

with open(output_path, "w", encoding="utf-8") as out:
    out.write("# CI Duration Snapshot\n\n")
    out.write(f"Generated at: {datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')}\n\n")
    out.write("## Scorecard Signals\n\n")
    out.write("| Metric | Value | Target |\n")
    out.write("| --- | --- | --- |\n")
    out.write(f"| Sample size | {len(runs)} (requested {run_limit}) | >= 20 |\n")
    out.write(f"| Mean duration | {humanize(mean_seconds)} | < 15.00 min |\n")
    out.write(f"| Median duration (p50) | {humanize(p50_seconds)} | < 15.00 min |\n")
    out.write(f"| p90 duration | {humanize(p90_seconds)} | < 20.00 min |\n")
    out.write("\n## Recent Runs\n\n")
    out.write("| Run | Branch | Status | Conclusion | Duration | Link |\n")
    out.write("| --- | --- | --- | --- | ---: | --- |\n")
    for run in runs:
        url = run["url"]
        link = f"[open]({url})" if url else "-"
        out.write(
            f"| {run['id']} | {run['branch']} | {run['status']} | {run['conclusion']} | "
            f"{humanize(run['duration_seconds'])} | {link} |\n"
        )

print(f"Wrote {output_path}")
PY
