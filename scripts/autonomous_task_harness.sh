#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

echo "==> Running E2E hermetic guard"
./scripts/check_e2e_hermetic.sh

if [ "${ENFORCE_REFRACTOR_SCOPE:-0}" = "1" ]; then
  echo "==> Running refactor scope allowlist guard"
  ./scripts/check_refactor_scope_allowlist.sh
fi

echo "==> Running frontend checks"
(
  cd frontend
  npm run lint
  npm run test
  npm run build
)

echo "==> Running backend tests"
if [ -x "backend/.venv/bin/python" ]; then
  (cd backend && .venv/bin/python -m pytest -q)
else
  (cd backend && python3 -m pytest -q)
fi

if [ "${RUN_E2E_SMOKE:-0}" = "1" ]; then
  echo "==> Running isolated E2E smoke"
  (cd frontend && npm run test:e2e:smoke)
fi

echo "Autonomous task harness passed."
