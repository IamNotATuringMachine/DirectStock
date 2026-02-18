type AccessRoute = {
  path: string;
  requiredPermission: string;
};

const accessRoutePriority: AccessRoute[] = [
  { path: "/dashboard", requiredPermission: "page.dashboard.view" },
  { path: "/products", requiredPermission: "page.products.view" },
  { path: "/warehouse", requiredPermission: "page.warehouse.view" },
  { path: "/inventory", requiredPermission: "page.inventory.view" },
  { path: "/inventory-counts", requiredPermission: "page.inventory-counts.view" },
  { path: "/purchasing", requiredPermission: "page.purchasing.view" },
  { path: "/picking", requiredPermission: "page.picking.view" },
  { path: "/returns", requiredPermission: "page.returns.view" },
  { path: "/approvals", requiredPermission: "page.approvals.view" },
  { path: "/documents", requiredPermission: "page.documents.view" },
  { path: "/audit-trail", requiredPermission: "page.audit-trail.view" },
  { path: "/reports", requiredPermission: "page.reports.view" },
  { path: "/alerts", requiredPermission: "page.alerts.view" },
  { path: "/goods-receipt", requiredPermission: "page.goods-receipt.view" },
  { path: "/goods-issue", requiredPermission: "page.goods-issue.view" },
  { path: "/stock-transfer", requiredPermission: "page.stock-transfer.view" },
  { path: "/inter-warehouse-transfer", requiredPermission: "page.inter-warehouse-transfer.view" },
  { path: "/shipping", requiredPermission: "page.shipping.view" },
  { path: "/customers", requiredPermission: "page.customers.view" },
  { path: "/scanner", requiredPermission: "page.scanner.view" },
  { path: "/sales-orders", requiredPermission: "page.sales-orders.view" },
  { path: "/invoices", requiredPermission: "page.invoices.view" },
  { path: "/users", requiredPermission: "page.users.view" },
];

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

