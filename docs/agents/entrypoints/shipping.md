# Shipping Entrypoint

## Core Paths
- Backend router: `backend/app/routers/shipping.py`
- Carrier services: `backend/app/services/carriers/*`
- Frontend page: `frontend/src/pages/shipping/*`
- Frontend service: `frontend/src/services/shippingApi.ts`

## Invariants
1. Shipment state machine and tracking semantics must remain stable.
2. Carrier integration errors must map to standard `ApiError` shape.
3. Mutations keep idempotency and audit guarantees.

## Verification
- `./scripts/check_api_contract_drift.sh`
- `cd frontend && npm run test:e2e:smoke`
