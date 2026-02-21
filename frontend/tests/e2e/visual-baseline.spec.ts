import { expect, test, type Page } from "@playwright/test";

import { loginViaUi } from "./helpers/ui";

const VISUAL_ROUTES: Array<{ path: string; testId: string; snapshot: string; maxDiffPixelRatio?: number }> = [
  { path: "/dashboard", testId: "dashboard-page", snapshot: "route-dashboard.png" },
  { path: "/products", testId: "products-page", snapshot: "route-products.png" },
  { path: "/inventory", testId: "inventory-page", snapshot: "route-inventory.png" },
  { path: "/warehouse", testId: "warehouse-page", snapshot: "route-warehouse.png", maxDiffPixelRatio: 0.05 },
  { path: "/purchasing", testId: "purchasing-page", snapshot: "route-purchasing.png" },
  { path: "/reports", testId: "reports-page", snapshot: "route-reports.png" },
  { path: "/alerts", testId: "alerts-page", snapshot: "route-alerts.png" },
  { path: "/customers", testId: "customers-page", snapshot: "route-customers.png" },
  { path: "/sales-orders", testId: "sales-orders-page", snapshot: "route-sales-orders.png", maxDiffPixelRatio: 0.08 },
  { path: "/invoices", testId: "invoices-page", snapshot: "route-invoices.png" },
];

const VOLATILE_SELECTORS = [
  "[data-testid*='timestamp']",
  "[data-testid*='time']",
  "[data-testid*='clock']",
  "[data-testid*='relative']",
  "[data-testid*='last-updated']",
];

async function login(page: Page): Promise<void> {
  await loginViaUi(page);
}

test.describe("visual baseline gate", () => {
  test("core UI pages match approved screenshots", async ({ page }) => {
    test.slow();
    await login(page);

    for (const route of VISUAL_ROUTES) {
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId(route.testId)).toBeVisible();
      await page.evaluate(async () => {
        await document.fonts.ready;
      });

      const mask = VOLATILE_SELECTORS.map((selector) => page.locator(selector));
      await expect(page).toHaveScreenshot(route.snapshot, {
        animations: "disabled",
        caret: "hide",
        maxDiffPixelRatio: route.maxDiffPixelRatio ?? 0.05,
        mask,
      });
    }
  });
});
