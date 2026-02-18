#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

declare -a ALLOWLIST_REGEX=(
  '^\.editorconfig$'
  '^\.pre-commit-config\.yaml$'
  '^\.github/workflows/ci\.yml$'
  '^backend/ruff\.toml$'
  '^frontend/eslint\.config\.js$'
  '^frontend/\.prettierrc$'
  '^frontend/\.prettierignore$'
  '^\.gitignore$'
  '^frontend/src/App\.tsx$'
  '^frontend/src/components/AppLayout\.tsx$'
  '^frontend/src/routing/.*'
  '^frontend/src/pages/ProductFormPage\.tsx$'
  '^frontend/src/pages/GoodsReceiptPage\.tsx$'
  '^frontend/src/pages/product-form/.*'
  '^frontend/src/pages/goods-receipt/.*'
  '^backend/app/routers/operations/.*'
  '^backend/app/routers/reports/.*'
  '^backend/app/routers/documents\.py$'
  '^backend/app/routers/customers\.py$'
  '^backend/app/routers/suppliers\.py$'
  '^backend/app/routers/shipping\.py$'
  '^backend/app/routers/returns\.py$'
  '^backend/app/routers/purchasing\.py$'
  '^backend/app/routers/warehouses\.py$'
  '^backend/app/routers/inventory_counts\.py$'
  '^backend/app/routers/alerts\.py$'
  '^backend/app/routers/picking\.py$'
  '^backend/app/routers/workflows\.py$'
  '^backend/app/routers/inter_warehouse_transfers\.py$'
  '^backend/app/routers/purchase_recommendations\.py$'
  '^backend/app/routers/product_settings\.py$'
  '^backend/app/routers/abc\.py$'
  '^backend/app/routers/audit_log\.py$'
  '^backend/app/routers/operations\.py$'
  '^backend/app/routers/reports\.py$'
  '^backend/app/services/operations/.*'
  '^backend/app/services/reports/.*'
  '^backend/app/bootstrap\.py$'
  '^backend/alembic/versions/0032_wave3a_rbac_permission_backfill\.py$'
  '^backend/alembic/versions/0033_wave3b_rbac_permission_backfill\.py$'
  '^backend/alembic/versions/0034_wave3c_rbac_permission_backfill\.py$'
  '^backend/tests/test_rbac_phase2\.py$'
  '^backend/tests/test_rbac_permissions_phase5\.py$'
  '^backend/tests/test_seed\.py$'
  '^frontend/package\.json$'
  '^frontend/src/types\.ts$'
  '^frontend/src/types/.*'
  '^frontend/tests/e2e/.*'
  '^scripts/run_e2e_isolated\.sh$'
  '^scripts/check_e2e_hermetic\.sh$'
  '^scripts/autonomous_task_harness\.sh$'
  '^scripts/check_refactor_scope_allowlist\.sh$'
  '^docs/guides/.*'
  '^docs/validation/refactor-sota-upgrades\.md$'
  '^README\.md$'
  '^AGENTS\.md$'
)

resolve_base_ref() {
  if [ -n "${BASE_REF:-}" ]; then
    echo "${BASE_REF}"
    return
  fi
  if [ -n "${GITHUB_BASE_REF:-}" ]; then
    echo "${GITHUB_BASE_REF}"
    return
  fi
  for candidate in origin/main origin/master main master; do
    if git rev-parse --verify "${candidate}" >/dev/null 2>&1; then
      echo "${candidate}"
      return
    fi
  done
  echo ""
}

BASE_REF="$(resolve_base_ref)"
if [ -n "${BASE_REF}" ]; then
  MERGE_BASE="$(git merge-base HEAD "${BASE_REF}")"
  CHANGED_FILES_RAW="$(git diff --name-only "${MERGE_BASE}"...HEAD)"
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
