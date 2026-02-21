import { test, expect } from '@playwright/test';

const ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME ?? "admin";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "DirectStock2026!";

test('capture inter-warehouse transfer page state', async ({ page }) => {
    console.log('Navigating to login...');
    await page.goto('/login');
    await page.screenshot({ path: 'output/login_page.png' });

    console.log('Filling login form...');
    await page.fill('[data-testid="login-username"]', ADMIN_USERNAME);
    await page.fill('[data-testid="login-password"]', ADMIN_PASSWORD);
    await page.click('[data-testid="login-submit"]');

    console.log('Waiting for dashboard...');
    await expect(page).toHaveURL(/\/dashboard(?:$|[?#])/);
    await page.screenshot({ path: 'output/dashboard.png' });

    console.log('Navigating to inter-warehouse-transfer...');
    await page.goto('/inter-warehouse-transfer');

    console.log('Waiting for content...');
    await expect(page.getByTestId("inter-warehouse-transfer-page")).toBeVisible();

    await page.waitForTimeout(2000);

    console.log('Taking final screenshot...');
    await page.screenshot({ path: 'output/inter_warehouse_transfer_before.png', fullPage: true });
});
