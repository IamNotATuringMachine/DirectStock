#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"

BACKEND_BASE_URL="${BACKEND_BASE_URL:-http://localhost:8000}"
METRICS_PATH="${METRICS_PATH:-/api/metrics}"
COLLECTOR_HEALTH_URL="${COLLECTOR_HEALTH_URL:-http://localhost:13133/}"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"
GRAFANA_URL="${GRAFANA_URL:-http://localhost:3000}"
GRAFANA_USER="${GRAFANA_USER:-admin}"
GRAFANA_PASSWORD="${GRAFANA_PASSWORD:-admin}"
REQUEST_ID="${REQUEST_ID:-obs-smoke-$(date +%s)}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_cmd curl
require_cmd python3

backend_metrics_url="${BACKEND_BASE_URL%/}${METRICS_PATH}"
health_url="${BACKEND_BASE_URL%/}/api/health"

wait_for_http_ok() {
  local url="$1"
  local attempts="${2:-30}"
  local sleep_seconds="${3:-2}"
  local attempt=1
  while [ "${attempt}" -le "${attempts}" ]; do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      return 0
    fi
    attempt=$((attempt + 1))
    sleep "${sleep_seconds}"
  done
  return 1
}

echo "==> Waiting for backend health"
if ! wait_for_http_ok "${health_url}" 30 2; then
  echo "Backend did not become healthy at ${health_url}" >&2
  exit 1
fi

echo "==> Checking /api/metrics"
metrics_body="$(curl -fsS "${backend_metrics_url}")"
if [[ "${metrics_body}" != *"http_requests_total"* ]] && [[ "${metrics_body}" != *"http_request_duration"* ]]; then
  echo "Metrics endpoint reachable but expected HTTP metrics were not found." >&2
  exit 1
fi

echo "==> Checking request-id propagation"
response_headers="$(curl -fsS -D - -o /dev/null -H "X-Request-ID: ${REQUEST_ID}" "${health_url}")"
if ! printf '%s\n' "${response_headers}" | tr -d '\r' | grep -qi "^x-request-id:[[:space:]]*${REQUEST_ID}$"; then
  echo "Response did not echo the expected X-Request-ID." >&2
  exit 1
fi

echo "==> Checking OTel collector health"
collector_health="$(curl -fsS "${COLLECTOR_HEALTH_URL}")"
if [[ "${collector_health}" != *"Server available"* ]]; then
  echo "Unexpected collector health response: ${collector_health}" >&2
  exit 1
fi

echo "==> Checking Prometheus target status"
prom_targets_json="$(curl -fsS "${PROMETHEUS_URL%/}/api/v1/targets")"
python3 - <<'PY' "${prom_targets_json}"
import json
import sys

payload = json.loads(sys.argv[1])
active = payload.get("data", {}).get("activeTargets", [])
required = {
    "directstock-backend": False,
    "otel-collector": False,
}

for target in active:
    job = target.get("labels", {}).get("job", "")
    if job in required and target.get("health") == "up":
        required[job] = True

missing = [job for job, ok in required.items() if not ok]
if missing:
    raise SystemExit(f"Prometheus targets not up: {', '.join(missing)}")
PY

echo "==> Checking Grafana Prometheus datasource"
grafana_ds_status="$(curl -sS -o /dev/null -w "%{http_code}" -u "${GRAFANA_USER}:${GRAFANA_PASSWORD}" "${GRAFANA_URL%/}/api/datasources/name/Prometheus")"
if [ "${grafana_ds_status}" != "200" ]; then
  echo "Grafana datasource lookup failed with HTTP ${grafana_ds_status}." >&2
  exit 1
fi

echo "==> Checking trace correlation in collector logs"
if command -v docker >/dev/null 2>&1; then
  docker compose -f docker-compose.dev.yml exec -T backend \
    env OBS_TRACE_REQUEST_ID="${REQUEST_ID}" python - <<'PY' >/dev/null
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
import os

request_id = os.environ["OBS_TRACE_REQUEST_ID"]
provider = TracerProvider(resource=Resource.create({"service.name": "directstock-observability-smoke"}))
exporter = OTLPSpanExporter(endpoint="http://otel-collector:4317", insecure=True)
provider.add_span_processor(BatchSpanProcessor(exporter, schedule_delay_millis=50))
trace.set_tracer_provider(provider)
tracer = trace.get_tracer("observability-smoke")
with tracer.start_as_current_span("observability-smoke-span") as span:
    span.set_attribute("http.request_id", request_id)
provider.force_flush()
PY

  collector_logs="$(docker compose -f docker-compose.dev.yml logs --since=2m otel-collector 2>/dev/null || true)"
  if [[ "${collector_logs}" != *"${REQUEST_ID}"* ]]; then
    echo "Collector logs do not contain request-id ${REQUEST_ID}; trace correlation check failed." >&2
    exit 1
  fi
else
  echo "Docker not found; cannot validate collector log correlation." >&2
  exit 1
fi

echo "Observability smoke checks passed."
