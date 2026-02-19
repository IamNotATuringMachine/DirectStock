# Product-Form Entrypoint

## Core Paths
- Frontend page: `frontend/src/pages/product-form/*`
- View model hook: `frontend/src/pages/product-form/hooks/useProductFormWorkspaceVm.ts`
- Product services: `frontend/src/services/productsApi.ts`, `frontend/src/services/productSettingsApi.ts`
- Backend schemas: `backend/app/schemas/products.py` and related schema modules

## Invariants
1. Wizard/tab workflows remain backward-compatible.
2. Supplier/warehouse/pricing relations preserve existing API contracts.
3. No direct backend calls from page components.

## Verification
- `cd frontend && npm run lint`
- `cd frontend && npm run test`
- `cd frontend && npm run build`
