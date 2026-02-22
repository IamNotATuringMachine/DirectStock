# Context Pack: Auth/RBAC Domain

## Entrypoints
- `backend/app/routers/auth.py`
- `backend/app/routers/roles.py`
- `backend/app/routers/permissions.py`
- `backend/app/dependencies.py`
- `frontend/src/components/ProtectedRoute.tsx`

## Invariants
1. Effective permission evaluation remains server-authoritative.
2. Token/session semantics remain backward compatible.
3. Frontend route guards reflect backend permission outputs from `/api/auth/me`.

## High-Value Tests
- `./scripts/run_backend_pytest.sh -q tests/test_auth.py tests/test_rbac_permissions_phase5.py`
- `cd frontend && npm run test`
- `./scripts/check_mutation_integrity.py`

## Frequent Failure Modes
1. Permission seed drift vs route guard expectations.
2. Role/deny/allow merge logic regressions in access-profile updates.
3. Silent frontend fallback to first route without permissions.
