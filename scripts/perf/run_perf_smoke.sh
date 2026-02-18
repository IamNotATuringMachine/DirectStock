#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"

PERF_MODE="${PERF_MODE:-smoke}"
PERF_USE_COMPOSE="${PERF_USE_COMPOSE:-1}"
PERF_USERNAME="${PERF_USERNAME:-admin}"
PERF_PASSWORD="${PERF_PASSWORD:-DirectStock2026!}"
RESULTS_DIR="${ROOT_DIR}/docs/validation/metrics/perf-results"
MANIFEST_FILE="${RESULTS_DIR}/latest-manifest.tsv"

mkdir -p "${RESULTS_DIR}"

if [[ "${PERF_MODE}" == "full" ]]; then
  CORE_VUS="${CORE_VUS:-6}"
  CORE_DURATION="${CORE_DURATION:-90s}"
  REPORTS_VUS="${REPORTS_VUS:-3}"
  REPORTS_DURATION="${REPORTS_DURATION:-90s}"
else
  CORE_VUS="${CORE_VUS:-2}"
  CORE_DURATION="${CORE_DURATION:-20s}"
  REPORTS_VUS="${REPORTS_VUS:-1}"
  REPORTS_DURATION="${REPORTS_DURATION:-20s}"
fi

SCENARIOS=(goods_receipt returns picking reports)
PROJECT_NAME="${PERF_COMPOSE_PROJECT:-directstock-perf}"
NETWORK_NAME="${PROJECT_NAME}_default"

cleanup() {
  if [[ "${PERF_USE_COMPOSE}" == "1" ]] && [[ "${PERF_KEEP_STACK:-0}" != "1" ]]; then
    COMPOSE_PROJECT_NAME="${PROJECT_NAME}" docker compose -f docker-compose.dev.yml down -v --remove-orphans >/dev/null 2>&1 || true
  fi
}

wait_for_backend() {
  local retries=60
  while (( retries > 0 )); do
    if docker run --rm --network "${NETWORK_NAME}" curlimages/curl:8.10.1 -fsS "${BASE_URL}/api/health" >/dev/null 2>&1; then
      return 0
    fi
    retries=$((retries - 1))
    sleep 2
  done

  echo "Backend health check failed for ${BASE_URL}/api/health" >&2
  return 1
}

check_login() {
  local password="$1"
  local response
  response="$(docker run --rm --network "${NETWORK_NAME}" curlimages/curl:8.10.1 -sS \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"${PERF_USERNAME}\",\"password\":\"${password}\"}" \
    "${BASE_URL}/api/auth/login" \
    -w $'\n%{http_code}')"
  local status_code="${response##*$'\n'}"
  local body="${response%$'\n'*}"

  if [[ "${status_code}" == "200" && "${body}" == *"access_token"* ]]; then
    PERF_PASSWORD="${password}"
    return 0
  fi

  return 1
}

run_scenario() {
  local scenario="$1"
  local vus="$2"
  local duration="$3"
  local output_file="${RESULTS_DIR}/${scenario}-${PERF_MODE}.json"
  local container_output_file="/workspace${output_file#${ROOT_DIR}}"

  if [[ "${PERF_USE_COMPOSE}" == "1" ]]; then
    docker run --rm \
      --network "${NETWORK_NAME}" \
      -v "${ROOT_DIR}:/workspace" \
      -w /workspace \
      -e BASE_URL="${BASE_URL}" \
      -e PERF_USERNAME="${PERF_USERNAME}" \
      -e PERF_PASSWORD="${PERF_PASSWORD}" \
      -e VUS="${vus}" \
      -e DURATION="${duration}" \
      grafana/k6:0.57.0 \
      run --summary-export "${container_output_file}" "scripts/perf/scenarios/${scenario}.js"
  else
    if ! command -v k6 >/dev/null 2>&1; then
      echo "k6 not found. Install k6 or set PERF_USE_COMPOSE=1." >&2
      exit 1
    fi
    BASE_URL="${BASE_URL}" PERF_USERNAME="${PERF_USERNAME}" PERF_PASSWORD="${PERF_PASSWORD}" \
      VUS="${vus}" DURATION="${duration}" \
      k6 run --summary-export "${output_file}" "scripts/perf/scenarios/${scenario}.js"
  fi

  printf "%s\t%s\n" "${scenario}" "${output_file}" >> "${MANIFEST_FILE}"
}

sanitize_report() {
  local report_file="$1"
  python3 - <<'PY' "${report_file}"
import json
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
data = json.loads(path.read_text(encoding="utf-8"))
jwt_re = re.compile(r"^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$")

def scrub(value):
    if isinstance(value, dict):
        result = {}
        for key, item in value.items():
            lower_key = str(key).lower()
            if lower_key in {"token", "access_token", "refresh_token", "authorization"}:
                result[key] = "<redacted>"
            else:
                result[key] = scrub(item)
        return result
    if isinstance(value, list):
        return [scrub(item) for item in value]
    if isinstance(value, str) and jwt_re.match(value):
        return "<redacted>"
    return value

path.write_text(json.dumps(scrub(data), indent=4) + "\n", encoding="utf-8")
PY
}

: > "${MANIFEST_FILE}"

if [[ "${PERF_USE_COMPOSE}" == "1" ]]; then
  trap cleanup EXIT
  COMPOSE_PROJECT_NAME="${PROJECT_NAME}" \
    BACKEND_PORT_BIND="${PERF_BACKEND_PORT_BIND:-18000}" \
    SEED_ON_START=true \
    OBSERVABILITY_ENABLED=false \
    docker compose -f docker-compose.dev.yml up -d postgres backend
  BASE_URL="${BASE_URL:-http://backend:8000}"
  wait_for_backend

  if ! check_login "${PERF_PASSWORD}"; then
    if [[ "${PERF_PASSWORD}" == "DirectStock2026!" ]] && check_login "change-me-admin-password"; then
      echo "Using fallback admin seed password for perf run."
    else
      echo "Perf login preflight failed for username=${PERF_USERNAME}" >&2
      exit 1
    fi
  fi
else
  BASE_URL="${BASE_URL:-http://localhost:8000}"
fi

for scenario in "${SCENARIOS[@]}"; do
  if [[ "${scenario}" == "reports" ]]; then
    run_scenario "${scenario}" "${REPORTS_VUS}" "${REPORTS_DURATION}"
  else
    run_scenario "${scenario}" "${CORE_VUS}" "${CORE_DURATION}"
  fi
  sanitize_report "${RESULTS_DIR}/${scenario}-${PERF_MODE}.json"
done

echo "Perf scenarios completed. Manifest: ${MANIFEST_FILE}"
