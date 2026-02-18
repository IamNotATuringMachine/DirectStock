import { createElement, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import AppLayout from "./components/AppLayout";
import { ProtectedRoute, RequirePermission } from "./components/ProtectedRoute";
import LoginPage from "./LoginPage";
import { routeCatalog } from "./routing/routeCatalog";
import { resolveFirstAccessiblePath } from "./routing/accessRouting";
import { useAuthStore } from "./stores/authStore";

function toNestedPath(path: string): string {
  return path.startsWith("/") ? path.slice(1) : path;
}

function AccessAwareDefaultRedirect() {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return <p>Lade Berechtigungen...</p>;
  }

  const targetPath = resolveFirstAccessiblePath(user.permissions);
  if (!targetPath) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={targetPath} replace />;
}

function AccessAwareFallbackRedirect() {
  const token = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!user) {
    return <p>Lade Berechtigungen...</p>;
  }

  const targetPath = resolveFirstAccessiblePath(user.permissions);
  if (!targetPath) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={targetPath} replace />;
}

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
        <Route index element={<AccessAwareDefaultRedirect />} />
        {routeCatalog.map((route) => (
          <Route
            key={route.path}
            path={toNestedPath(route.path)}
            element={
              <RequirePermission permissions={[route.requiredPermission]}>
                {createElement(route.component)}
              </RequirePermission>
            }
          />
        ))}
      </Route>
      <Route path="*" element={<AccessAwareFallbackRedirect />} />
    </Routes>
  );
}
