#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

declare -a ALLOWLIST_REGEX=(
  '^\.editorconfig$'
  '^\.pre-commit-config\.yaml$'
  '^\.gitleaks\.toml$'
  '^\.env\.example$'
  '^\.github/workflows/ci\.yml$'
  '^\.github/workflows/agent_self_improve\.yml$'
  '^backend/ruff\.toml$'
  '^backend/pyproject\.toml$'
  '^frontend/eslint\.config\.js$'
  '^frontend/\.prettierrc$'
  '^frontend/\.prettierignore$'
  '^\.gitignore$'
  '^frontend/src/App\.tsx$'
  '^frontend/src/components/AppLayout\.tsx$'
  '^frontend/src/components/users/UserFormModal\.tsx$'
  '^frontend/src/services/operationsApi\.ts$'
  '^frontend/src/services/operations-api/.*'
  '^frontend/src/routing/.*'
  '^frontend/src/pages/ProductFormPage\.tsx$'
  '^frontend/src/pages/GoodsReceiptPage\.tsx$'
  '^frontend/src/pages/GoodsIssuePage\.tsx$'
  '^frontend/src/pages/StockTransferPage\.tsx$'
  '^frontend/src/pages/ShippingPage\.tsx$'
  '^frontend/src/pages/PurchasingPage\.tsx$'
  '^frontend/src/pages/InterWarehouseTransferPage\.tsx$'
  '^frontend/src/pages/ReturnsPage\.tsx$'
  '^frontend/src/pages/PickingPage\.tsx$'
  '^frontend/src/pages/InventoryPage\.tsx$'
  '^frontend/src/pages/InventoryCountPage\.tsx$'
  '^frontend/src/pages/WarehousePage\.tsx$'
  '^frontend/src/pages/UsersPage\.tsx$'
  '^frontend/src/pages/SalesOrdersPage\.tsx$'
  '^frontend/src/pages/ProductsPage\.tsx$'
  '^frontend/src/pages/ScannerPage\.tsx$'
  '^frontend/src/pages/AlertsPage\.tsx$'
  '^frontend/src/pages/CustomersPage\.tsx$'
  '^frontend/src/pages/ReportsPage\.tsx$'
  '^frontend/src/pages/goods-issue/.*'
  '^frontend/src/pages/stock-transfer/.*'
  '^frontend/src/pages/shipping/.*'
  '^frontend/src/pages/purchasing/.*'
  '^frontend/src/pages/inter-warehouse-transfer/.*'
  '^frontend/src/pages/returns/.*'
  '^frontend/src/pages/inventory-count/.*'
  '^frontend/src/pages/inventory/.*'
  '^frontend/src/pages/warehouse/.*'
  '^frontend/src/pages/users/.*'
  '^frontend/src/pages/sales-orders/.*'
  '^frontend/src/pages/products/.*'
  '^frontend/src/pages/scanner/.*'
  '^frontend/src/pages/alerts/.*'
  '^frontend/src/pages/customers/.*'
  '^frontend/src/pages/picking/.*'
  '^frontend/src/pages/reports/.*'
  '^frontend/src/pages/product-form/.*'
  '^frontend/src/pages/goods-receipt/.*'
  '^frontend/src/stores/authStore\.test\.ts$'
  '^backend/app/routers/operations/.*'
  '^backend/app/routers/reports/.*'
  '^backend/app/routers/documents\.py$'
  '^backend/app/routers/customers\.py$'
  '^backend/app/routers/customers_helpers\.py$'
  '^backend/app/routers/suppliers\.py$'
  '^backend/app/routers/shipping\.py$'
  '^backend/app/routers/shipping_helpers\.py$'
  '^backend/app/routers/shipping_workflow\.py$'
  '^backend/app/routers/returns\.py$'
  '^backend/app/routers/returns_common\.py$'
  '^backend/app/routers/returns_orders\.py$'
  '^backend/app/routers/returns_items\.py$'
  '^backend/app/routers/purchasing\.py$'
  '^backend/app/routers/purchasing_helpers\.py$'
  '^backend/app/routers/purchasing_workflow\.py$'
  '^backend/app/routers/warehouses\.py$'
  '^backend/app/routers/warehouses_helpers\.py$'
  '^backend/app/routers/warehouses_workflow\.py$'
  '^backend/app/routers/inventory_counts\.py$'
  '^backend/app/routers/inventory_counts_workflow\.py$'
  '^backend/app/routers/alerts\.py$'
  '^backend/app/routers/picking\.py$'
  '^backend/app/routers/workflows\.py$'
  '^backend/app/routers/inter_warehouse_transfers\.py$'
  '^backend/app/routers/inter_warehouse_transfers_workflow\.py$'
  '^backend/app/routers/invoices\.py$'
  '^backend/app/routers/invoices_helpers\.py$'
  '^backend/app/routers/external_api\.py$'
  '^backend/app/routers/external_api_helpers\.py$'
  '^backend/app/routers/external_api_workflow\.py$'
  '^backend/app/routers/sales_orders\.py$'
  '^backend/app/routers/sales_orders_helpers\.py$'
  '^backend/app/routers/inventory\.py$'
  '^backend/app/routers/inventory_batch_queries\.py$'
  '^backend/app/routers/inventory_queries\.py$'
  '^backend/app/middleware/idempotency\.py$'
  '^backend/app/routers/purchase_recommendations\.py$'
  '^backend/app/routers/product_settings\.py$'
  '^backend/app/routers/abc\.py$'
  '^backend/app/routers/audit_log\.py$'
  '^backend/app/routers/operations\.py$'
  '^backend/app/routers/reports\.py$'
  '^backend/app/services/operations/.*'
  '^backend/app/services/carriers/.*'
  '^backend/app/services/returns/.*'
  '^backend/app/services/reports/.*'
  '^backend/app/bootstrap\.py$'
  '^backend/app/bootstrap_seed\.py$'
  '^backend/app/bootstrap_permissions\.py$'
  '^backend/app/bootstrap_roles\.py$'
  '^backend/app/config\.py$'
  '^backend/app/main\.py$'
  '^backend/app/database\.py$'
  '^backend/app/observability/.*'
  '^backend/alembic/versions/0032_wave3a_rbac_permission_backfill\.py$'
  '^backend/alembic/versions/0033_wave3b_rbac_permission_backfill\.py$'
  '^backend/alembic/versions/0034_wave3c_rbac_permission_backfill\.py$'
  '^backend/tests/test_rbac_phase2\.py$'
  '^backend/tests/test_rbac_permissions_phase5\.py$'
  '^backend/tests/test_seed\.py$'
  '^backend/tests/test_auth\.py$'
  '^backend/tests/conftest\.py$'
  '^backend/tests/test_idempotency_regressions_phase6\.py$'
  '^backend/tests/test_audit_mutations_phase6\.py$'
  '^frontend/package\.json$'
  '^frontend/src/types\.ts$'
  '^frontend/src/types/.*'
  '^frontend/tests/e2e/.*'
  '^scripts/run_e2e_isolated\.sh$'
  '^scripts/check_e2e_hermetic\.sh$'
  '^scripts/autonomous_task_harness\.sh$'
  '^scripts/check_refactor_scope_allowlist\.sh$'
  '^scripts/check_file_size_limits\.sh$'
  '^scripts/check_api_contract_drift\.sh$'
  '^scripts/check_security_gates\.sh$'
  '^scripts/install_gitleaks\.sh$'
  '^scripts/check_mutation_integrity\.py$'
  '^scripts/run_golden_tasks\.sh$'
  '^scripts/agent_governance_check\.sh$'
  '^scripts/check_mcp_readiness\.sh$'
  '^scripts/setup_mcp_multi_cli\.sh$'
  '^scripts/mcp/.*'
  '^scripts/observability/.*'
  '^scripts/collect_complexity_metrics\.sh$'
  '^scripts/collect_test_flakiness\.sh$'
  '^scripts/collect_ci_duration\.sh$'
  '^scripts/perf/.*'
  '^docker-compose\.dev\.yml$'
  '^docker-compose\.prod\.yml$'
  '^docker-compose\.yml$'
  '^nginx/nginx\.conf$'
  '^nginx/nginx\.prod\.conf$'
  '^docker/observability/.*'
  '^docs/guides/.*'
  '^docs/agents/.*'
  '^docs/contracts/.*'
  '^docs/operations/.*'
  '^docs/validation/refactor-sota-upgrades\.md$'
  '^docs/validation/engineering-scorecard\.md$'
  '^docs/validation/perf-budgets\.md$'
  '^docs/validation/security-gates\.md$'
  '^docs/validation/golden-tasks/.*'
  '^docs/validation/metrics/.*'
  '^README\.md$'
  '^AGENTS\.md$'
  '^CLAUDE\.md$'
  '^CODEX\.md$'
  '^GEMINI\.md$'
  '^backend/AGENTS\.md$'
  '^frontend/AGENTS\.md$'
  '^backend/app/bootstrap_permissions_data\.py$'
  '^backend/app/bootstrap_permissions_seed\.py$'
  '^backend/app/services/einvoice/.*'
  '^frontend/src/services/offlineQueue\.ts$'
  '^frontend/src/services/offlineQueueStore\.ts$'
  '^frontend/src/services/offlineQueueTypes\.ts$'
  '^scripts/agent_policy_lint\.py$'
  '^scripts/agent_self_improve\.py$'
)

resolve_base_ref() {
  if [ -n "${BASE_REF:-}" ]; then
    echo "${BASE_REF}"
    return
  fi
  if [ -n "${GITHUB_BASE_REF:-}" ]; then
    if git rev-parse --verify "origin/${GITHUB_BASE_REF}" >/dev/null 2>&1; then
      echo "origin/${GITHUB_BASE_REF}"
      return
    fi
    if git rev-parse --verify "${GITHUB_BASE_REF}" >/dev/null 2>&1; then
      echo "${GITHUB_BASE_REF}"
      return
    fi
    echo ""
    return
  fi
  for candidate in origin/main origin/master refs/heads/main refs/heads/master main master; do
    if git rev-parse --verify "${candidate}" >/dev/null 2>&1; then
      echo "${candidate}"
      return
    fi
  done
  echo ""
}

BASE_REF="$(resolve_base_ref)"
if [ -n "${BASE_REF}" ]; then
  MERGE_BASE="$(git merge-base HEAD "${BASE_REF}" 2>/dev/null || true)"
  if [ -n "${MERGE_BASE}" ]; then
    CHANGED_FILES_RAW="$(git diff --name-only "${MERGE_BASE}"...HEAD)"
  else
    CHANGED_FILES_RAW="$(git diff --name-only HEAD~1...HEAD 2>/dev/null || git diff --name-only)"
  fi
else
  CHANGED_FILES_RAW="$(git diff --name-only HEAD~1...HEAD 2>/dev/null || git diff --name-only)"
fi

WORKTREE_FILES="$(
  {
    git diff --name-only
    git diff --name-only --cached
    git ls-files --others --exclude-standard
  } | sed '/^$/d' | sort -u
)"

if [ -n "${WORKTREE_FILES}" ]; then
  CHANGED_FILES_RAW="$(
    {
      printf '%s\n' "${CHANGED_FILES_RAW}"
      printf '%s\n' "${WORKTREE_FILES}"
    } | sed '/^$/d' | sort -u
  )"
fi

if [ -z "${CHANGED_FILES_RAW}" ]; then
  echo "No changed files to validate against allowlist."
  exit 0
fi

declare -a DISALLOWED=()

while IFS= read -r file; do
  if [ -z "${file}" ]; then
    continue
  fi
  allowed=0
  for pattern in "${ALLOWLIST_REGEX[@]}"; do
    if [[ "${file}" =~ ${pattern} ]]; then
      allowed=1
      break
    fi
  done
  if [ "${allowed}" -eq 0 ]; then
    DISALLOWED+=("${file}")
  fi
done <<EOF
${CHANGED_FILES_RAW}
EOF

if [ "${#DISALLOWED[@]}" -gt 0 ]; then
  echo "Refactor scope allowlist violation:"
  printf '  - %s\n' "${DISALLOWED[@]}"
  echo
  echo "Update docs/guides/refactor-scope-allowlist.md or justify files under Out-of-scope exception."
  exit 1
fi

echo "Refactor scope allowlist check passed."
