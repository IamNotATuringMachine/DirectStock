import type { ReactElement } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuthStore } from "../stores/authStore";

export function ProtectedRoute({ children }: { children: ReactElement }) {
  const token = useAuthStore((state) => state.accessToken);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}

export function RequireRole({
  children,
  roles,
}: {
  children: ReactElement;
  roles: string[];
}) {
  const token = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!user) {
    return <p>Lade Berechtigungen...</p>;
  }

  const hasRole = user.roles.some((role) => roles.includes(role));
  if (!hasRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
