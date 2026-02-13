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
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const hasRole = user.roles.some((role) => roles.includes(role));
  if (!hasRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
