import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import AppLayout from "./components/AppLayout";
import { ProtectedRoute, RequireRole } from "./components/ProtectedRoute";
import LoginPage from "./LoginPage";
import {
  AlertsPage,
  DashboardPage,
  GoodsIssuePage,
  GoodsReceiptPage,
  InventoryCountPage,
  InventoryPage,
  ProductDetailPage,
  ProductFormPage,
  ProductsPage,
  PurchasingPage,
  ReportsPage,
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
            <RequireRole roles={["admin", "lagerleiter", "einkauf", "controller"]}>
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
