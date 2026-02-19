# Reports Entrypoint

## Core Paths
- Routers: `backend/app/routers/reports/*`
- Services: `backend/app/services/reports/*`
- Frontend page: `frontend/src/pages/ReportsPage.tsx`
- Frontend report modules: `frontend/src/pages/reports/*`

## Invariants
1. Report APIs remain additive and backward-compatible.
2. CSV/export behavior must stay deterministic.
3. Pagination/filter contracts must match frontend types.

## Verification
- `./scripts/check_api_contract_drift.sh`
- `cd frontend && npm run test`
- `cd frontend && npm run build`
