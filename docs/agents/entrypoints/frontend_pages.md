# Frontend Pages Entrypoint

## Core Paths
- App shell: `frontend/src/App.tsx`, `frontend/src/components/AppLayout.tsx`
- Route catalog: `frontend/src/routing/routeEntries.ts`
- Top-level page routes (`frontend/src/pages/*Page.tsx`):
  - `AlertsPage.tsx`
  - `ApprovalsPage.tsx`
  - `AuditTrailPage.tsx`
  - `CustomersPage.tsx`
  - `DashboardPage.tsx`
  - `DocumentsPage.tsx`
  - `GoodsIssuePage.tsx`
  - `GoodsReceiptPage.tsx`
  - `InterWarehouseTransferPage.tsx`
  - `InventoryCountPage.tsx`
  - `InventoryPage.tsx`
  - `InvoicesPage.tsx`
  - `PickingPage.tsx`
  - `ProductDetailPage.tsx`
  - `ProductFormPage.tsx`
  - `ProductsPage.tsx`
  - `PurchasingPage.tsx`
  - `ReportsPage.tsx`
  - `ReturnsPage.tsx`
  - `SalesOrdersPage.tsx`
  - `ScannerPage.tsx`
  - `ShippingPage.tsx`
  - `StockTransferPage.tsx`
  - `UsersPage.tsx`
  - `WarehousePage.tsx`

## Invariants
1. Permission-gated routing remains aligned with backend permissions.
2. Page components orchestrate; service-layer modules own API calls.
3. Offline queue behavior remains deterministic for reconnect/retry.

## Verification
- `cd frontend && npm run lint`
- `cd frontend && npm run test`
- `cd frontend && npm run build`
- `cd frontend && npm run test:e2e:smoke`
