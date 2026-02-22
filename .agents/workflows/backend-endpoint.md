---
description: Backend endpoint creation — schema, router, service, test, contract
---

# Backend Endpoint Workflow

// turbo-all

## Prerequisites
- API requirements are clear (method, path, request/response shape)
- Authentication/RBAC requirements are known

## Steps

1. **Read context**:
   ```bash
   cat docs/agents/context-packs/backend.md
   cat docs/agents/entrypoints/<domain>.md
   ```

2. **Define schema** — Create or extend Pydantic models:
   - File: `backend/app/schemas/<domain>.py`
   - Follow existing `ApiError` shape for error responses
   - Keep UTC timestamps

3. **Create service** — Business logic in service layer:
   - File: `backend/app/services/<domain>.py`
   - Keep service functions pure where possible
   - Add RBAC permission checks
   - Add audit logging for mutations
   - Add idempotency via `X-Client-Operation-Id` for mutations

4. **Create router** — Endpoint definition:
   - File: `backend/app/routers/<domain>.py`
   - Route under `/api/<domain>/`
   - Router is orchestration only — delegate logic to service
   - Keep router file < 350 LOC

5. **Write tests**:
   - File: `backend/tests/test_<domain>.py`
   - Test happy path, validation errors, permission denied, not found

6. **Run tests**:
   ```bash
   ./scripts/run_backend_pytest.sh -q
   ```

7. **Sync frontend types** — Update TypeScript types:
   - File: `frontend/src/types.ts`
   - Add API service function in `frontend/src/services/<domain>.ts`

8. **Check contract integrity**:
   ```bash
   ./scripts/check_api_contract_drift.sh
   ./scripts/check_mutation_integrity.py
   ```

9. **Update entrypoint and repo index**:
   ```bash
   python3 scripts/generate_repo_index.py --write
   python3 scripts/check_entrypoint_coverage.py
   ```

10. **Commit**:
    ```bash
    git add -A && git commit -m "feat(api): <description>"
    ```

## Completion Criteria
- Endpoint responds correctly for all test cases
- RBAC, audit, and idempotency in place for mutations
- Frontend types synchronized
- No contract drift
- Entrypoint updated
