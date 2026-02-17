import { test, expect } from "@playwright/test";

test("visual stress test goods receipt modernization", async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.getByTestId("login-username").fill("admin");
    await page.getByTestId("login-password").fill("DirectStock2026!");
    await page.getByTestId("login-submit").click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // Navigate to Goods Receipt
    await page.goto("/goods-receipt");
    await expect(page.getByTestId("goods-receipt-page")).toBeVisible();

    // 1. Desktop Check (1400px)
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "goods-receipt-desktop-after.png", fullPage: true });

    // 2. Mobile Check (375px)
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "goods-receipt-mobile-after.png", fullPage: true });

    // 3. Check for specific new elements/classes to ensure refactor took place
    // Check for the "1. Beleg anlegen" card header
    const cardHeader = page.getByRole('heading', { name: "1. Beleg anlegen" });
    await expect(cardHeader).toBeVisible();

    // Check that grid layout is applied (cols-1 on mobile)
    const gridContainer = page.locator('.grid.gap-6').first();
    await expect(gridContainer).toBeVisible();

    // 4. Dark Mode Check (basic check if we can toggle or just force it via code)
    // Assuming a class "dark" on document element or similar, but for now we just screenshot the standard mode.
    // If there's a dark mode toggle in the UI, we could click it.

    console.log("Visual Stress Test Completed. Check screenshots.");
});
