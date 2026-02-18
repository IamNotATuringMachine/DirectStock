# AGENTS.md (Backend Scope)

Scope: applies to all files under `backend/`.

`/AGENTS.md` remains canonical for global policy. This file adds backend-specific deltas only.

## Backend Deltas
- Keep FastAPI routes under `/api/*` and preserve `/health` plus `/api/health` behavior.
- Keep standardized `ApiError` response shape (`code`, `message`, `request_id`, `details`).
- Ensure mutating endpoints create audit log entries.
- Enforce RBAC server-side for every protected operation.
- Keep offline idempotency behavior for mutation endpoints (`X-Client-Operation-Id`).
- Keep timestamps in UTC.

## Database Rules
- Schema changes only via Alembic migration files.
- Do not apply manual DDL in code paths.
- Keep critical constraints and indexes intact unless explicitly requested.
- Migrations must be forward-safe and reviewable.

## Test Focus (Backend)
At minimum for backend-affecting changes, run:

```bash
cd backend && python -m pytest -q
```

If a smaller targeted run is used during iteration, still run relevant final validation before completion.

## Change Hygiene
- Keep API changes additive by default.
- Keep schema and response contracts aligned with frontend types.
- Document behavior/API changes in docs when relevant.
