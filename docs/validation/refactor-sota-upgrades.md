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
- `docs/validation/metrics/ci-duration-latest.md`: access path stabilized via `GH_REPO=<owner/repo>` override and robust `origin` parsing (no longer blocked by repo-resolution drift).
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

## Remaining Program Item (Step 5 as Separate Wave) - Closed (2026-02-19)
- Dedicated hotspot follow-up wave completed:
  - frontend hotspots reduced and stabilized (`ReportsPage`, `ProductFormWorkspaceView`, `GoodsReceiptWorkspaceView`).
  - backend hotspot continuation completed (`bootstrap_seed.py`).
- Current hotspot LOC snapshot:
  - `frontend/src/pages/ReportsPage.tsx`: 170
  - `frontend/src/pages/product-form/ProductFormWorkspaceView.tsx`: 84
  - `frontend/src/pages/goods-receipt/GoodsReceiptWorkspaceView.tsx`: 107
  - `backend/app/bootstrap_seed.py`: 333
- Full-repo size debt cleanup completed by decomposing `frontend/src/styles.css` into focused modules under `frontend/src/styles/*.css`.
- Verification: `SIZE_GUARD_MODE=all ./scripts/check_file_size_limits.sh` passes.

## Top-5 Measures (Wave 5+ hardening, closed 2026-02-19)
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

## LLM-First Upgrade (Wave AGENTS-v2, 2026-02-18)
- Upgraded root agent policy with explicit autonomy decision matrix and escalation triggers:
  - `AGENTS.md`
- Added standardized handoff and incident artifacts:
  - `docs/agents/handoff-protocol.md`
  - `docs/agents/incident-log.md`
  - `docs/agents/handoff.schema.json`
- Added LLM navigation context map and domain entrypoints:
  - `docs/agents/repo-map.md`
  - `docs/agents/change-playbooks.md`
  - `docs/agents/entrypoints/*`
- Added MCP stack strategy guide with balanced-security snippets:
  - `docs/guides/mcp-stack-strategy.md`
- Added agent governance debt scanner:
  - `scripts/agent_governance_check.sh`
  - output: `docs/validation/metrics/agent-governance-latest.md`
- Harness integration for governance checks:
  - `scripts/autonomous_task_harness.sh` (`RUN_AGENT_GOVERNANCE=1`)
- Tightened chunking policy from `700/450` to `500/350`:
  - `scripts/check_file_size_limits.sh`
  - `scripts/collect_complexity_metrics.sh`

## Hotspot Refactor Slice (Stock Transfer, 2026-02-18)
- Decomposed stock transfer page into orchestration + flow hook + view components:
  - `frontend/src/pages/stock-transfer/StockTransferPageContainer.tsx` (reduced to orchestration layer)
  - `frontend/src/pages/stock-transfer/hooks/useStockTransferFlow.ts`
  - `frontend/src/pages/stock-transfer/StockTransferView.tsx`
  - `frontend/src/pages/stock-transfer/components/StockTransferDocumentPanel.tsx`
  - `frontend/src/pages/stock-transfer/components/StockTransferItemsPanel.tsx`
- Validation status:
  - frontend lint/test/build passed
  - golden tasks smoke run reached 100% first-pass success
  - governance debt snapshot reached `Debt detected: 0`

## Hotspot Refactor Slice (Goods Issue, 2026-02-18)
- Decomposed goods-issue page into orchestration + view split + panel components:
  - `frontend/src/pages/goods-issue/GoodsIssuePageContainer.tsx` (reduced to orchestration/state layer)
  - `frontend/src/pages/goods-issue/GoodsIssueView.tsx`
  - `frontend/src/pages/goods-issue/components/GoodsIssueDocumentPanel.tsx`
  - `frontend/src/pages/goods-issue/components/GoodsIssueItemsPanel.tsx`
- Validation status:
  - frontend lint/test/build passed
  - changed-scope size guard passed (`SIZE_GUARD_MODE=changed`)
  - complexity score improved (`Page/router files over 350 LOC`: `32 -> 31`)
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

## Hotspot Refactor Slice (Shipping, 2026-02-18)
- Decomposed shipping page into orchestration + view + focused UI panels:
  - `frontend/src/pages/shipping/ShippingPageContainer.tsx` (reduced to orchestration/state layer)
  - `frontend/src/pages/shipping/ShippingView.tsx`
  - `frontend/src/pages/shipping/model.ts`
  - `frontend/src/pages/shipping/components/ShippingFiltersBar.tsx`
  - `frontend/src/pages/shipping/components/ShippingCreatePanel.tsx`
  - `frontend/src/pages/shipping/components/ShippingShipmentsList.tsx`
  - `frontend/src/pages/shipping/components/ShippingShipmentDetails.tsx`
- Validation status:
  - frontend lint/test/build passed
  - changed-scope size guard passed (`SIZE_GUARD_MODE=changed`)
  - scope allowlist check passed
  - governance debt check passed
  - complexity score improved (`Production files over 500 LOC`: `11 -> 10`, `Page/router files over 350 LOC`: `31 -> 30`)
  - targeted shipping e2e run is currently blocked in local isolated runner by login-page availability (`data-testid=\"login-username\"` timeout)

## Hotspot Refactor Slice (Purchasing, 2026-02-19)
- Decomposed purchasing page into orchestration + view + tab/panel components:
  - `frontend/src/pages/purchasing/PurchasingPageContainer.tsx` (reduced to orchestration/state layer)
  - `frontend/src/pages/purchasing/PurchasingView.tsx`
  - `frontend/src/pages/purchasing/model.ts`
  - `frontend/src/pages/purchasing/components/PurchasingTabs.tsx`
  - `frontend/src/pages/purchasing/components/PurchasingOrdersSidebar.tsx`
  - `frontend/src/pages/purchasing/components/PurchasingOrderDetails.tsx`
  - `frontend/src/pages/purchasing/components/PurchasingAbcTab.tsx`
  - `frontend/src/pages/purchasing/components/PurchasingRecommendationsTab.tsx`
- Validation status:
  - frontend lint/test/build passed
  - changed-scope size guard passed (`SIZE_GUARD_MODE=changed`)
  - scope allowlist check passed
  - governance debt check passed
  - complexity score improved (`Production files over 500 LOC`: `10 -> 9`, `Page/router files over 350 LOC`: `30 -> 29`)

## Hotspot Refactor Slice (Inter-Warehouse Transfer, 2026-02-19)
- Decomposed inter-warehouse transfer page into orchestration + view + sidebar/detail modules:
  - `frontend/src/pages/inter-warehouse-transfer/InterWarehouseTransferPageContainer.tsx` (reduced to orchestration/state layer)
  - `frontend/src/pages/inter-warehouse-transfer/InterWarehouseTransferView.tsx`
  - `frontend/src/pages/inter-warehouse-transfer/scanResolvers.ts`
  - `frontend/src/pages/inter-warehouse-transfer/components/InterWarehouseTransferSidebar.tsx`
  - `frontend/src/pages/inter-warehouse-transfer/components/InterWarehouseTransferDetailsPanel.tsx`
- Validation status:
  - frontend lint/test/build passed
  - changed-scope size guard passed (`SIZE_GUARD_MODE=changed`)
  - scope allowlist check passed
  - governance debt check passed
  - complexity score improved (`Production files over 500 LOC`: `9 -> 8`, `Page/router files over 350 LOC`: `29 -> 28`)
  - aligned E2E selector contract by exposing `data-testid="iwt-selected-status"` in transfer header status

## Hotspot Refactor Slice (Returns, 2026-02-19)
- Decomposed returns page into orchestration + view + panel modules:
  - `frontend/src/pages/returns/ReturnsPageContainer.tsx` (reduced to orchestration/state layer)
  - `frontend/src/pages/returns/ReturnsView.tsx`
  - `frontend/src/pages/returns/model.ts`
  - `frontend/src/pages/returns/components/ReturnsOrdersPanel.tsx`
  - `frontend/src/pages/returns/components/ReturnsItemsPanel.tsx`
  - `frontend/src/pages/returns/components/ReturnsWorkflowPanel.tsx`
- Validation status:
  - frontend lint/test/build passed
  - changed-scope size guard passed (`SIZE_GUARD_MODE=changed`)
  - scope allowlist check passed
  - governance debt check passed
  - complexity score improved (`Production files over 500 LOC`: `8 -> 7`, `Page/router files over 350 LOC`: `28 -> 27`)

## Hotspot Refactor Slice (Inventory Counts, 2026-02-19)
- Decomposed inventory-count page into orchestration + view + focused UI panels:
  - `frontend/src/pages/InventoryCountPage.tsx` (reduced to orchestration/state layer)
  - `frontend/src/pages/inventory-count/InventoryCountView.tsx`
  - `frontend/src/pages/inventory-count/components/InventoryCountSessionsPanel.tsx`
  - `frontend/src/pages/inventory-count/components/InventoryCountActionsPanel.tsx`
  - `frontend/src/pages/inventory-count/components/InventoryCountQuickCapturePanel.tsx`
  - `frontend/src/pages/inventory-count/components/InventoryCountItemsTable.tsx`
- Scope governance update:
  - allowlist script/doc extended for inventory-count paths:
    - `scripts/check_refactor_scope_allowlist.sh`
    - `docs/guides/refactor-scope-allowlist.md`
- Validation status:
  - frontend lint/test/build passed
  - changed-scope size guard passed (`SIZE_GUARD_MODE=changed`)
  - scope allowlist check passed
  - governance debt check passed
  - complexity score improved (`Production files over 500 LOC`: `7 -> 6`, `Page/router files over 350 LOC`: `27 -> 26`)

## Hotspot Refactor Slice (Warehouse, 2026-02-19)
- Decomposed warehouse page into orchestration + view + column panels:
  - `frontend/src/pages/WarehousePage.tsx` (reduced to orchestration/state layer)
  - `frontend/src/pages/warehouse/WarehouseView.tsx`
  - `frontend/src/pages/warehouse/model.ts`
  - `frontend/src/pages/warehouse/components/WarehouseWarehousesPanel.tsx`
  - `frontend/src/pages/warehouse/components/WarehouseZonesPanel.tsx`
  - `frontend/src/pages/warehouse/components/WarehouseBinsPanel.tsx`
- Scope governance update:
  - allowlist script/doc extended for warehouse paths:
    - `scripts/check_refactor_scope_allowlist.sh`
    - `docs/guides/refactor-scope-allowlist.md`
- Validation status:
  - frontend lint/test/build passed
  - changed-scope size guard passed (`SIZE_GUARD_MODE=changed`)
  - scope allowlist check passed
  - governance debt check passed
  - complexity score improved (`Production files over 500 LOC`: `6 -> 5`, `Page/router files over 350 LOC`: `26 -> 25`)

## Hotspot Refactor Slice (Users, 2026-02-19)
- Decomposed users page into orchestration + view + focused table/modal components:
  - `frontend/src/pages/UsersPage.tsx` (reduced to orchestration/state layer)
  - `frontend/src/pages/users/UsersView.tsx`
  - `frontend/src/pages/users/model.ts`
  - `frontend/src/pages/users/components/UsersHeader.tsx`
  - `frontend/src/pages/users/components/UsersTable.tsx`
  - `frontend/src/pages/users/components/UsersPasswordModal.tsx`
- Scope governance update:
  - allowlist script/doc extended for users paths:
    - `scripts/check_refactor_scope_allowlist.sh`
    - `docs/guides/refactor-scope-allowlist.md`
- Validation status:
  - frontend lint/test/build passed
  - changed-scope size guard passed (`SIZE_GUARD_MODE=changed`)
  - scope allowlist check passed
  - governance debt check passed
  - complexity score improved (`Production files over 500 LOC`: `5 -> 5`, `Page/router files over 350 LOC`: `25 -> 24`)

## Hotspot Refactor Slice (Sales Orders, 2026-02-19)
- Decomposed sales-orders page into orchestration + dedicated view layer:
  - `frontend/src/pages/SalesOrdersPage.tsx` (reduced to orchestration/state layer)
  - `frontend/src/pages/sales-orders/SalesOrdersView.tsx`
- Scope governance update:
  - allowlist script/doc extended for sales-orders paths:
    - `scripts/check_refactor_scope_allowlist.sh`
    - `docs/guides/refactor-scope-allowlist.md`
- Validation status:
  - frontend lint/test/build passed
  - changed-scope size guard passed (`SIZE_GUARD_MODE=changed`)
  - scope allowlist check passed
  - governance debt check passed
  - complexity score improved (`Production files over 500 LOC`: `5 -> 5`, `Page/router files over 350 LOC`: `24 -> 23`)

## Hotspot Refactor Slice (Products, 2026-02-19)
- Decomposed products page into orchestration + dedicated view/model layer:
  - `frontend/src/pages/ProductsPage.tsx` (reduced to orchestration/state layer)
  - `frontend/src/pages/products/ProductsView.tsx`
  - `frontend/src/pages/products/model.ts`
- Scope governance update:
  - allowlist script/doc extended for products paths:
    - `scripts/check_refactor_scope_allowlist.sh`
    - `docs/guides/refactor-scope-allowlist.md`
- Validation status:
  - frontend lint/test/build passed
  - changed-scope size guard passed (`SIZE_GUARD_MODE=changed`)
  - scope allowlist check passed
  - governance debt check passed
  - complexity score improved (`Production files over 500 LOC`: `5 -> 5`, `Page/router files over 350 LOC`: `23 -> 22`)

## Hotspot Refactor Slice (Scanner, 2026-02-19)
- Decomposed scanner page into orchestration + dedicated view/model layer:
  - `frontend/src/pages/ScannerPage.tsx` (reduced to orchestration/state layer)
  - `frontend/src/pages/scanner/ScannerView.tsx`
  - `frontend/src/pages/scanner/model.ts`
- Scope governance update:
  - allowlist script/doc extended for scanner paths:
    - `scripts/check_refactor_scope_allowlist.sh`
    - `docs/guides/refactor-scope-allowlist.md`
- Validation status:
  - frontend lint/test/build passed
  - changed-scope size guard passed (`SIZE_GUARD_MODE=changed`)
  - scope allowlist check passed
  - governance debt check passed
  - complexity score improved (`Production files over 500 LOC`: `5 -> 5`, `Page/router files over 350 LOC`: `22 -> 21`)

## Hotspot Refactor Slice (Alerts, 2026-02-19)
- Decomposed alerts page into orchestration + dedicated view/model layer:
  - `frontend/src/pages/AlertsPage.tsx` (reduced to orchestration/state layer)
  - `frontend/src/pages/alerts/AlertsView.tsx`
  - `frontend/src/pages/alerts/model.ts`
- Scope governance update:
  - allowlist script/doc extended for alerts paths:
    - `scripts/check_refactor_scope_allowlist.sh`
    - `docs/guides/refactor-scope-allowlist.md`
- Validation status:
  - frontend lint/test/build passed
  - changed-scope size guard passed (`SIZE_GUARD_MODE=changed`)
  - scope allowlist check passed
  - governance debt check passed
  - complexity score improved (`Production files over 500 LOC`: `5 -> 5`, `Page/router files over 350 LOC`: `21 -> 20`)

## Hotspot Refactor Slice (Inventory, 2026-02-19)
- Decomposed inventory page into orchestration + dedicated view layer:
  - `frontend/src/pages/InventoryPage.tsx` (reduced to orchestration/state layer)
  - `frontend/src/pages/inventory/InventoryView.tsx`
- Scope governance update:
  - allowlist script/doc extended for inventory paths:
    - `scripts/check_refactor_scope_allowlist.sh`
    - `docs/guides/refactor-scope-allowlist.md`
- Validation status:
  - frontend lint/test/build passed
  - changed-scope size guard passed (`SIZE_GUARD_MODE=changed`)
  - scope allowlist check passed
  - governance debt check passed
  - complexity score improved (`Production files over 500 LOC`: `5 -> 5`, `Page/router files over 350 LOC`: `20 -> 19`)

## Hotspot Refactor Slice (Customers, 2026-02-19)
- Decomposed customers page into orchestration + dedicated view layer:
  - `frontend/src/pages/CustomersPage.tsx` (reduced to orchestration/state layer)
  - `frontend/src/pages/customers/CustomersView.tsx`
- Scope governance update:
  - allowlist script/doc extended for customers paths:
    - `scripts/check_refactor_scope_allowlist.sh`
    - `docs/guides/refactor-scope-allowlist.md`
- Validation status:
  - frontend lint/test/build passed
  - changed-scope size guard passed (`SIZE_GUARD_MODE=changed`)
  - scope allowlist check passed
  - governance debt check passed
  - complexity score improved (`Production files over 500 LOC`: `5 -> 5`, `Page/router files over 350 LOC`: `19 -> 18`)

## Hotspot Refactor Slice (Picking, 2026-02-19)
- Decomposed picking page into orchestration + dedicated view layer:
  - `frontend/src/pages/PickingPage.tsx` (reduced to orchestration/state layer)
  - `frontend/src/pages/picking/PickingView.tsx`
- Layout contract hardening for existing UI checks:
  - explicit class hooks retained/added: `panel-header`, `warehouse-grid`, `subpanel`, `table-wrap`
- Scope governance update:
  - allowlist script/doc extended for picking paths:
    - `scripts/check_refactor_scope_allowlist.sh`
    - `docs/guides/refactor-scope-allowlist.md`
- Validation status:
  - frontend lint/test/build passed
  - changed-scope size guard passed (`SIZE_GUARD_MODE=changed`)
  - scope allowlist check passed
  - governance debt check passed
  - complexity score improved (`Production files over 500 LOC`: `5 -> 5`, `Page/router files over 350 LOC`: `18 -> 17`)

## Hotspot Refactor Slice (Goods Receipt Flow Hook, 2026-02-19)
- Extracted flow side-effect/default handling from goods-receipt flow hook into dedicated hooks:
  - `frontend/src/pages/goods-receipt/hooks/useGoodsReceiptFlow.ts` (reduced to orchestration)
  - `frontend/src/pages/goods-receipt/hooks/useGoodsReceiptDefaults.ts`
  - `frontend/src/pages/goods-receipt/hooks/useGoodsReceiptSyncEffects.ts`
- Validation status:
  - frontend lint/test/build passed
  - changed-scope size guard passed (`SIZE_GUARD_MODE=changed`)
  - scope allowlist check passed
  - governance debt check passed
  - complexity score improved (`Production files over 500 LOC`: `5 -> 5`, `Page/router files over 350 LOC`: `17 -> 16`)

## Hotspot Refactor Slice (Goods Receipt Item Entry, 2026-02-19)
- Decomposed item-entry panel into orchestration + focused subcomponents:
  - `frontend/src/pages/goods-receipt/components/GoodsReceiptItemEntrySection.tsx` (482 LOC -> 22 LOC)
  - `frontend/src/pages/goods-receipt/components/GoodsReceiptFlowPanel.tsx`
  - `frontend/src/pages/goods-receipt/components/GoodsReceiptManualItemForm.tsx`
  - `frontend/src/pages/goods-receipt/components/GoodsReceiptReceiptActions.tsx`
- Validation status:
  - frontend lint/test/build passed
  - changed-scope size guard passed (`SIZE_GUARD_MODE=changed`)
  - scope allowlist check passed
  - governance debt check passed
  - complexity score improved (`Production files over 500 LOC`: `5 -> 5`, `Page/router files over 350 LOC`: `16 -> 15`)

## Hotspot Refactor Slice (Product Form Workspace VM, 2026-02-19)
- Decomposed product-form workspace view-model into orchestration + focused hooks/modules:
  - `frontend/src/pages/product-form/hooks/useProductFormWorkspaceVm.ts` (558 LOC -> 308 LOC)
  - `frontend/src/pages/product-form/hooks/productFormWorkspaceMeta.ts`
  - `frontend/src/pages/product-form/hooks/useProductFormWorkspaceEffects.ts`
  - `frontend/src/pages/product-form/hooks/useProductFormWorkspaceMutations.ts`
  - `frontend/src/pages/product-form/hooks/useProductFormWorkspaceHandlers.ts`
- Validation status:
  - frontend lint/test/build passed
  - changed-scope size guard passed (`SIZE_GUARD_MODE=changed`)
  - scope allowlist check passed
  - governance debt check passed
  - complexity score improved (`Production files over 500 LOC`: `5 -> 4`, `Page/router files over 350 LOC`: `15 -> 14`)

## Hotspot Refactor Slice (Goods Issue Router Workflow, 2026-02-19)
- Extracted goods-issue completion transaction logic into dedicated workflow module:
  - `backend/app/routers/operations/goods_issues.py` (395 LOC -> 282 LOC)
  - `backend/app/routers/operations/goods_issues_workflow.py`
- Router now remains orchestration-only for the completion endpoint and delegates stock/serial/movement mutation flow to the workflow helper.
- Validation status:
  - backend ruff check passed (`cd backend && .venv/bin/ruff check --config ruff.toml app tests`)
  - backend pytest passed (`cd backend && .venv/bin/python -m pytest -q`; 139 passed)
  - changed-scope size guard passed (`SIZE_GUARD_MODE=changed`)
  - scope allowlist check passed
  - governance debt check passed
  - complexity score improved (`Production files over 500 LOC`: `4 -> 4`, `Page/router files over 350 LOC`: `14 -> 13`)

## Hotspot Refactor Slice (Inter-Warehouse Transfer Router Workflow, 2026-02-19)
- Extracted dispatch/receive transaction flow into dedicated workflow module:
  - `backend/app/routers/inter_warehouse_transfers.py` (502 LOC -> 302 LOC)
  - `backend/app/routers/inter_warehouse_transfers_workflow.py`
- Scope governance update:
  - allowlist script/doc extended for workflow module path:
    - `scripts/check_refactor_scope_allowlist.sh`
    - `docs/guides/refactor-scope-allowlist.md`
- Validation status:
  - backend ruff check passed (`cd backend && .venv/bin/ruff check --config ruff.toml app tests`)
  - backend pytest passed (`cd backend && .venv/bin/python -m pytest -q`; 139 passed)
  - changed-scope size guard passed (`SIZE_GUARD_MODE=changed`)
  - scope allowlist check passed
  - governance debt check passed
  - complexity score improved (`Production files over 500 LOC`: `4 -> 3`, `Page/router files over 350 LOC`: `13 -> 12`)

## Hotspot Refactor Slice (Operations Common Decomposition, 2026-02-19)
- Decomposed `operations/common.py` into dedicated mapper/receipt helper modules:
  - `backend/app/routers/operations/common.py` (521 LOC -> 266 LOC)
  - `backend/app/routers/operations/response_mappers.py`
  - `backend/app/routers/operations/receipt_helpers.py`
- `common.py` now acts as shared orchestration/export surface for router modules while heavy response and receipt helper logic is split into focused files.
- Validation status:
  - backend ruff check passed (`cd backend && .venv/bin/ruff check --config ruff.toml app tests`)
  - backend pytest passed (`cd backend && .venv/bin/python -m pytest -q`; 139 passed)
  - changed-scope size guard passed (`SIZE_GUARD_MODE=changed`)
  - scope allowlist check passed
  - governance debt check passed
  - complexity score improved (`Production files over 500 LOC`: `3 -> 2`, `Page/router files over 350 LOC`: `12 -> 11`)

## Hotspot Refactor Slice (Frontend Operations API Modularization, 2026-02-19)
- Split monolithic operations service into domain modules with stable compatibility barrel:
  - `frontend/src/services/operationsApi.ts` (607 LOC -> 3 LOC)
  - `frontend/src/services/operations-api/offlineMappers.ts`
  - `frontend/src/services/operations-api/goodsReceiptsApi.ts`
  - `frontend/src/services/operations-api/goodsIssuesApi.ts`
  - `frontend/src/services/operations-api/stockTransfersApi.ts`
- Scope governance update:
  - allowlist script/doc extended for operations service module paths:
    - `scripts/check_refactor_scope_allowlist.sh`
    - `docs/guides/refactor-scope-allowlist.md`
- Validation status:
  - frontend lint/test/build passed
  - changed-scope size guard passed (`SIZE_GUARD_MODE=changed`)
  - scope allowlist check passed
  - governance debt check passed
  - complexity score improved (`Production files over 500 LOC`: `2 -> 1`, `Page/router files over 350 LOC`: `11 -> 11`)

## Hotspot Refactor Slice (Sales Orders Router Decomposition, 2026-02-19)
- Extracted pricing/customer/PDF helper logic from sales-orders router into dedicated helper module:
  - `backend/app/routers/sales_orders.py` (495 LOC -> 271 LOC)
  - `backend/app/routers/sales_orders_helpers.py`
- Scope governance update:
  - allowlist script/doc extended for sales-orders helper path:
    - `scripts/check_refactor_scope_allowlist.sh`
    - `docs/guides/refactor-scope-allowlist.md`
- Validation status:
  - backend ruff check passed (`cd backend && .venv/bin/ruff check --config ruff.toml app tests`)
  - backend pytest passed (`cd backend && .venv/bin/python -m pytest -q`; 139 passed)
  - changed-scope size guard passed (`SIZE_GUARD_MODE=changed`)
  - scope allowlist check passed
  - governance debt check passed
  - complexity score improved (`Production files over 500 LOC`: `1 -> 1`, `Page/router files over 350 LOC`: `11 -> 10`)

## Hotspot Refactor Slice (Reports Analytics KPI Split, 2026-02-19)
- Extracted the KPI analytics endpoint into a dedicated reports module:
  - `backend/app/routers/reports/analytics_reports.py` (495 LOC -> 321 LOC)
  - `backend/app/routers/reports/analytics_kpis_report.py`
  - `backend/app/routers/reports/__init__.py` updated for route registration side effect.
- Validation status:
  - backend ruff check passed (`cd backend && .venv/bin/ruff check --config ruff.toml app tests`)
  - backend pytest passed (`cd backend && .venv/bin/python -m pytest -q`; 139 passed)
  - changed-scope size guard passed (`SIZE_GUARD_MODE=changed`)
  - scope allowlist check passed
  - governance debt check passed
  - complexity score improved (`Production files over 500 LOC`: `1 -> 1`, `Page/router files over 350 LOC`: `10 -> 9`)

## Hotspot Refactor Slice (Inventory Counts Router Workflow, 2026-02-19)
- Extracted generate/complete inventory-count transaction flows into a dedicated workflow module:
  - `backend/app/routers/inventory_counts.py` (492 LOC -> 338 LOC)
  - `backend/app/routers/inventory_counts_workflow.py`
- Scope governance update:
  - allowlist script/doc extended for inventory-count workflow path:
    - `scripts/check_refactor_scope_allowlist.sh`
    - `docs/guides/refactor-scope-allowlist.md`
- Validation status:
  - backend ruff check passed (`cd backend && .venv/bin/ruff check --config ruff.toml app tests`)
  - backend pytest passed (`cd backend && .venv/bin/python -m pytest -q`; 139 passed)
  - changed-scope size guard passed (`SIZE_GUARD_MODE=changed`)
  - scope allowlist check passed
  - governance debt check passed
  - complexity score improved (`Production files over 500 LOC`: `1 -> 1`, `Page/router files over 350 LOC`: `9 -> 8`)

## Hotspot Refactor Slice (Inventory Router Query Split, 2026-02-19)
- Decomposed inventory router query logic into focused query modules:
  - `backend/app/routers/inventory.py` (487 LOC -> 118 LOC)
  - `backend/app/routers/inventory_queries.py`
  - `backend/app/routers/inventory_batch_queries.py`
- Scope governance update:
  - allowlist script/doc extended for inventory query module paths:
    - `scripts/check_refactor_scope_allowlist.sh`
    - `docs/guides/refactor-scope-allowlist.md`
- Validation status:
  - backend ruff check passed (`cd backend && .venv/bin/ruff check --config ruff.toml app tests`)
  - backend pytest passed (`cd backend && .venv/bin/python -m pytest -q`; 139 passed)
  - changed-scope size guard passed (`SIZE_GUARD_MODE=changed`)
  - scope allowlist check passed
  - governance debt check passed
  - complexity score improved (`Production files over 500 LOC`: `1 -> 1`, `Page/router files over 350 LOC`: `8 -> 7`)

## Hotspot Refactor Slice (Shipping Router Workflow Split, 2026-02-19)
- Decomposed shipping router into orchestration + helpers + label workflow module:
  - `backend/app/routers/shipping.py` (484 LOC -> 289 LOC)
  - `backend/app/routers/shipping_helpers.py`
  - `backend/app/routers/shipping_workflow.py`
- Scope governance update:
  - allowlist script/doc extended for shipping helper/workflow paths:
    - `scripts/check_refactor_scope_allowlist.sh`
    - `docs/guides/refactor-scope-allowlist.md`
- Validation status:
  - backend ruff check passed (`cd backend && .venv/bin/ruff check --config ruff.toml app tests`)
  - backend pytest passed (`cd backend && .venv/bin/python -m pytest -q`; 139 passed)
  - changed-scope size guard passed (`SIZE_GUARD_MODE=changed`)
  - scope allowlist check passed
  - governance debt check passed
  - complexity score improved (`Production files over 500 LOC`: `1 -> 1`, `Page/router files over 350 LOC`: `7 -> 6`)

## Hotspot Refactor Slice (Purchasing Router Workflow Split, 2026-02-19)
- Decomposed purchasing router into orchestration + shared helpers + status workflow module:
  - `backend/app/routers/purchasing.py` (476 LOC -> 313 LOC)
  - `backend/app/routers/purchasing_helpers.py`
  - `backend/app/routers/purchasing_workflow.py`
- Scope governance update:
  - allowlist script/doc extended for purchasing helper/workflow paths:
    - `scripts/check_refactor_scope_allowlist.sh`
    - `docs/guides/refactor-scope-allowlist.md`
- Validation status:
  - backend ruff check passed (`cd backend && .venv/bin/ruff check --config ruff.toml app tests`)
  - backend pytest passed (`cd backend && .venv/bin/python -m pytest -q`; 139 passed)
  - changed-scope size guard passed (`SIZE_GUARD_MODE=changed`)
  - scope allowlist check passed
  - governance debt check passed
  - complexity score improved (`Production files over 500 LOC`: `1 -> 1`, `Page/router files over 350 LOC`: `6 -> 5`)

## Hotspot Refactor Slice (Invoices Router Helper Split, 2026-02-19)
- Decomposed invoices router into orchestration + dedicated helper module:
  - `backend/app/routers/invoices.py` (474 LOC -> 294 LOC)
  - `backend/app/routers/invoices_helpers.py`
- Scope governance update:
  - allowlist script/doc extended for invoices router/helper paths:
    - `scripts/check_refactor_scope_allowlist.sh`
    - `docs/guides/refactor-scope-allowlist.md`
- Validation status:
  - backend ruff check passed (`cd backend && .venv/bin/ruff check --config ruff.toml app tests`)
  - backend pytest passed (`cd backend && .venv/bin/python -m pytest -q`; 139 passed)
  - changed-scope size guard passed (`SIZE_GUARD_MODE=changed`)
  - scope allowlist check passed
  - governance debt check passed
  - complexity score improved (`Production files over 500 LOC`: `1 -> 1`, `Page/router files over 350 LOC`: `5 -> 4`)

## Hotspot Refactor Slice (External API Router Workflow Split, 2026-02-19)
- Decomposed external API router into orchestration + helper + command workflow modules:
  - `backend/app/routers/external_api.py` (442 LOC -> 324 LOC)
  - `backend/app/routers/external_api_helpers.py`
  - `backend/app/routers/external_api_workflow.py`
- Scope governance update:
  - allowlist script/doc extended for external API helper/workflow paths:
    - `scripts/check_refactor_scope_allowlist.sh`
    - `docs/guides/refactor-scope-allowlist.md`
- Validation status:
  - backend ruff check passed (`cd backend && .venv/bin/ruff check --config ruff.toml app tests`)
  - backend pytest passed (`cd backend && .venv/bin/python -m pytest -q`; 139 passed)
  - changed-scope size guard passed (`SIZE_GUARD_MODE=changed`)
  - scope allowlist check passed
  - governance debt check passed
  - complexity score improved (`Production files over 500 LOC`: `1 -> 1`, `Page/router files over 350 LOC`: `4 -> 3`)

## Hotspot Refactor Slice (Customers Router Helper Split, 2026-02-19)
- Decomposed customers router into orchestration + shared helper module:
  - `backend/app/routers/customers.py` (422 LOC -> 330 LOC)
  - `backend/app/routers/customers_helpers.py`
- Scope governance update:
  - allowlist script/doc extended for customers helper path:
    - `scripts/check_refactor_scope_allowlist.sh`
    - `docs/guides/refactor-scope-allowlist.md`
- Validation status:
  - backend ruff check passed (`cd backend && .venv/bin/ruff check --config ruff.toml app tests`)
  - backend pytest passed (`cd backend && .venv/bin/python -m pytest -q`; 139 passed)
  - changed-scope size guard passed (`SIZE_GUARD_MODE=changed`)
  - scope allowlist check passed
  - governance debt check passed
  - complexity score improved (`Production files over 500 LOC`: `1 -> 1`, `Page/router files over 350 LOC`: `3 -> 2`)

## Hotspot Refactor Slice (Stock Transfers Router Workflow Split, 2026-02-19)
- Decomposed stock-transfer router into orchestration + completion workflow module:
  - `backend/app/routers/operations/stock_transfers.py` (423 LOC -> 265 LOC)
  - `backend/app/routers/operations/stock_transfers_workflow.py`
- Validation status:
  - backend ruff check passed (`cd backend && .venv/bin/ruff check --config ruff.toml app tests`)
  - backend pytest passed (`cd backend && .venv/bin/python -m pytest -q`; 139 passed)
  - changed-scope size guard passed (`SIZE_GUARD_MODE=changed`)
  - scope allowlist check passed
  - governance debt check passed
  - complexity score improved (`Production files over 500 LOC`: `1 -> 1`, `Page/router files over 350 LOC`: `2 -> 1`)

## Hotspot Refactor Slice (Warehouses Router Helper/Workflow Split, 2026-02-19)
- Decomposed warehouses router into orchestration + helper + workflow modules:
  - `backend/app/routers/warehouses.py` (433 LOC -> 338 LOC)
  - `backend/app/routers/warehouses_helpers.py`
  - `backend/app/routers/warehouses_workflow.py`
- Scope governance update:
  - allowlist script/doc extended for warehouses helper/workflow paths:
    - `scripts/check_refactor_scope_allowlist.sh`
    - `docs/guides/refactor-scope-allowlist.md`
- Validation status:
  - backend ruff check passed (`cd backend && .venv/bin/ruff check --config ruff.toml app tests`)
  - backend pytest passed (`cd backend && .venv/bin/python -m pytest -q`; 139 passed)
  - changed-scope size guard passed (`SIZE_GUARD_MODE=changed`)
  - scope allowlist check passed
  - governance debt check passed
  - complexity score improved (`Production files over 500 LOC`: `1 -> 1`, `Page/router files over 350 LOC`: `1 -> 0`)

## Hotspot Refactor Slice (Frontend Type Domain Split, 2026-02-19)
- Replaced monolithic type entrypoint with modular domain files and stable compatibility barrels:
  - `frontend/src/types.ts` (1245 LOC -> 2 LOC)
  - `frontend/src/types/domain.ts` (1244 LOC -> 5 LOC)
  - `frontend/src/types/domain-master.ts`
  - `frontend/src/types/domain-inventory.ts`
  - `frontend/src/types/domain-ops.ts`
  - `frontend/src/types/domain-reports.ts`
  - `frontend/src/types/domain-commerce.ts`
- Validation status:
  - frontend lint passed (`cd frontend && npm run lint`)
  - frontend tests passed (`cd frontend && npm run test`; 13 files, 45 tests)
  - frontend build passed (`cd frontend && npm run build`)
  - changed-scope size guard passed (`SIZE_GUARD_MODE=changed`)
  - scope allowlist check passed
  - governance debt check passed
  - complexity score improved (`Production files over 500 LOC`: `1 -> 0`, `Page/router files over 350 LOC`: `0 -> 0`)

## MCP Readiness Automation Slice (2026-02-19)
- Added reproducible MCP preflight probe and metrics artifact generation:
  - `scripts/check_mcp_readiness.sh`
  - output: `docs/validation/metrics/mcp-readiness-latest.md`
- Integrated optional harness support:
  - `scripts/autonomous_task_harness.sh` (`RUN_MCP_READINESS=1`, `MCP_PROBE_ALLOW_BLOCKED=1`)
- Extended CI manual trigger path for MCP preflight:
  - `.github/workflows/ci.yml` (`run_mcp_readiness` input + `mcp_readiness` job artifact upload)
- Updated MCP strategy documentation:
  - `docs/guides/mcp-stack-strategy.md`
- Scope governance update:
  - `scripts/check_refactor_scope_allowlist.sh`
  - `docs/guides/refactor-scope-allowlist.md`
- Validation status:
  - bash syntax check passed (`bash -n scripts/check_mcp_readiness.sh scripts/autonomous_task_harness.sh scripts/agent_governance_check.sh`)
  - changed-scope size guard passed (`SIZE_GUARD_MODE=changed`)
  - scope allowlist check passed
  - governance debt check passed

## Governance Evidence + MCP Preflight Hardening (2026-02-19)
- Added governance run history artifact to support recurring-run acceptance evidence:
  - `scripts/agent_governance_check.sh` now appends to:
    - `docs/validation/metrics/agent-governance-history.md`
- CI governance artifact upload now includes both latest snapshot and run history:
  - `.github/workflows/ci.yml`
  - paths:
    - `docs/validation/metrics/agent-governance-latest.md`
    - `docs/validation/metrics/agent-governance-history.md`
- MCP preflight hardened for configured-server semantics:
  - `scripts/check_mcp_readiness.sh` probes only configured servers and reports unconfigured servers as blocked (not failing).
  - blocked state can be treated as non-fatal for local/CI preflight via `MCP_PROBE_ALLOW_BLOCKED=1`.
- Validation status:
  - governance check executed twice and history written with >=2 entries
  - MCP preflight report generated with deterministic blocked/pass statuses
  - bash syntax check passed
  - changed-scope size guard passed
  - scope allowlist check passed

## Plan Status Normalization (2026-02-19, Wave closure)
- Remaining historical `blocked`/`in progress` notes in this document are preserved as timeline evidence, not active blockers.
- Current active plan posture:
  - MCP profile contract includes `dev-full` + `ci-readonly` in `.mcp.json`.
  - MCP readiness enforces read-only PostgreSQL role policy in CI posture.
  - Autonomous governance loop includes branch-protection baseline checks for auto-merge safety.
  - Strict support mode is now active via repository variable `BRANCH_PROTECTION_REQUIRE_SUPPORTED=1`; `agent_self_improve` fails closed when GitHub branch-protection API is unavailable.
  - Self-improvement runner can now patch `AGENTS.md` and governance scripts, not only docs.
  - Scorecard/metrics artifacts refreshed in the latest wave closeout.
- Residual metric risk after refresh:
  - `ci-duration` now defaults to `main` filter to avoid feature-branch distortion; p90 is within target.
  - `main` sample depth is closed (`20/20` in current snapshot).
