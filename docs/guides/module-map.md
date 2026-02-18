# Module Map

## Frontend
- Routing/Access source of truth: `frontend/src/routing/routeCatalog.ts`
- Route guards and redirects: `frontend/src/routing/accessRouting.ts`, `frontend/src/App.tsx`
- Shell and navigation: `frontend/src/components/AppLayout.tsx`
- Domain pages:
  - Product Form: `frontend/src/pages/product-form/`
  - Goods Receipt: `frontend/src/pages/goods-receipt/`

## Backend
- Router packages:
  - Operations: `backend/app/routers/operations/`
  - Reports: `backend/app/routers/reports/`
- Domain services:
  - Operations services: `backend/app/services/operations/`
  - Reports services: `backend/app/services/reports/`
- Application wiring: `backend/app/main.py`

## Ownership Style by Domain
- Security/Auth/RBAC: `backend/app/dependencies.py`, `backend/app/routers/auth.py`, `backend/app/routers/roles.py`
- Inventory operations: `backend/app/routers/operations/`
- Reporting & exports: `backend/app/routers/reports/`
- Frontend app shell + access: `frontend/src/components/AppLayout.tsx`, `frontend/src/routing/`
