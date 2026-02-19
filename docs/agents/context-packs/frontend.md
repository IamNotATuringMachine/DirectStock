# Context Pack: Frontend

## Entrypoints
- `frontend/src/App.tsx`
- `frontend/src/routing/*`
- `frontend/src/pages/*`
- `frontend/src/services/*`

## Invariants
1. Network calls originate from service layer modules.
2. Permission-gated routing remains consistent with backend permissions.
3. Offline queue behavior remains deterministic under reconnect/retry.

## High-Value Tests
- `cd frontend && npm run lint`
- `cd frontend && npm run test`
- `cd frontend && npm run build`
- `cd frontend && npm run test:e2e:smoke`

## Frequent Failure Modes
1. Direct fetch/axios usage in pages bypassing service contracts.
2. Route catalog drift vs backend page/permission sources.
3. Offline queue backoff/replay regressions after refactors.
