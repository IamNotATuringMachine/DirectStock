#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

METRICS_DIR="${ROOT_DIR}/docs/validation/metrics"
OUTPUT_FILE="${METRICS_DIR}/complexity-latest.md"

mkdir -p "${METRICS_DIR}"

TMP_ALL="$(mktemp)"
TMP_HOTSPOT="$(mktemp)"
trap 'rm -f "${TMP_ALL}" "${TMP_HOTSPOT}"' EXIT

while IFS= read -r file; do
  line_count="$(wc -l < "${file}" | tr -d ' ')"
  printf "%s\t%s\n" "${line_count}" "${file}" >> "${TMP_ALL}"
done < <(
  rg --files backend/app frontend/src \
    -g "*.py" -g "*.ts" -g "*.tsx" -g "*.js" -g "*.jsx" \
    | rg -v "(^backend/tests/|^frontend/tests/|/tests/|/__tests__/|\\.test\\.|\\.spec\\.)"
)

if [ ! -s "${TMP_ALL}" ]; then
  echo "No source files found for complexity scan." >&2
  exit 1
fi

awk -F $'\t' '$2 ~ /^frontend\/src\/pages\// || $2 ~ /^backend\/app\/routers\//' "${TMP_ALL}" > "${TMP_HOTSPOT}"

all_over_500="$(awk -F $'\t' '$1 > 500 {count++} END {print count + 0}' "${TMP_ALL}")"
hotspot_over_350="$(awk -F $'\t' '$1 > 350 {count++} END {print count + 0}' "${TMP_HOTSPOT}")"

ruff_tool=""
if [ -x "${ROOT_DIR}/backend/.venv/bin/ruff" ]; then
  ruff_tool="${ROOT_DIR}/backend/.venv/bin/ruff"
elif command -v ruff >/dev/null 2>&1; then
  ruff_tool="$(command -v ruff)"
fi

python_c901_count="n/a"
if [ -n "${ruff_tool}" ]; then
  set +e
  c901_output="$("${ruff_tool}" check --config backend/ruff.toml --select C901 backend/app 2>&1)"
  c901_status=$?
  set -e
  if [ "${c901_status}" -eq 0 ]; then
    python_c901_count="0"
  else
    python_c901_count="$(printf "%s\n" "${c901_output}" | grep -c " C901 " || true)"
    if [ -z "${python_c901_count}" ]; then
      python_c901_count="0"
    fi
  fi
fi

{
  echo "# Complexity Metrics Snapshot"
  echo
  echo "Generated at: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo
  echo "## Scorecard Signals"
  echo
  echo "| Metric | Value | Target |"
  echo "| --- | --- | --- |"
  echo "| Production files over 500 LOC | ${all_over_500} | 0 |"
  echo "| Page/router files over 350 LOC | ${hotspot_over_350} | 0 |"
  echo "| Python functions flagged with Ruff C901 | ${python_c901_count} | <= 10 critical hotspots total |"
  echo
  echo "## Top 25 Largest Production Files"
  echo
  echo "| File | LOC |"
  echo "| --- | ---: |"
  sort -nr -k1,1 "${TMP_ALL}" | head -n 25 | while IFS=$'\t' read -r loc file; do
    echo "| \`${file}\` | ${loc} |"
  done
  echo
  echo "## Top Page/Router Hotspots"
  echo
  echo "| File | LOC |"
  echo "| --- | ---: |"
  sort -nr -k1,1 "${TMP_HOTSPOT}" | head -n 25 | while IFS=$'\t' read -r loc file; do
    echo "| \`${file}\` | ${loc} |"
  done
} > "${OUTPUT_FILE}"

echo "Wrote ${OUTPUT_FILE}"
