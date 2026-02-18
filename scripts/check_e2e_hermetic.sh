#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DIR="${ROOT_DIR}/frontend/tests/e2e"

if [ ! -d "${TARGET_DIR}" ]; then
  echo "E2E directory not found: ${TARGET_DIR}"
  exit 1
fi

violations=0

echo "Checking E2E specs for non-hermetic patterns..."

if rg -n --fixed-strings "http://localhost:5173" "${TARGET_DIR}" -g '*.spec.ts'; then
  echo
  echo "Found hardcoded localhost URLs. Use page.goto('/path') and Playwright baseURL."
  violations=1
fi

if rg -n "/Users/" "${TARGET_DIR}" -g '*.spec.ts'; then
  echo
  echo "Found absolute user paths. Use relative paths under frontend/output or frontend/test-results."
  violations=1
fi

if [ "${violations}" -ne 0 ]; then
  echo
  echo "E2E hermetic guard failed."
  exit 1
fi

echo "E2E hermetic guard passed."
