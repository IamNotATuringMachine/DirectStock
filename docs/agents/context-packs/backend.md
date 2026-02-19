# Context Pack: Backend

## Entrypoints
- `backend/app/main.py`
- `backend/app/routers/*`
- `backend/app/services/*`
- `backend/app/schemas/*`

## Invariants
1. Protected mutations keep RBAC + audit + idempotency (`X-Client-Operation-Id`).
2. Error responses stay aligned with `ApiError` shape.
3. Contract changes remain synchronized with frontend types.

## High-Value Tests
- `cd backend && python -m pytest -q`
- `./scripts/check_api_contract_drift.sh`
- `./scripts/check_mutation_integrity.py`

## Frequent Failure Modes
1. Permission code drift between router guard and seeded permissions.
2. Missing idempotency header propagation in mutation flows.
3. Contract drift between OpenAPI snapshot and runtime schema.
