# Refactor SOTA Upgrade Notes (2026-02-18)

## Frontend Tooling
- Added ESLint flat config (`frontend/eslint.config.js`).
- Added Prettier config and checks (`frontend/.prettierrc`, `frontend/.prettierignore`).
- Added scripts:
  - `npm run lint`
  - `npm run format`
  - `npm run format:check`
- Added lint/format dependencies and regenerated `frontend/package-lock.json`.

## Backend Tooling
- Added `backend/ruff.toml`.
- Added `ruff` to backend dev dependencies.

## Repo/CI Hygiene
- Added `.editorconfig` and `.pre-commit-config.yaml`.
- Added GitHub Actions pipeline: `.github/workflows/ci.yml`.
- Updated `.gitignore` for frontend artifacts and `*.tsbuildinfo`.
- Removed tracked artifact: `frontend/tsconfig.tsbuildinfo`.
- Added E2E hermetic guard script: `scripts/check_e2e_hermetic.sh`.
- Added autonomous harness entrypoint: `scripts/autonomous_task_harness.sh`.
- Added refactor scope guard script: `scripts/check_refactor_scope_allowlist.sh`.
- CI now runs E2E hermetic guard and isolated E2E smoke.
- pre-commit now runs E2E hermetic guard for `frontend/tests/e2e/*.spec.ts`.

## Legacy Router Cleanup
- Removed shadow legacy files:
  - `backend/app/routers/operations.py`
  - `backend/app/routers/reports.py`
- Source of truth is now package router structure only:
  - `backend/app/routers/operations/**`
  - `backend/app/routers/reports/**`

## RBAC Permission Migration (Wave 3A complete)
- Completed Wave 3A migration from role guards to permission guards:
  - `backend/app/routers/returns.py`
  - `backend/app/routers/purchasing.py`
  - `backend/app/routers/warehouses.py` (write endpoints)
- Added DB backfill migration for existing deployments:
  - `backend/alembic/versions/0032_wave3a_rbac_permission_backfill.py`
- Synced seed RBAC defaults to keep returns read parity:
  - `controller` now includes `module.returns.read`
  - `auditor` now includes `module.returns.read`
- RBAC counters after Wave 3A:
  - `require_roles(...)` in `backend/app/routers`: `47` (down from `81`)
  - `require_permissions(...)` in `backend/app/routers`: `148` (up from `114`)

## RBAC Permission Migration (Wave 3B complete)
- Completed Wave 3B migration from role guards to permission guards:
  - `backend/app/routers/inventory_counts.py`
  - `backend/app/routers/alerts.py`
  - `backend/app/routers/picking.py`
  - `backend/app/routers/workflows.py`
  - `backend/app/routers/inter_warehouse_transfers.py`
- Added DB backfill migration for Wave 3B:
  - `backend/alembic/versions/0033_wave3b_rbac_permission_backfill.py`
- Added new permission codes and seed alignment:
  - `module.inventory_counts.cancel`
  - `module.approval_rules.read`
  - `module.approval_rules.write`
  - `module.approvals.read`
  - `module.approvals.write`
  - `module.inter_warehouse_transfers.read`
  - `module.inter_warehouse_transfers.write`
- Expanded role mappings for parity across `alerts`, `picking`, `inventory_counts`, `workflows`, `inter_warehouse_transfers`.
- RBAC counters after Wave 3B:
  - `require_roles(...)` in `backend/app/routers`: `10` (down from `47`)
  - `require_permissions(...)` in `backend/app/routers`: `185` (up from `148`)

## RBAC Permission Migration (Wave 3C complete)
- Completed Wave 3C migration from role guards to permission guards:
  - `backend/app/routers/purchase_recommendations.py`
  - `backend/app/routers/product_settings.py`
  - `backend/app/routers/abc.py`
  - `backend/app/routers/audit_log.py`
- Added DB backfill migration for Wave 3C:
  - `backend/alembic/versions/0034_wave3c_rbac_permission_backfill.py`
- Added new permission codes and seed alignment:
  - `module.purchase_recommendations.read`
  - `module.purchase_recommendations.write`
  - `module.product_settings.read`
  - `module.product_settings.write`
  - `module.abc.read`
  - `module.abc.write`
  - `module.audit_log.read`
- RBAC counters after Wave 3C:
  - `require_roles(...)` in `backend/app/routers`: `0` (down from `10`)
  - `require_permissions(...)` in `backend/app/routers`: `195` (up from `185`)

## Frontend Type Modularization (Wave 4 start)
- Moved auth/user/api error types to `frontend/src/types/auth.ts`.
- `frontend/src/types.ts` now re-exports auth types via stable barrel export.

## Architecture Follow-up
- `ProductFormPage` and `GoodsReceiptPage` are now container-only entry files.
- Main implementation moved to:
  - `frontend/src/pages/product-form/ProductFormWorkspace.tsx`
  - `frontend/src/pages/goods-receipt/GoodsReceiptWorkspace.tsx`
- Operations router common helpers now delegate to operation service modules.
- Reports quantization now delegates to `backend/app/services/reports/aggregation_service.py`.
