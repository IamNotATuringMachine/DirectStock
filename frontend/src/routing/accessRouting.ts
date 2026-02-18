import { navigableRoutes } from "./routeCatalog";

type AccessRoute = {
  path: string;
  requiredPermission: string;
};

const accessRoutePriority: AccessRoute[] = navigableRoutes.map((route) => ({
  path: route.path,
  requiredPermission: route.requiredPermission,
}));

const accessPathMatchers = accessRoutePriority.map((route) => ({
  ...route,
  matcher: new RegExp(`^${route.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:/|$)`),
}));

function normalizePath(pathname: string): string {
  const withoutQuery = pathname.split(/[?#]/, 1)[0]?.trim() ?? "";
  if (!withoutQuery) {
    return "/";
  }
  const withLeadingSlash = withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
  if (withLeadingSlash === "/") {
    return withLeadingSlash;
  }
  return withLeadingSlash.replace(/\/+$/, "");
}

export function resolveFirstAccessiblePath(userPermissions: string[] | undefined): string | null {
  const granted = new Set(userPermissions ?? []);
  for (const route of accessRoutePriority) {
    if (granted.has(route.requiredPermission)) {
      return route.path;
    }
  }
  return null;
}

export function canAccessPath(pathname: string, userPermissions: string[] | undefined): boolean {
  const normalizedPath = normalizePath(pathname);
  const route = accessPathMatchers.find((candidate) => candidate.matcher.test(normalizedPath));
  if (!route) {
    return false;
  }
  const granted = new Set(userPermissions ?? []);
  return granted.has(route.requiredPermission);
}

export function resolvePostLoginPath({
  requestedPath,
  userPermissions,
}: {
  requestedPath?: string | null;
  userPermissions: string[] | undefined;
}): string | null {
  if (requestedPath && canAccessPath(requestedPath, userPermissions)) {
    return normalizePath(requestedPath);
  }
  return resolveFirstAccessiblePath(userPermissions);
}
