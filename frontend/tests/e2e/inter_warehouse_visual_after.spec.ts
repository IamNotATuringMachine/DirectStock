import { test, expect } from '@playwright/test';

test('verify inter-warehouse transfer page layout', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[data-testid="login-username"]', 'admin@directstock.com');
    await page.fill('[data-testid="login-password"]', 'password');
    await page.click('[data-testid="login-submit"]');
    await page.waitForURL('**/dashboard');

    // Navigate
    await page.goto('/inter-warehouse-transfer');
    await page.waitForSelector('h1:has-text("Zwischenlager-Transfer")', { state: 'visible' });

    // Add some wait for data
    await page.waitForTimeout(1000);

    // Take screenshots
    if (page.viewportSize()?.width && page.viewportSize()!.width > 1000) {
        await page.screenshot({ path: 'output/inter_warehouse_transfer_after_desktop.png', fullPage: true });
    } else {
        await page.screenshot({ path: 'output/inter_warehouse_transfer_after_mobile.png', fullPage: true });
    }
});
