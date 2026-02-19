# Operations Entrypoint

## Core Paths
- Routers: `backend/app/routers/operations/*`
- Services: `backend/app/services/operations/*`
- Frontend pages: `frontend/src/pages/goods-issue/*`, `frontend/src/pages/stock-transfer/*`, `frontend/src/pages/goods-receipt/*`
- Frontend services: `frontend/src/services/operationsApi.ts`

## Invariants
1. Mutations require permission guard + audit + idempotency.
2. `X-Client-Operation-Id` behavior must remain stable.
3. `ApiError` contract stays consistent.

## Verification
- `./scripts/check_mutation_integrity.py`
- `./scripts/check_api_contract_drift.sh`
- `cd frontend && npm run test:e2e:smoke`
