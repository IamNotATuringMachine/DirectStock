import { expect, test, type Page } from "@playwright/test";

const VISUAL_ROUTES: Array<{ path: string; testId: string; snapshot: string }> = [
  { path: "/dashboard", testId: "dashboard-page", snapshot: "route-dashboard.png" },
  { path: "/products", testId: "products-page", snapshot: "route-products.png" },
  { path: "/inventory", testId: "inventory-page", snapshot: "route-inventory.png" },
  { path: "/warehouse", testId: "warehouse-page", snapshot: "route-warehouse.png" },
  { path: "/purchasing", testId: "purchasing-page", snapshot: "route-purchasing.png" },
  { path: "/reports", testId: "reports-page", snapshot: "route-reports.png" },
  { path: "/alerts", testId: "alerts-page", snapshot: "route-alerts.png" },
  { path: "/customers", testId: "customers-page", snapshot: "route-customers.png" },
  { path: "/sales-orders", testId: "sales-orders-page", snapshot: "route-sales-orders.png" },
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
  await page.goto("/login");
  await page.getByTestId("login-username").fill(process.env.E2E_ADMIN_USERNAME ?? "admin");
  await page.getByTestId("login-password").fill(process.env.E2E_ADMIN_PASSWORD ?? "DirectStock2026!");
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe("visual baseline gate", () => {
  test("core UI pages match approved screenshots", async ({ page }) => {
    await login(page);

    for (const route of VISUAL_ROUTES) {
      await page.goto(route.path);
      await page.waitForLoadState("networkidle");
      await expect(page.getByTestId(route.testId)).toBeVisible();
      await page.evaluate(async () => {
        await document.fonts.ready;
      });

      const mask = VOLATILE_SELECTORS.map((selector) => page.locator(selector));
      await expect(page).toHaveScreenshot(route.snapshot, {
        animations: "disabled",
        caret: "hide",
        maxDiffPixelRatio: 0.02,
        mask,
      });
    }
  });
});
