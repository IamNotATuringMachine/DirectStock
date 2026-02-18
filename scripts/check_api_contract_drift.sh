#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"
SNAPSHOT_PATH="${ROOT_DIR}/docs/contracts/openapi.snapshot.json"
TMP_CURRENT="$(mktemp)"

cleanup() {
  rm -f "${TMP_CURRENT}"
}
trap cleanup EXIT

cd "${BACKEND_DIR}"

PYTHON_BIN="${PYTHON_BIN:-.venv/bin/python}"
if [ ! -x "${PYTHON_BIN}" ]; then
  PYTHON_BIN="${PYTHON_BIN_FALLBACK:-python3}"
fi

"${PYTHON_BIN}" - <<'PY' > "${TMP_CURRENT}"
import json
from app.main import app

print(json.dumps(app.openapi(), sort_keys=True, separators=(",", ":")))
PY

if [ "${UPDATE_OPENAPI_SNAPSHOT:-0}" = "1" ]; then
  mkdir -p "$(dirname "${SNAPSHOT_PATH}")"
  cp "${TMP_CURRENT}" "${SNAPSHOT_PATH}"
  echo "OpenAPI snapshot updated: ${SNAPSHOT_PATH}"
  exit 0
fi

if [ ! -f "${SNAPSHOT_PATH}" ]; then
  echo "Missing snapshot: ${SNAPSHOT_PATH}"
  echo "Run: UPDATE_OPENAPI_SNAPSHOT=1 ./scripts/check_api_contract_drift.sh"
  exit 1
fi

SNAPSHOT_PATH="${SNAPSHOT_PATH}" CURRENT_PATH="${TMP_CURRENT}" "${PYTHON_BIN}" - <<'PY'
import json
import os
import sys

snapshot_path = os.environ["SNAPSHOT_PATH"]
current_path = os.environ["CURRENT_PATH"]

with open(snapshot_path, "r", encoding="utf-8") as fh:
    previous = json.load(fh)
with open(current_path, "r", encoding="utf-8") as fh:
    current = json.load(fh)

errors: list[str] = []

prev_paths = previous.get("paths", {})
curr_paths = current.get("paths", {})

for path, prev_methods in prev_paths.items():
    curr_methods = curr_paths.get(path)
    if curr_methods is None:
        errors.append(f"Removed path: {path}")
        continue

    for method, prev_operation in prev_methods.items():
        curr_operation = curr_methods.get(method)
        if curr_operation is None:
            errors.append(f"Removed operation: {method.upper()} {path}")
            continue

        prev_responses = prev_operation.get("responses", {})
        curr_responses = curr_operation.get("responses", {})
        for status_code in prev_responses.keys():
            if status_code not in curr_responses:
                errors.append(f"Removed response code {status_code} for {method.upper()} {path}")

if errors:
    print("OpenAPI contract drift check failed (breaking changes detected):")
    for entry in errors:
        print(f"  - {entry}")
    sys.exit(1)

print("OpenAPI contract drift check passed (no breaking removals detected).")
PY
