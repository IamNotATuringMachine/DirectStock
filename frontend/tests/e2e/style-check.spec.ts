import { test, expect } from "@playwright/test";

test.describe("Style Consistency Check", () => {
  test("visually capture dashboard, products, warehouse, and inventory pages", async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.getByTestId("login-username").fill("admin");
    await page.getByTestId("login-password").fill("DirectStock2026!");
    await page.getByTestId("login-submit").click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // Dashboard
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "frontend/output/style-check/dashboard.png", fullPage: true });

    // Products
    await page.goto("/products");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "frontend/output/style-check/products.png", fullPage: true });

    // Warehouse
    await page.goto("/warehouse");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "frontend/output/style-check/warehouse.png", fullPage: true });

    // Inventory
    await page.goto("/inventory");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "frontend/output/style-check/inventory.png", fullPage: true });

    // Picking
    await page.goto("/picking");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "frontend/output/style-check/picking.png", fullPage: true });
  });
});
