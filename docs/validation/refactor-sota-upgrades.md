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

## Refactoring Plan v2 (Wave 1/2 shipped)
- Frontend modularization erweitert:
  - `frontend/src/pages/product-form/*` um dedizierte Hooks (`useProductFormState`, `useProductFormValidation`, `useProductFormSubmit`) und Section-Komponenten.
  - `frontend/src/pages/goods-receipt/*` um dedizierte Hooks (`useGoodsReceiptState`, `useGoodsReceiptItems`, `useGoodsReceiptCompletion`) und Section-Komponenten.
  - Große Seiten mit ViewModel-/Presentational-Layer ergänzt:
    - `frontend/src/pages/GoodsIssuePage.tsx`
    - `frontend/src/pages/StockTransferPage.tsx`
    - `frontend/src/pages/ReportsPage.tsx`
    - neue Module unter `frontend/src/pages/goods-issue/**`, `frontend/src/pages/stock-transfer/**`, `frontend/src/pages/reports/**`.
- Type-domain Layer ergänzt unter `frontend/src/types/**` mit stabilem Legacy-Entrypoint `frontend/src/types.ts`.

## Refactoring Plan v2 (Wave 3 shipped)
- Bootstrap split umgesetzt:
  - `backend/app/bootstrap.py` als kompatibler Einstieg
  - `backend/app/bootstrap_seed.py`
  - `backend/app/bootstrap_permissions.py`
  - `backend/app/bootstrap_roles.py`
- Service-Extraktion umgesetzt:
  - Returns:
    - `backend/app/services/returns/queries.py`
    - `backend/app/services/returns/commands.py`
    - `backend/app/routers/returns.py` nutzt Service-Helper.
  - Goods Receipt:
    - `backend/app/services/operations/goods_receipt_items.py`
    - `backend/app/services/operations/goods_receipt_finalize.py`
    - `backend/app/routers/operations/goods_receipts.py` delegiert Item-/Finalize-Logik.

## Refactoring Plan v2 (Wave 4 shipped)
- CI erweitert:
  - Backend lint gate auf `ruff check app tests`.
  - OpenAPI contract drift guard in CI via `scripts/check_api_contract_drift.sh`.
- Neue Contract-Artefakte:
  - `docs/contracts/openapi.snapshot.json`
- Harness erweitert:
  - `scripts/autonomous_task_harness.sh` führt zusätzlich Ruff-Gates + Contract-Drift-Guard aus.
- Scope/Doku synchronisiert:
  - `scripts/check_refactor_scope_allowlist.sh`
  - `docs/guides/refactor-scope-allowlist.md`
  - `docs/guides/ai-agent-setup.md`
  - `docs/guides/vibe-coding-playbook.md`

## Refactoring Program (Wave 0 instrumentation shipped)
- Added scorecard baseline doc:
  - `docs/validation/engineering-scorecard.md`
- Added reproducible metric collectors:
  - `scripts/collect_complexity_metrics.sh`
  - `scripts/collect_test_flakiness.sh`
  - `scripts/collect_ci_duration.sh`
- Extended runbook with mandatory metric refresh and 9/10 exit gates:
  - `docs/guides/refactor-runbook.md`

## Refactoring Program v2 (Wave 1 follow-up)
- Frontend type split finalized:
  - Domain modules now contain concrete type definitions (no back-reference re-exports).
  - Added UI domain types in `frontend/src/types/ui.ts`.
  - `frontend/src/types.ts` reduced to a compatibility barrel export.

## Refactoring Program v2 (Wave 2 follow-up)
- Workspace mutation logic extracted to dedicated hooks:
  - `frontend/src/pages/product-form/hooks/useProductFormMutations.ts`
  - `frontend/src/pages/goods-receipt/hooks/useGoodsReceiptMutations.ts`
- `ProductFormWorkspace.tsx` and `GoodsReceiptWorkspace.tsx` now delegate mutation/query invalidation logic.
- Workspace view layers extracted into dedicated files:
  - `frontend/src/pages/product-form/ProductFormWorkspaceView.tsx`
  - `frontend/src/pages/goods-receipt/GoodsReceiptWorkspaceView.tsx`
- Thin workspace orchestrators keep stable entry points:
  - `frontend/src/pages/product-form/ProductFormWorkspace.tsx`
  - `frontend/src/pages/goods-receipt/GoodsReceiptWorkspace.tsx`

## Refactoring Program v2 (Wave 5 partial)
- CI now includes E2E flakiness statistics job (20 smoke runs) on pull requests:
  - `.github/workflows/ci.yml` (`e2e_flakiness`)
- Flakiness metrics artifact is published from:
  - `docs/validation/metrics/test-flakiness-latest.md`

## Refactoring Program v2 (Wave 6A shipped)
- Added backend observability foundations:
  - `backend/app/observability/tracing.py`
  - `backend/app/observability/metrics.py`
  - `backend/app/config.py`, `backend/app/main.py`, `backend/app/database.py`
- Added metrics endpoint:
  - `GET /api/metrics`
- Added compose observability profile components:
  - `docker/observability/otel-collector.yml`
  - `docker/observability/prometheus.yml`
  - `docker/observability/grafana/**`
  - `docker-compose.dev.yml` and `docker-compose.prod.yml` profile services
- Trace export is enabled by setting:
  - `OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317`
- Added incident runbooks:
  - `docs/operations/runbooks-api-latency.md`
  - `docs/operations/runbooks-error-spike.md`
  - `docs/operations/runbooks-db-latency.md`
  - `docs/operations/runbooks-idempotency-conflicts.md`
  - `docs/operations/runbooks-auth-rbac-denials.md`

## Refactoring Program v2 (Wave 7A shipped)
- Added k6-based performance harness:
  - `scripts/perf/run_perf_smoke.sh`
  - `scripts/perf/scenarios/*.js`
  - `scripts/perf/assert_budgets.sh`
- Added perf budget docs and metrics artifacts:
  - `docs/validation/perf-budgets.md`
  - `docs/validation/metrics/perf-latest.md`
- CI now runs:
  - PR perf smoke gate (`perf_smoke`)
  - Nightly full perf profile (`perf_nightly`)

## Refactoring Program v2 (Wave 8A shipped)
- Added unified security gate script:
  - `scripts/check_security_gates.sh`
- Added mutation integrity guard:
  - `scripts/check_mutation_integrity.py`
- Added dedicated phase 6 regression tests:
  - `backend/tests/test_idempotency_regressions_phase6.py`
  - `backend/tests/test_audit_mutations_phase6.py`
- Added CI security gate job:
  - `.github/workflows/ci.yml` (`security`) including `pip-audit`, `bandit`, `gitleaks`
- Added documentation:
  - `docs/validation/security-gates.md`

## DirectStock Closeout (Steps 0-4 complete, 2026-02-18)
- Cleanup-first scope isolation completed on `codex/wave6-8-closeout`.
- Scope guard status:
  - `./scripts/check_refactor_scope_allowlist.sh` is green.
- Scorecard metric refresh:
  - `docs/validation/metrics/test-flakiness-latest.md`: `Runs=20`, `Flake rate=0.00%`.
  - `docs/validation/metrics/complexity-latest.md`: refreshed.
  - `docs/validation/metrics/ci-duration-latest.md`: still blocked by GitHub repo access (`HTTP 404` on `gh run list`), script now supports `GH_REPO=<owner/repo>` override and robust `origin` parsing.
- Security gate parity completed:
  - Added `scripts/install_gitleaks.sh`.
  - Added `.gitleaks.toml` (exclude local dependency artifacts only).
  - `./scripts/check_security_gates.sh` now passes locally with `RUN_GITLEAKS=1`.
- Observability activation and verification:
  - Added collector health extension and explicit OTLP bind endpoints (`0.0.0.0`).
  - Added `scripts/observability/smoke.sh` and optional harness mode (`RUN_OBSERVABILITY_SMOKE=1`).
  - Added manual CI entrypoint for observability smoke via `workflow_dispatch` input.
  - Dev/prod compose now default OTLP endpoint to collector and expose collector health port.
  - Dev backend port binding is configurable (`BACKEND_PORT_BIND`), perf uses isolated binding (`PERF_BACKEND_PORT_BIND=18000`).
- Perf artifact hardening:
  - `scripts/perf/run_perf_smoke.sh` now redacts token-like fields from summary JSON outputs.

## Remaining Program Item (Step 5 as Separate Wave)
- Still open by design:
  - Frontend hotspot decomposition (`ReportsPage`, `ProductFormWorkspaceView`, `GoodsReceiptWorkspaceView`).
  - Backend hotspot decomposition (`bootstrap_seed.py` split continuation).
- This remains a dedicated follow-up wave after Steps 0-4 merge and CI acceptance.

## Top-5 Measures (Wave 5+ hardening, in progress)
- Added maintainability guardrails:
  - `scripts/check_file_size_limits.sh`
  - CI integration for size limits (`.github/workflows/ci.yml`, jobs `llm_guards` + `size_guard`)
  - Harness integration (`scripts/autonomous_task_harness.sh`)
- Added LLM golden-task framework:
  - `docs/validation/golden-tasks/manifest.tsv`
  - `docs/validation/golden-tasks/README.md`
  - `scripts/run_golden_tasks.sh`
  - Nightly CI job `golden_tasks_nightly`
  - Report artifact: `docs/validation/metrics/golden-tasks-latest.md`
- Improved CI-duration metric robustness:
  - `scripts/collect_ci_duration.sh` now reports completed sample size explicitly and marks `<20` completed runs as insufficient.
- Strengthened perf budget validity:
  - `scripts/perf/assert_budgets.sh` now fails scenarios with invalid zero samples (`http_reqs=0`, `p95=0`, `p99=0`).
  - `docs/validation/perf-budgets.md` updated with non-zero sample requirement.
- Observability alerts aligned with exported metrics:
  - `docker/observability/alerts.yml` now uses `http_requests_total` and includes latency + RBAC-denial alerts.

## Top-5 Measures (follow-up completion)
- Backend hotspot split completed without API changes:
  - `backend/app/routers/operations/goods_receipts.py` now delegates to:
    - `backend/app/routers/operations/goods_receipts_crud.py`
    - `backend/app/routers/operations/goods_receipts_items.py`
    - `backend/app/routers/operations/goods_receipts_workflow.py`
  - `backend/app/routers/returns.py` now delegates to:
    - `backend/app/routers/returns_common.py`
    - `backend/app/routers/returns_orders.py`
    - `backend/app/routers/returns_items.py`
- Scope guard alignment completed for active branch surface:
  - Allowlist script and guide now include required operational files touched in this wave.
- Verification:
  - `ENFORCE_REFRACTOR_SCOPE=1 ./scripts/autonomous_task_harness.sh` passed.
