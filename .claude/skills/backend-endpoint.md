---
name: Backend Endpoint
description: Create a new backend API endpoint end-to-end (schema, router, service, test)
---

# Backend Endpoint Skill

## When to Use
When creating a new backend API endpoint or modifying an existing one.

## Steps

1. **Define schema** in `backend/app/schemas/` — request/response Pydantic models
2. **Create/update service** in `backend/app/services/` — business logic, DB queries
3. **Create/update router** in `backend/app/routers/` — HTTP endpoint, validation, RBAC guard
4. **Register router** in `backend/app/main.py` if new
5. **Add tests** in `backend/tests/`
6. **Sync frontend types** in `frontend/src/types.ts` if contract changed
7. **Run validation**:
   ```bash
   cd backend && python -m pytest -q
   ./scripts/check_api_contract_drift.sh
   ```

## Invariants
- All mutations must have RBAC check + audit log + idempotency (`X-Client-Operation-Id`)
- Error responses must use `ApiError` shape (`code`, `message`, `request_id`, `details`)
- Endpoints under `/api/*`, health at `/health` and `/api/health`
- Router files < 350 LOC, service files < 500 LOC

## Anti-Patterns
- Do NOT put business logic in routers — routers orchestrate only
- Do NOT use inline SQL — use SQLAlchemy models
- Do NOT skip audit logging for mutations
