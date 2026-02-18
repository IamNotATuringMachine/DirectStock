import { describe, expect, it } from "vitest";

import { canAccessPath, resolveFirstAccessiblePath, resolvePostLoginPath } from "./accessRouting";

describe("accessRouting", () => {
  it("resolves the first accessible path from navigation priority", () => {
    expect(resolveFirstAccessiblePath(["page.documents.view"])).toBe("/documents");
  });

  it("returns null when no page permission is granted", () => {
    expect(resolveFirstAccessiblePath([])).toBeNull();
  });

  it("uses requested path when user may access it", () => {
    expect(
      resolvePostLoginPath({
        requestedPath: "/reports",
        userPermissions: ["page.reports.view"],
      }),
    ).toBe("/reports");
  });

  it("falls back to first accessible path when requested path is not allowed", () => {
    expect(
      resolvePostLoginPath({
        requestedPath: "/reports",
        userPermissions: ["page.documents.view"],
      }),
    ).toBe("/documents");
  });

  it("handles nested route checks via page-level permissions", () => {
    expect(canAccessPath("/products/123", ["page.products.view"])).toBe(true);
    expect(canAccessPath("/products/123", ["page.dashboard.view"])).toBe(false);
  });
});

