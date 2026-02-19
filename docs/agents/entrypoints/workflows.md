# Workflows Entrypoint

## Core Paths
- Backend router: `backend/app/routers/workflows.py`
- Backend schemas: `backend/app/schemas/*`
- Backend services: `backend/app/services/*`
- Frontend pages/services (if applicable): `frontend/src/pages/*`, `frontend/src/services/*`

## Invariants
1. Permission checks remain server-authoritative.
2. Mutations preserve audit and idempotency guarantees.
3. API changes remain synchronized with frontend types.

## Verification
- `./scripts/check_api_contract_drift.sh`
- `cd backend && python -m pytest -q`
- `cd frontend && npm run test`
