import { expect, test } from "@playwright/test";

import { loginViaUi, saveProjectScopedScreenshot } from "./helpers/ui";

test.describe("Style Consistency Check", () => {
  test("visually capture dashboard, products, warehouse, and inventory pages", async ({ page }, testInfo) => {
    test.slow();
    await loginViaUi(page);

    const routes: Array<{ path: string; rootTestId: string; screenshotName: string }> = [
      { path: "/dashboard", rootTestId: "dashboard-page", screenshotName: "style-check-dashboard" },
      { path: "/products", rootTestId: "products-page", screenshotName: "style-check-products" },
      { path: "/warehouse", rootTestId: "warehouse-page", screenshotName: "style-check-warehouse" },
      { path: "/inventory", rootTestId: "inventory-page", screenshotName: "style-check-inventory" },
      { path: "/picking", rootTestId: "picking-page", screenshotName: "style-check-picking" },
    ];

    for (const route of routes) {
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId(route.rootTestId)).toBeVisible();
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      await saveProjectScopedScreenshot(page, testInfo, route.screenshotName);
    }
  });
});
