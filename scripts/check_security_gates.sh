#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

PYTHON_BIN="${PYTHON_BIN:-${ROOT_DIR}/backend/.venv/bin/python}"
if [[ ! -x "${PYTHON_BIN}" ]]; then
  PYTHON_BIN="${PYTHON_BIN_FALLBACK:-python3}"
fi

echo "==> Running pip-audit"
PIP_AUDIT_ARGS=()
IFS=',' read -r -a IGNORE_IDS <<< "${PIP_AUDIT_IGNORE:-CVE-2024-23342}"
for ignore_id in "${IGNORE_IDS[@]}"; do
  trimmed="$(echo "${ignore_id}" | xargs)"
  if [[ -n "${trimmed}" ]]; then
    PIP_AUDIT_ARGS+=(--ignore-vuln "${trimmed}")
  fi
done
(
  cd backend
  "${PYTHON_BIN}" -m pip_audit "${PIP_AUDIT_ARGS[@]}"
)

echo "==> Running bandit (high severity)"
(
  cd backend
  "${PYTHON_BIN}" -m bandit -q -r app -lll
)

echo "==> Running mutation integrity checks"
"${PYTHON_BIN}" ./scripts/check_mutation_integrity.py

if [[ "${RUN_GITLEAKS:-1}" == "1" ]]; then
  if ! command -v gitleaks >/dev/null 2>&1; then
    echo "gitleaks binary not found in PATH." >&2
    echo "Install with ./scripts/install_gitleaks.sh or set RUN_GITLEAKS=0 for local runs." >&2
    exit 1
  fi

  echo "==> Running gitleaks"
  gitleaks detect --source . --redact --no-banner --no-git --config .gitleaks.toml
fi

echo "Security gates passed."
