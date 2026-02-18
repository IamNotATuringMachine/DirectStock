# Refactor Scope Allowlist (One-PR)

## Ziel
Der Refactor-PR bleibt reviewbar, indem nur geplante Bereiche enthalten sind.

## Erlaubte Bereiche
1. Hygiene/Tooling/CI:
   - `.editorconfig`
   - `.pre-commit-config.yaml`
   - `.github/workflows/ci.yml`
   - `backend/ruff.toml`
   - `frontend/eslint.config.js`
   - `frontend/.prettierrc`
   - `frontend/.prettierignore`
   - `.gitignore`
2. Frontend-Routing + Hotspots:
   - `frontend/src/App.tsx`
   - `frontend/src/components/AppLayout.tsx`
   - `frontend/src/routing/*`
   - `frontend/src/pages/ProductFormPage.tsx`
   - `frontend/src/pages/GoodsReceiptPage.tsx`
   - `frontend/src/pages/product-form/**`
   - `frontend/src/pages/goods-receipt/**`
3. Backend-Router/Services (Wave 1 + Wave 3A + Wave 3B + Wave 3C):
   - `backend/app/routers/operations/**`
   - `backend/app/routers/reports/**`
   - `backend/app/routers/documents.py`
   - `backend/app/routers/customers.py`
   - `backend/app/routers/suppliers.py`
   - `backend/app/routers/shipping.py`
   - `backend/app/routers/returns.py`
   - `backend/app/routers/purchasing.py`
   - `backend/app/routers/warehouses.py`
   - `backend/app/routers/inventory_counts.py`
   - `backend/app/routers/alerts.py`
   - `backend/app/routers/picking.py`
   - `backend/app/routers/workflows.py`
   - `backend/app/routers/inter_warehouse_transfers.py`
   - `backend/app/routers/purchase_recommendations.py`
   - `backend/app/routers/product_settings.py`
   - `backend/app/routers/abc.py`
   - `backend/app/routers/audit_log.py`
   - `backend/app/routers/operations.py` (nur Entfernung)
   - `backend/app/routers/reports.py` (nur Entfernung)
   - `backend/app/services/operations/**`
   - `backend/app/services/reports/**`
   - `backend/app/bootstrap.py`
   - `backend/alembic/versions/0032_wave3a_rbac_permission_backfill.py`
   - `backend/alembic/versions/0033_wave3b_rbac_permission_backfill.py`
   - `backend/alembic/versions/0034_wave3c_rbac_permission_backfill.py`
   - `backend/tests/test_rbac_phase2.py`
   - `backend/tests/test_rbac_permissions_phase5.py`
   - `backend/tests/test_seed.py`
4. Doku/Validierung:
   - `docs/guides/**`
   - `docs/validation/refactor-sota-upgrades.md`
   - `README.md`
   - `AGENTS.md`
5. E2E-Hardening + Agent Harness:
   - `frontend/package.json`
   - `frontend/src/types.ts`
   - `frontend/src/types/**`
   - `frontend/tests/e2e/**`
   - `scripts/run_e2e_isolated.sh`
   - `scripts/check_e2e_hermetic.sh`
   - `scripts/autonomous_task_harness.sh`
   - `scripts/check_refactor_scope_allowlist.sh`

## Nicht erlaubt (ohne expliziten Zusatzgrund)
1. Produktfremde Inhaltspflege (z. B. Obsidian-/Canvas-Dateien, alte Phase-Berichte, Lighthouse-Artefakte).
2. Feature-Änderungen außerhalb ProductForm/GoodsReceipt/Operations/Reports und des E2E-/Harness-Scope.
3. Schema-/API-Breaking-Changes.

## PR-Regel
Jede Datei außerhalb der Allowlist muss im PR-Text unter **"Out-of-scope Ausnahme"** begründet werden.
