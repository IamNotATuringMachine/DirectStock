# Invoices Entrypoint

## Core Paths
- Backend router: `backend/app/routers/invoices.py`
- Backend schemas: `backend/app/schemas/*`
- Backend services: `backend/app/services/*`
- Frontend pages/services (if applicable): `frontend/src/pages/*`, `frontend/src/services/*`

## Invariants
1. Permission checks remain server-authoritative.
2. Mutations preserve audit and idempotency guarantees.
3. API changes remain synchronized with frontend types.

## Verification
- `./scripts/check_api_contract_drift.sh`
- `./scripts/run_backend_pytest.sh -q`
- `cd frontend && npm run test`
