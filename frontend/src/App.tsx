import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import AppLayout from "./components/AppLayout";
import { ProtectedRoute, RequireRole } from "./components/ProtectedRoute";
import LoginPage from "./LoginPage";
import {
  AlertsPage,
  ApprovalsPage,
  AuditTrailPage,
  DashboardPage,
  DocumentsPage,
  GoodsIssuePage,
  GoodsReceiptPage,
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
  StockTransferPage,
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
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="products/new" element={<ProductFormPage />} />
        <Route path="products/:id" element={<ProductDetailPage />} />
        <Route path="products/:id/edit" element={<ProductFormPage />} />
        <Route path="warehouse" element={<WarehousePage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route
          path="inventory-counts"
          element={
            <RequireRole roles={["admin", "lagerleiter", "lagermitarbeiter"]}>
              <InventoryCountPage />
            </RequireRole>
          }
        />
        <Route
          path="alerts"
          element={
            <RequireRole roles={["admin", "lagerleiter", "lagermitarbeiter", "einkauf", "controller", "versand"]}>
              <AlertsPage />
            </RequireRole>
          }
        />
        <Route
          path="reports"
          element={
            <RequireRole roles={["admin", "lagerleiter", "einkauf", "controller", "auditor"]}>
              <ReportsPage />
            </RequireRole>
          }
        />
        <Route
          path="purchasing"
          element={
            <RequireRole roles={["admin", "lagerleiter", "einkauf"]}>
              <PurchasingPage />
            </RequireRole>
          }
        />
        <Route
          path="picking"
          element={
            <RequireRole roles={["admin", "lagerleiter", "lagermitarbeiter", "versand"]}>
              <PickingPage />
            </RequireRole>
          }
        />
        <Route
          path="returns"
          element={
            <RequireRole roles={["admin", "lagerleiter", "versand"]}>
              <ReturnsPage />
            </RequireRole>
          }
        />
        <Route
          path="approvals"
          element={
            <RequireRole roles={["admin", "lagerleiter", "einkauf", "versand"]}>
              <ApprovalsPage />
            </RequireRole>
          }
        />
        <Route
          path="documents"
          element={
            <RequireRole roles={["admin", "lagerleiter", "einkauf", "versand", "controller", "auditor"]}>
              <DocumentsPage />
            </RequireRole>
          }
        />
        <Route
          path="audit-trail"
          element={
            <RequireRole roles={["admin", "lagerleiter", "controller", "auditor"]}>
              <AuditTrailPage />
            </RequireRole>
          }
        />
        <Route
          path="goods-receipt"
          element={
            <RequireRole roles={["admin", "lagerleiter", "lagermitarbeiter", "einkauf"]}>
              <GoodsReceiptPage />
            </RequireRole>
          }
        />
        <Route
          path="goods-issue"
          element={
            <RequireRole roles={["admin", "lagerleiter", "lagermitarbeiter", "versand"]}>
              <GoodsIssuePage />
            </RequireRole>
          }
        />
        <Route
          path="stock-transfer"
          element={
            <RequireRole roles={["admin", "lagerleiter", "lagermitarbeiter"]}>
              <StockTransferPage />
            </RequireRole>
          }
        />
        <Route
          path="scanner"
          element={
            <RequireRole roles={["admin", "lagerleiter", "lagermitarbeiter", "einkauf", "versand"]}>
              <ScannerPage />
            </RequireRole>
          }
        />
        <Route
          path="users"
          element={
            <RequireRole roles={["admin"]}>
              <UsersPage />
            </RequireRole>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
