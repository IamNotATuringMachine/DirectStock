#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

RUNS="${RUNS:-20}"
TEST_FLAKE_CMD="${TEST_FLAKE_CMD:-cd frontend && npm run test:e2e:smoke}"
METRICS_DIR="${ROOT_DIR}/docs/validation/metrics"
OUTPUT_FILE="${METRICS_DIR}/test-flakiness-latest.md"

mkdir -p "${METRICS_DIR}"

if ! [[ "${RUNS}" =~ ^[0-9]+$ ]] || [ "${RUNS}" -lt 1 ]; then
  echo "RUNS must be an integer >= 1" >&2
  exit 1
fi

TMP_RUNS="$(mktemp)"
TMP_LOG_DIR="$(mktemp -d)"
trap 'rm -f "${TMP_RUNS}"; rm -rf "${TMP_LOG_DIR}"' EXIT

pass_count=0
fail_count=0

for run in $(seq 1 "${RUNS}"); do
  log_file="${TMP_LOG_DIR}/run-${run}.log"
  start_ts="$(date +%s)"
  set +e
  bash -lc "${TEST_FLAKE_CMD}" >"${log_file}" 2>&1
  status=$?
  set -e
  end_ts="$(date +%s)"
  duration="$((end_ts - start_ts))"

  if [ "${status}" -eq 0 ]; then
    pass_count="$((pass_count + 1))"
    printf "%s\tPASS\t%s\t%s\n" "${run}" "${duration}" "${log_file}" >> "${TMP_RUNS}"
  else
    fail_count="$((fail_count + 1))"
    printf "%s\tFAIL\t%s\t%s\n" "${run}" "${duration}" "${log_file}" >> "${TMP_RUNS}"
  fi
done

flake_rate_pct="$(python3 - <<'PY' "${fail_count}" "${RUNS}"
import sys
fails = int(sys.argv[1])
runs = int(sys.argv[2])
print(f"{(fails / runs) * 100:.2f}")
PY
)"

{
  echo "# Test Flakiness Snapshot"
  echo
  echo "Generated at: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo
  echo "Command: \`${TEST_FLAKE_CMD}\`"
  echo
  echo "## Scorecard Signals"
  echo
  echo "| Metric | Value | Target |"
  echo "| --- | --- | --- |"
  echo "| Runs | ${RUNS} | >= 20 |"
  echo "| Passes | ${pass_count} | n/a |"
  echo "| Failures | ${fail_count} | 0 preferred |"
  echo "| Flake rate | ${flake_rate_pct}% | < 1.00% |"
  echo
  echo "## Run Details"
  echo
  echo "| Run | Status | Duration (s) |"
  echo "| ---: | --- | ---: |"
  while IFS=$'\t' read -r run status duration _; do
    echo "| ${run} | ${status} | ${duration} |"
  done < "${TMP_RUNS}"

  if [ "${fail_count}" -gt 0 ]; then
    echo
    echo "## Failure Excerpts"
    echo
    while IFS=$'\t' read -r run status _ log_file; do
      if [ "${status}" = "FAIL" ]; then
        echo "### Run ${run}"
        echo
        echo '```text'
        tail -n 40 "${log_file}"
        echo '```'
        echo
      fi
    done < "${TMP_RUNS}"
  fi
} > "${OUTPUT_FILE}"

echo "Wrote ${OUTPUT_FILE}"
