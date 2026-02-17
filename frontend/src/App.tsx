import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import AppLayout from "./components/AppLayout";
import { ProtectedRoute, RequirePermission } from "./components/ProtectedRoute";
import LoginPage from "./LoginPage";
import {
  AlertsPage,
  ApprovalsPage,
  AuditTrailPage,
  CustomersPage,
  DashboardPage,
  DocumentsPage,
  GoodsIssuePage,
  GoodsReceiptPage,
  InterWarehouseTransferPage,
  InventoryCountPage,
  InventoryPage,
  PickingPage,
  ProductDetailPage,
  ProductFormPage,
  ProductsPage,
  PurchasingPage,
  ReportsPage,
  ReturnsPage,
  ScannerPage,
  SalesOrdersPage,
  ShippingPage,
  StockTransferPage,
  ServicesPage,
  InvoicesPage,
  UsersPage,
  WarehousePage,
} from "./pages";
import { useAuthStore } from "./stores/authStore";

export default function App() {
  const token = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const fetchMe = useAuthStore((state) => state.fetchMe);

  useEffect(() => {
    if (token && !user) {
      void fetchMe();
    }
  }, [fetchMe, token, user]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<RequirePermission permissions={["page.dashboard.view"]}><DashboardPage /></RequirePermission>} />
        <Route path="products" element={<RequirePermission permissions={["page.products.view"]}><ProductsPage /></RequirePermission>} />
        <Route path="products/new" element={<RequirePermission permissions={["page.products.view"]}><ProductFormPage /></RequirePermission>} />
        <Route path="products/:id" element={<RequirePermission permissions={["page.products.view"]}><ProductDetailPage /></RequirePermission>} />
        <Route path="products/:id/edit" element={<RequirePermission permissions={["page.products.view"]}><ProductFormPage /></RequirePermission>} />
        <Route path="warehouse" element={<RequirePermission permissions={["page.warehouse.view"]}><WarehousePage /></RequirePermission>} />
        <Route path="inventory" element={<RequirePermission permissions={["page.inventory.view"]}><InventoryPage /></RequirePermission>} />
        <Route
          path="inventory-counts"
          element={
            <RequirePermission permissions={["page.inventory-counts.view"]}>
              <InventoryCountPage />
            </RequirePermission>
          }
        />
        <Route
          path="alerts"
          element={
            <RequirePermission permissions={["page.alerts.view"]}>
              <AlertsPage />
            </RequirePermission>
          }
        />
        <Route
          path="reports"
          element={
            <RequirePermission permissions={["page.reports.view"]}>
              <ReportsPage />
            </RequirePermission>
          }
        />
        <Route
          path="purchasing"
          element={
            <RequirePermission permissions={["page.purchasing.view"]}>
              <PurchasingPage />
            </RequirePermission>
          }
        />
        <Route
          path="picking"
          element={
            <RequirePermission permissions={["page.picking.view"]}>
              <PickingPage />
            </RequirePermission>
          }
        />
        <Route
          path="returns"
          element={
            <RequirePermission permissions={["page.returns.view"]}>
              <ReturnsPage />
            </RequirePermission>
          }
        />
        <Route
          path="approvals"
          element={
            <RequirePermission permissions={["page.approvals.view"]}>
              <ApprovalsPage />
            </RequirePermission>
          }
        />
        <Route
          path="documents"
          element={
            <RequirePermission permissions={["page.documents.view"]}>
              <DocumentsPage />
            </RequirePermission>
          }
        />
        <Route
          path="audit-trail"
          element={
            <RequirePermission permissions={["page.audit-trail.view"]}>
              <AuditTrailPage />
            </RequirePermission>
          }
        />
        <Route
          path="goods-receipt"
          element={
            <RequirePermission permissions={["page.goods-receipt.view"]}>
              <GoodsReceiptPage />
            </RequirePermission>
          }
        />
        <Route
          path="goods-issue"
          element={
            <RequirePermission permissions={["page.goods-issue.view"]}>
              <GoodsIssuePage />
            </RequirePermission>
          }
        />
        <Route
          path="stock-transfer"
          element={
            <RequirePermission permissions={["page.stock-transfer.view"]}>
              <StockTransferPage />
            </RequirePermission>
          }
        />
        <Route
          path="shipping"
          element={
            <RequirePermission permissions={["page.shipping.view"]}>
              <ShippingPage />
            </RequirePermission>
          }
        />
        <Route
          path="customers"
          element={
            <RequirePermission permissions={["page.customers.view"]}>
              <CustomersPage />
            </RequirePermission>
          }
        />
        <Route
          path="inter-warehouse-transfer"
          element={
            <RequirePermission permissions={["page.inter-warehouse-transfer.view"]}>
              <InterWarehouseTransferPage />
            </RequirePermission>
          }
        />
        <Route
          path="scanner"
          element={
            <RequirePermission permissions={["page.scanner.view"]}>
              <ScannerPage />
            </RequirePermission>
          }
        />
        <Route
          path="users"
          element={
            <RequirePermission permissions={["page.users.view"]}>
              <UsersPage />
            </RequirePermission>
          }
        />
        <Route
          path="services"
          element={
            <RequirePermission permissions={["page.services.view"]}>
              <ServicesPage />
            </RequirePermission>
          }
        />
        <Route
          path="sales-orders"
          element={
            <RequirePermission permissions={["page.sales-orders.view"]}>
              <SalesOrdersPage />
            </RequirePermission>
          }
        />
        <Route
          path="invoices"
          element={
            <RequirePermission permissions={["page.invoices.view"]}>
              <InvoicesPage />
            </RequirePermission>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
