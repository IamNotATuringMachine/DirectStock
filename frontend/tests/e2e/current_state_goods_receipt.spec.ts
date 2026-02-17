import { test, expect } from "@playwright/test";

test("capture current state of goods receipt page", async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.getByTestId("login-username").fill("admin");
    await page.getByTestId("login-password").fill("DirectStock2026!");
    await page.getByTestId("login-submit").click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // Navigate to Goods Receipt
    await page.goto("/goods-receipt");
    await expect(page.getByTestId("goods-receipt-page")).toBeVisible();

    // Desktop Screenshot (1400px)
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.waitForTimeout(1000); // Wait for potential animations/layout
    await page.screenshot({ path: "goods-receipt-desktop-before.png", fullPage: true });

    // Mobile Screenshot (375px)
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1000); // Wait for potential animations/layout
    await page.screenshot({ path: "goods-receipt-mobile-before.png", fullPage: true });
});
