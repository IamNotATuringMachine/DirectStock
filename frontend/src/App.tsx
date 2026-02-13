import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import AppLayout from "./components/AppLayout";
import { ProtectedRoute, RequireRole } from "./components/ProtectedRoute";
import LoginPage from "./LoginPage";
import {
  DashboardPage,
  GoodsIssuePage,
  GoodsReceiptPage,
  InventoryPage,
  ProductDetailPage,
  ProductFormPage,
  ProductsPage,
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
        <Route path="goods-receipt" element={<GoodsReceiptPage />} />
        <Route path="goods-issue" element={<GoodsIssuePage />} />
        <Route path="stock-transfer" element={<StockTransferPage />} />
        <Route path="scanner" element={<ScannerPage />} />
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
