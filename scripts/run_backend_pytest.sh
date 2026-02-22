#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"

if [ -x "${BACKEND_DIR}/.venv/bin/python" ]; then
  PYTHON_BIN="${BACKEND_DIR}/.venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="$(command -v python3)"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="$(command -v python)"
else
  echo "No Python interpreter found. Install python3 or create backend/.venv." >&2
  exit 1
fi

cd "${BACKEND_DIR}"
exec "${PYTHON_BIN}" -m pytest "$@"
