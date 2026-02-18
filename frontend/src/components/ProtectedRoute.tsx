import type { ReactElement } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { resolveFirstAccessiblePath } from "../routing/accessRouting";
import { useAuthStore } from "../stores/authStore";

export function hasAnyPermission(userPermissions: string[] | undefined, requiredPermissions: string[]): boolean {
  if (requiredPermissions.length === 0) {
    return true;
  }
  const granted = new Set(userPermissions ?? []);
  return requiredPermissions.some((permission) => granted.has(permission));
}

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
    const fallbackPath = resolveFirstAccessiblePath(user.permissions);
    if (!fallbackPath) {
      return <Navigate to="/login" replace />;
    }
    return <Navigate to={fallbackPath} replace />;
  }

  return children;
}

export function RequirePermission({
  children,
  permissions,
}: {
  children: ReactElement;
  permissions: string[];
}) {
  const token = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!user) {
    return <p>Lade Berechtigungen...</p>;
  }

  const hasPermission = hasAnyPermission(user.permissions, permissions);
  if (!hasPermission) {
    const fallbackPath = resolveFirstAccessiblePath(user.permissions);
    if (!fallbackPath) {
      return <Navigate to="/login" replace />;
    }
    return <Navigate to={fallbackPath} replace />;
  }

  return children;
}
