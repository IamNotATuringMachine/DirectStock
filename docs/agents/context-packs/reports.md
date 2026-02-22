# Context Pack: Reports Domain

## Entrypoints
- Backend: `backend/app/routers/reports/*`, `backend/app/services/reports/*`
- Frontend: `frontend/src/pages/reports/*`, `frontend/src/services/reportsApi.ts`

## Invariants
1. Report endpoints remain stable and deterministic.
2. CSV/forecast outputs preserve format compatibility.
3. Pagination/filter semantics stay aligned between backend and frontend types.

## High-Value Tests
- `./scripts/check_api_contract_drift.sh`
- `./scripts/run_backend_pytest.sh -q tests/test_reports.py tests/test_reports_forecast.py`
- `cd frontend && npm run test`

## Frequent Failure Modes
1. Field rename drift in report response payloads.
2. Forecast recompute side effects not mirrored in frontend refresh logic.
3. CSV export regressions under filter combinations.
