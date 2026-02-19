# Context Pack: Operations Domain

## Entrypoints
- Backend: `backend/app/routers/operations/*`, `backend/app/services/operations/*`
- Frontend: `frontend/src/pages/goods-receipt/*`, `frontend/src/pages/goods-issue/*`, `frontend/src/pages/stock-transfer/*`

## Invariants
1. Mutation integrity requires RBAC + audit + idempotency.
2. Goods receipt/issue/transfer state transitions stay valid.
3. Offline replay must preserve operation ordering and dependency mapping.

## High-Value Tests
- `./scripts/check_mutation_integrity.py`
- `cd backend && python -m pytest -q tests/test_operations.py tests/test_offline_idempotency*.py`
- `cd frontend && npm run test:e2e:smoke`

## Frequent Failure Modes
1. Header mismatch for `X-Client-Operation-Id` in replay paths.
2. Entity ID mapping failures in offline queue dependency chains.
3. Frontend mutation payload drift after schema changes.
