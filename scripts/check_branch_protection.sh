#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

BRANCH="${BRANCH_PROTECTION_BRANCH:-main}"
ALLOW_WARN_ONLY="${BRANCH_PROTECTION_ALLOW_WARN_ONLY:-0}"
REQUIRE_REVIEWS="${BRANCH_PROTECTION_REQUIRE_REVIEWS:-1}"
REQUIRE_CONVERSATION_RESOLUTION="${BRANCH_PROTECTION_REQUIRE_CONVERSATION_RESOLUTION:-1}"
REQUIRED_CONTEXTS="${BRANCH_PROTECTION_REQUIRED_CONTEXTS:-frontend,backend,e2e_smoke,security,size_guard,llm_guards}"
REQUIRE_SUPPORTED="${BRANCH_PROTECTION_REQUIRE_SUPPORTED:-0}"

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

fail_or_warn() {
  local message="$1"
  if [ "${ALLOW_WARN_ONLY}" = "1" ]; then
    echo "WARNING: ${message}" >&2
    exit 0
  fi
  echo "ERROR: ${message}" >&2
  exit 2
}

if ! command -v gh >/dev/null 2>&1; then
  fail_or_warn "gh CLI not found."
fi

if ! gh auth status -h github.com >/dev/null 2>&1; then
  fail_or_warn "gh CLI is not authenticated."
fi

GH_REPO="${GH_REPO:-$(resolve_repo_from_origin || true)}"
if [ -z "${GH_REPO}" ]; then
  fail_or_warn "Could not resolve GH_REPO from origin remote."
fi

TMP_JSON="$(mktemp)"
TMP_ERR="$(mktemp)"
trap 'rm -f "${TMP_JSON}" "${TMP_ERR}"' EXIT

set +e
gh api "repos/${GH_REPO}/branches/${BRANCH}/protection" > "${TMP_JSON}" 2> "${TMP_ERR}"
gh_status=$?
set -e

if [ "${gh_status}" -ne 0 ]; then
  error_text="$(cat "${TMP_ERR}")"
  if [[ "${error_text}" == *"enable this feature"* ]] || [[ "${error_text}" == *"HTTP 403"* ]]; then
    if [ "${REQUIRE_SUPPORTED}" = "1" ]; then
      fail_or_warn "Branch protection feature unavailable for ${GH_REPO}:${BRANCH} -> ${error_text}"
    fi
    echo "WARNING: Branch protection feature unavailable for ${GH_REPO}:${BRANCH}; enforce equivalent safeguards via workflow checks + governance lint." >&2
    exit 0
  fi
  fail_or_warn "Branch protection API query failed for ${GH_REPO}:${BRANCH} -> ${error_text}"
fi

validation_output="$(
python3 - "${TMP_JSON}" "${REQUIRED_CONTEXTS}" "${REQUIRE_REVIEWS}" "${REQUIRE_CONVERSATION_RESOLUTION}" <<'PY'
import json
import sys

path = sys.argv[1]
required_contexts = [item.strip() for item in sys.argv[2].split(",") if item.strip()]
require_reviews = sys.argv[3] == "1"
require_conversation_resolution = sys.argv[4] == "1"

payload = json.loads(open(path, "r", encoding="utf-8").read())
errors = []

required_status = payload.get("required_status_checks")
if not isinstance(required_status, dict):
    errors.append("required_status_checks is missing.")
else:
    strict = required_status.get("strict")
    if strict is not True:
        errors.append("required_status_checks.strict must be true.")
    contexts = required_status.get("contexts")
    if not isinstance(contexts, list) or not contexts:
        errors.append("required_status_checks.contexts must be a non-empty list.")
        contexts = []
    missing_contexts = [ctx for ctx in required_contexts if ctx not in contexts]
    if missing_contexts:
        errors.append("missing required status checks: " + ", ".join(missing_contexts))

if require_reviews:
    reviews = payload.get("required_pull_request_reviews")
    if not isinstance(reviews, dict):
        errors.append("required_pull_request_reviews is missing.")
    else:
        approvals = int(reviews.get("required_approving_review_count") or 0)
        if approvals < 1:
            errors.append("required_approving_review_count must be >= 1.")

if require_conversation_resolution:
    conv = payload.get("required_conversation_resolution")
    enabled = False
    if isinstance(conv, dict):
        enabled = bool(conv.get("enabled"))
    elif conv is True:
        enabled = True
    if not enabled:
        errors.append("required_conversation_resolution must be enabled.")

if errors:
    print("invalid")
    for item in errors:
        print(item)
else:
    print("valid")
PY
)"

if [ "${validation_output%%$'\n'*}" != "valid" ]; then
  fail_or_warn "Branch protection does not meet policy for ${GH_REPO}:${BRANCH}. $(echo "${validation_output}" | tail -n +2 | tr '\n' ' ')"
fi

echo "Branch protection policy validated for ${GH_REPO}:${BRANCH}."
