import { expect, test } from "@playwright/test";

import { createE2EPurchaseOrder, loginAsAdminApi } from "./helpers/api";
import { loginAndOpenRoute, saveProjectScopedScreenshot } from "./helpers/ui";

test("capture approvals page after modernization", async ({ page, request }, testInfo) => {
  test.slow();
  const token = await loginAsAdminApi(request);
  const purchaseOrder = await createE2EPurchaseOrder(request, token);
  const headers = { Authorization: `Bearer ${token}` };

  await request.post("/api/approvals", {
    headers,
    data: {
      entity_type: "purchase_order",
      entity_id: purchaseOrder.id,
      amount: "9999.99",
      reason:
        "This is a very long reason text to test if the layout breaks or if it wraps correctly as expected in a modern UI.",
    },
  });

  await loginAndOpenRoute(page, "/approvals", { rootTestId: "approvals-page" });

  await page.setViewportSize({ width: 1400, height: 900 });
  await expect(page.getByTestId("approvals-page")).toBeVisible();
  await saveProjectScopedScreenshot(page, testInfo, "approvals-after-desktop-light");

  await page.setViewportSize({ width: 375, height: 800 });
  await expect(page.getByTestId("approvals-page")).toBeVisible();
  await saveProjectScopedScreenshot(page, testInfo, "approvals-after-mobile-light");

  await page.setViewportSize({ width: 1400, height: 900 });
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await saveProjectScopedScreenshot(page, testInfo, "approvals-after-desktop-dark");
});
