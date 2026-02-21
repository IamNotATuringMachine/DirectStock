import { test, expect } from '@playwright/test';

const ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME ?? "admin";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "DirectStock2026!";

test('capture current state of sales orders page', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId("login-username").fill(ADMIN_USERNAME);
    await page.getByTestId("login-password").fill(ADMIN_PASSWORD);
    await page.getByTestId("login-submit").click();
    await expect(page).toHaveURL(/\/dashboard(?:$|[?#])/);

    await page.goto('/sales-orders');
    await expect(page.getByTestId("sales-orders-page")).toBeVisible();
    await page.screenshot({ path: 'output/sales-orders-before.png', fullPage: true });
});
