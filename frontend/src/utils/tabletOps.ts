import type { AuthUser } from "../types";

export const TABLET_OPS_HOME_PATH = "/tablet-ops";

export const TABLET_OPS_KIOSK_PATH_PREFIXES = [
  "/tablet-ops",
  "/goods-receipt",
  "/goods-issue",
  "/inventory-counts",
  "/sales-orders",
  "/operators",
] as const;

export function isTabletOpsUser(user: AuthUser | null | undefined): boolean {
  if (!user) {
    return false;
  }

  const roleNames = new Set(user.roles ?? []);
  if (roleNames.has("tablet_ops")) {
    return true;
  }

  const permissionCodes = new Set(user.permissions ?? []);
  return permissionCodes.has("page.tablet-ops.view");
}

export function isOperationSignoffRequired(user: AuthUser | null | undefined): boolean {
  if (isTabletOpsUser(user)) {
    return true;
  }

  const permissionCodes = new Set(user?.permissions ?? []);
  return permissionCodes.has("module.operations.signoff.required");
}

export function isTabletOpsKioskPath(pathname: string): boolean {
  return TABLET_OPS_KIOSK_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
