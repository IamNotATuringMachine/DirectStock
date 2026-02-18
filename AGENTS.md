# AGENTS.md

> Version: 2026-02-18 | Scope: repository root (`DirectStock/`)

## Mission
Deliver correct, secure, testable, and reproducible changes with minimal regression risk.

## Canonical Instruction Policy
- This file is the canonical instruction source for all agents in this repository.
- Adapter files (`CLAUDE.md`, `GEMINI.md`, `CODEX.md`) must stay thin and must not redefine project policy.
- Nested `AGENTS.md` files in subdirectories may add stricter local rules for their scope.

## Quick Execution Contract
1. Plan: load relevant code, schemas, tests, and phase docs before changing files.
2. Implement: ship small, reviewable diffs with clear intent.
3. Verify: run relevant tests/checks locally and capture outcomes.
4. Report: list files changed, behavior changes, verification, and residual risk.

## Priority And Conflict Handling
1. Direct user/developer/system instructions.
2. Closest nested `AGENTS.md` that covers the edited file.
3. This root `AGENTS.md`.
4. Adapter files (`CLAUDE.md`, `GEMINI.md`, `CODEX.md`) as tool-specific hints only.

If instructions conflict, apply the highest-priority rule and document assumptions explicitly.

## Non-Negotiables
1. No destructive Git operations without explicit approval (`reset --hard`, `checkout --`, `push --force`).
2. API changes must be additive unless breaking change approval is explicit.
3. Database schema changes only through Alembic migrations.
4. Preserve security baseline: auth, RBAC, audit logging, idempotency, standardized `ApiError` format.
5. Never commit or print secrets; keep `.env` local.
6. Run and report relevant tests before closing work.
7. Do not weaken offline idempotency (`X-Client-Operation-Id`).

## Monorepo Navigation
- `backend/`: FastAPI, SQLAlchemy 2.x, Alembic, auth/RBAC/audit/idempotency.
- `frontend/`: React 19, Vite 6, TypeScript, TanStack Query, Zustand, PWA.
- `nginx/`: reverse proxy (`/` frontend, `/api/*` backend).
- `scripts/`: seed/import/batch/check automation.
- `docs/`: implementation guides and validation artifacts.
- `directstock_phase*.md`: project status and phase history.

## Source Of Truth
1. API contract: `backend/app/schemas/*` and `frontend/src/types.ts` must stay consistent.
2. Project status: `directstock_phase5.md` is current baseline.
3. Tests are part of the specification (especially auth, RBAC, inventory, operations, shipping, offline idempotency).

## Architecture Guardrails
### Backend
- Endpoints under `/api/*`; health at `/health` and `/api/health`.
- Mutating endpoints (`POST/PUT/PATCH/DELETE`) produce audit entries.
- Enforce RBAC on the server, never in frontend only.
- Use UTC for timestamps.
- Keep unique constraints and critical indexes intact.

### Frontend
- Access backend through `frontend/src/services/*` only.
- Keep critical user flows covered by `data-testid`.
- Keep a single offline queue implementation (`offlineQueue.ts`).
- Preserve PWA UX elements (install prompt, offline indicator, update banner).
- Keep role-based navigation aligned with backend RBAC.

### Security And Data Integrity
- Keep password hashing/JWT handling unchanged unless explicitly requested.
- Validate input and keep error contracts stable (`ApiError`, conflict details on `409`).
- Keep dependency changes minimal and justified.

## Production-Mode Completion Gates
Work is complete only when all are true:
- Implementation builds/runs for the touched scope.
- Relevant automated tests were executed locally and reported.
- No known contract breaks were introduced.
- Docs were updated if behavior/API changed.
- Reproduction steps are clear.

## Standard Commands
```bash
# Dev

docker compose up --build
docker compose -f docker-compose.dev.yml up --build

# Backend tests
cd backend && python -m pytest -q

# Frontend tests
cd frontend && npm run test
cd frontend && npm run test:e2e
cd frontend && npm run test:e2e:raw

# Production
docker compose -f docker-compose.prod.yml up -d --build
./scripts/lighthouse_pwa.sh
```

## Agent Report Template
1. Files changed
2. Functional change (what and why)
3. Verification and results
4. Residual risks/open points
5. Optional next 1-3 steps

## Git Discipline
- Keep diffs small and focused.
- Avoid drive-by refactors.
- Avoid dead TODOs without context.
- State assumptions explicitly when uncertain.

## Active Modules (Phase 5)
### Backend routers
`auth`, `users`, `products`, `warehouses`, `inventory`, `operations`, `dashboard`, `customers`, `suppliers`, `product_settings`, `purchasing`, `inventory_counts`, `reports`, `alerts`, `abc`, `purchase_recommendations`, `picking`, `returns`, `workflows`, `documents`, `audit_log`, `external_api`, `integration_clients`, `shipping`, `inter_warehouse_transfers`, `permissions`, `pages`, `roles`, `ui_preferences`, `dashboard_config`, `pricing`, `services_catalog`, `sales_orders`, `invoices`

### Frontend pages
`Products`, `ProductForm`, `GoodsReceipt`, `GoodsIssue`, `StockTransfer`, `Inventory`, `InventoryCount`, `Purchasing`, `Reports`, `Alerts`, `Dashboard`, `Scanner`, `Warehouse`, `Picking`, `Returns`, `Approvals`, `Documents`, `AuditTrail`, `Shipping`, `InterWarehouseTransfer`, `Users`, `Services`, `SalesOrders`, `Invoices`

Principle: security and data integrity over speed.
