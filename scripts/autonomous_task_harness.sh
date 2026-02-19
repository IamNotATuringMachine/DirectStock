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

echo "==> Running file size limits guard"
SIZE_GUARD_MODE="${SIZE_GUARD_MODE:-changed}" ./scripts/check_file_size_limits.sh

echo "==> Running frontend checks"
(
  cd frontend
  npm run lint
  npm run test
  npm run build
)

echo "==> Running backend tests"
BACKEND_FORMAT_TARGETS=(
  app/config.py
  app/database.py
  app/main.py
  app/middleware/idempotency.py
  app/observability/metrics.py
  app/observability/tracing.py
  app/services/carriers/sandbox_stub.py
  tests/test_idempotency_regressions_phase6.py
  tests/test_audit_mutations_phase6.py
)

run_backend_format_check() {
  local -a format_cmd=("$@")
  local -a existing_targets=()
  for target in "${BACKEND_FORMAT_TARGETS[@]}"; do
    if [ -f "backend/${target}" ]; then
      existing_targets+=("${target}")
    fi
  done
  if [ "${#existing_targets[@]}" -eq 0 ]; then
    echo "==> Skipping backend format check (no configured targets present)"
    return 0
  fi

  (
    cd backend
    "${format_cmd[@]}" format --config ruff.toml --check "${existing_targets[@]}"
  )
}

if [ -x "backend/.venv/bin/python" ]; then
  echo "==> Running backend lint/format checks"
  (
    cd backend
    .venv/bin/ruff check --config ruff.toml app tests
  )
  run_backend_format_check .venv/bin/ruff
  echo "==> Running OpenAPI contract drift guard"
  ./scripts/check_api_contract_drift.sh
  (cd backend && .venv/bin/python -m pytest -q)
else
  (
    cd backend
    python3 -m ruff check --config ruff.toml app tests
  )
  run_backend_format_check python3 -m ruff
  echo "==> Running OpenAPI contract drift guard"
  ./scripts/check_api_contract_drift.sh
  (cd backend && python3 -m pytest -q)
fi

if [ "${RUN_E2E_SMOKE:-0}" = "1" ]; then
  echo "==> Running isolated E2E smoke"
  (cd frontend && npm run test:e2e:smoke)
fi

if [ "${RUN_PERF_SMOKE:-0}" = "1" ]; then
  echo "==> Running performance smoke + budget assertions"
  ./scripts/perf/run_perf_smoke.sh
  ./scripts/perf/assert_budgets.sh
fi

if [ "${RUN_SECURITY_GATES:-0}" = "1" ]; then
  echo "==> Running security gates"
  ./scripts/check_security_gates.sh
fi

if [ "${RUN_OBSERVABILITY_SMOKE:-0}" = "1" ]; then
  echo "==> Running observability smoke checks"
  ./scripts/observability/smoke.sh
fi

if [ "${RUN_GOLDEN_TASKS:-0}" = "1" ]; then
  echo "==> Running golden tasks"
  GOLDEN_TASK_MODE="${GOLDEN_TASK_MODE:-smoke}" ./scripts/run_golden_tasks.sh
fi

if [ "${RUN_AGENT_GOVERNANCE:-0}" = "1" ]; then
  echo "==> Running agent governance check"
  ./scripts/agent_governance_check.sh
  echo "==> Running agent policy parity lint"
  python3 scripts/agent_policy_lint.py --strict --provider all --format json
fi

if [ "${RUN_MCP_READINESS:-0}" = "1" ]; then
  echo "==> Running MCP readiness check"
  MCP_PROBE_ALLOW_BLOCKED="${MCP_PROBE_ALLOW_BLOCKED:-1}" ./scripts/check_mcp_readiness.sh
fi

if [ "${COLLECT_SCORECARD_METRICS:-0}" = "1" ]; then
  echo "==> Collecting scorecard complexity metrics"
  ./scripts/collect_complexity_metrics.sh

  echo "==> Collecting CI duration metrics"
  CI_RUN_LIMIT="${CI_RUN_LIMIT:-20}" ./scripts/collect_ci_duration.sh

  if [ "${COLLECT_FLAKINESS:-0}" = "1" ]; then
    echo "==> Collecting test flakiness metrics"
    RUNS="${FLAKE_RUNS:-20}" \
      TEST_FLAKE_CMD="${TEST_FLAKE_CMD:-cd frontend && npm run test:e2e:smoke}" \
      ./scripts/collect_test_flakiness.sh
  fi
fi

echo "Autonomous task harness passed."
