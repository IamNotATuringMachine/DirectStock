import { describe, expect, it } from "vitest";

import {
  isOperationSignoffRequired,
  isTabletOpsKioskPath,
  isTabletOpsUser,
} from "./tabletOps";

describe("tabletOps utils", () => {
  it("detects tablet ops role", () => {
    expect(
      isTabletOpsUser({
        id: 1,
        username: "tablet",
        email: null,
        roles: ["tablet_ops"],
        permissions: [],
        is_active: true,
      })
    ).toBe(true);
  });

  it("detects signoff requirement permission", () => {
    expect(
      isOperationSignoffRequired({
        id: 2,
        username: "worker",
        email: null,
        roles: ["lagermitarbeiter"],
        permissions: ["module.operations.signoff.required"],
        is_active: true,
      })
    ).toBe(true);
  });

  it("matches kiosk paths", () => {
    expect(isTabletOpsKioskPath("/tablet-ops")).toBe(true);
    expect(isTabletOpsKioskPath("/goods-receipt/123")).toBe(true);
    expect(isTabletOpsKioskPath("/dashboard")).toBe(false);
  });
});
