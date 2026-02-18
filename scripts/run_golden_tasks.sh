#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

GOLDEN_TASK_MODE="${GOLDEN_TASK_MODE:-smoke}"
MIN_SUCCESS_RATE="${MIN_SUCCESS_RATE:-0.90}"
MANIFEST_FILE="${ROOT_DIR}/docs/validation/golden-tasks/manifest.tsv"
METRICS_DIR="${ROOT_DIR}/docs/validation/metrics"
LOG_DIR="${METRICS_DIR}/golden-task-logs"
OUTPUT_FILE="${METRICS_DIR}/golden-tasks-latest.md"

if [[ "${GOLDEN_TASK_MODE}" != "smoke" && "${GOLDEN_TASK_MODE}" != "full" ]]; then
  echo "Unsupported GOLDEN_TASK_MODE=${GOLDEN_TASK_MODE}. Use smoke or full." >&2
  exit 1
fi

if [ ! -f "${MANIFEST_FILE}" ]; then
  echo "Missing manifest: ${MANIFEST_FILE}" >&2
  exit 1
fi

mkdir -p "${METRICS_DIR}" "${LOG_DIR}"

run_count=0
pass_count=0
sample_issues=0

REPORT_ROWS=()
FAIL_IDS=()

while IFS=$'\t' read -r task_id category description smoke_command full_command; do
  if [ -z "${task_id}" ] || [ "${task_id}" = "id" ]; then
    continue
  fi

  command_to_run="${smoke_command}"
  if [ "${GOLDEN_TASK_MODE}" = "full" ]; then
    command_to_run="${full_command}"
  fi

  if [ -z "${command_to_run}" ]; then
    sample_issues=$((sample_issues + 1))
    REPORT_ROWS+=("| ${task_id} | ${category} | ${description} | SKIP | missing command | - |")
    continue
  fi

  run_count=$((run_count + 1))
  log_file="${LOG_DIR}/${task_id}.log"
  start_epoch="$(date -u +%s)"

  set +e
  bash -lc "${command_to_run}" >"${log_file}" 2>&1
  rc=$?
  set -e

  end_epoch="$(date -u +%s)"
  duration="$((end_epoch - start_epoch))"

  if [ "${rc}" -eq 0 ]; then
    pass_count=$((pass_count + 1))
    REPORT_ROWS+=("| ${task_id} | ${category} | ${description} | PASS | ${duration}s | \`${command_to_run}\` |")
  else
    FAIL_IDS+=("${task_id}")
    REPORT_ROWS+=("| ${task_id} | ${category} | ${description} | FAIL | ${duration}s | \`${command_to_run}\` |")
  fi
done < "${MANIFEST_FILE}"

if [ "${run_count}" -eq 0 ]; then
  echo "No golden tasks found in ${MANIFEST_FILE}" >&2
  exit 1
fi

success_rate="$(python3 - <<'PY' "${pass_count}" "${run_count}"
import sys
passed = int(sys.argv[1])
total = int(sys.argv[2])
print(f"{(passed / total) * 100:.2f}")
PY
)"

now_utc="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
threshold_pct="$(python3 - <<'PY' "${MIN_SUCCESS_RATE}"
import sys
print(f"{float(sys.argv[1]) * 100:.2f}")
PY
)"

{
  echo "# Golden Task Report"
  echo
  echo "Generated at: ${now_utc}"
  echo
  echo "## Summary"
  echo
  echo "- Mode: \`${GOLDEN_TASK_MODE}\`"
  echo "- Tasks executed: ${run_count}"
  echo "- Passed: ${pass_count}"
  echo "- Failed: $((run_count - pass_count))"
  echo "- First-pass success: ${success_rate}% (target >= ${threshold_pct}%)"
  echo
  if [ "${sample_issues}" -gt 0 ]; then
    echo "- Manifest issues: ${sample_issues}"
    echo
  fi
  echo "## Task Results"
  echo
  echo "| Task | Category | Description | Status | Duration | Command |"
  echo "| --- | --- | --- | --- | ---: | --- |"
  for row in "${REPORT_ROWS[@]}"; do
    echo "${row}"
  done
  echo
  echo "## Logs"
  echo
  echo "- Directory: \`docs/validation/metrics/golden-task-logs/\`"
} > "${OUTPUT_FILE}"

if [ "${#FAIL_IDS[@]}" -gt 0 ]; then
  echo "Golden tasks failed: ${FAIL_IDS[*]}" >&2
fi

python3 - <<'PY' "${pass_count}" "${run_count}" "${MIN_SUCCESS_RATE}"
import sys
passed = int(sys.argv[1])
total = int(sys.argv[2])
threshold = float(sys.argv[3])
rate = passed / total
if rate < threshold:
    raise SystemExit(1)
PY

echo "Golden tasks passed with ${success_rate}% first-pass success."
