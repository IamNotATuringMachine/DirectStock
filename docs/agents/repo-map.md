# Repo Map (LLM Navigation)

## Root
- `/backend`: FastAPI app, SQLAlchemy models, Alembic migrations, tests.
- `/frontend`: React/Vite app, page containers, services, E2E tests.
- `/scripts`: deterministic quality gates, metrics, smoke checks, harness.
- `/docs`: guides, contracts, validation artifacts.
- `/DirectStock`: Obsidian workspace (non-production context, exclude from product code decisions unless explicitly requested).

## Backend Topology
- App entrypoint: `backend/app/main.py`
- Router layer: `backend/app/routers/*`
- Service layer: `backend/app/services/*`
- Schemas/API contracts: `backend/app/schemas/*`
- Permissions/auth guards: `backend/app/dependencies.py`, `backend/app/routers/permissions.py`
- Migrations: `backend/alembic/versions/*`

## Frontend Topology
- App shell: `frontend/src/App.tsx`, `frontend/src/components/AppLayout.tsx`
- Routing/access: `frontend/src/routing/*`
- Services boundary: `frontend/src/services/*`
- Domain pages: `frontend/src/pages/*`
- Types contract: `frontend/src/types.ts`, `frontend/src/types/*`

## Agent Entrypoints By Domain
- Operations: `docs/agents/entrypoints/operations.md`
- Reports: `docs/agents/entrypoints/reports.md`
- Returns: `docs/agents/entrypoints/returns.md`
- Shipping: `docs/agents/entrypoints/shipping.md`
- Product Form: `docs/agents/entrypoints/product-form.md`

## Context Packs
- Backend: `docs/agents/context-packs/backend.md`
- Frontend: `docs/agents/context-packs/frontend.md`
- Operations: `docs/agents/context-packs/ops.md`
- Reports: `docs/agents/context-packs/reports.md`
- Auth/RBAC: `docs/agents/context-packs/auth.md`

## Fast Scope Checks
1. API compatibility: `./scripts/check_api_contract_drift.sh`
2. Refactor scope safety: `./scripts/check_refactor_scope_allowlist.sh`
3. File chunking policy: `./scripts/check_file_size_limits.sh`
4. Autonomous governance: `./scripts/agent_governance_check.sh`
