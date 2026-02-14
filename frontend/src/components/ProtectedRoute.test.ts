import { describe, expect, it } from "vitest";

import { hasAnyPermission } from "./ProtectedRoute";

describe("ProtectedRoute permission helper", () => {
  it("allows route access when no permission is required", () => {
    expect(hasAnyPermission(undefined, [])).toBe(true);
  });

  it("allows access when at least one required permission is present", () => {
    expect(hasAnyPermission(["module.pages.read", "module.services.read"], ["module.services.read"])).toBe(true);
  });

  it("blocks access when no required permission is granted", () => {
    expect(hasAnyPermission(["module.pages.read"], ["module.invoices.write"])).toBe(false);
  });
});

