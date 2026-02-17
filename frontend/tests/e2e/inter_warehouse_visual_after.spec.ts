import { test, expect } from '@playwright/test';

test('verify inter-warehouse transfer page layout', async ({ page }) => {
    // Login
    await page.goto('http://localhost:5173/login');
    await page.fill('[data-testid="login-username"]', 'admin@directstock.com');
    await page.fill('[data-testid="login-password"]', 'password');
    await page.click('[data-testid="login-submit"]');
    await page.waitForURL('**/dashboard');

    // Navigate
    await page.goto('http://localhost:5173/inter-warehouse-transfer');
    await page.waitForSelector('h1:has-text("Zwischenlager-Transfer")', { state: 'visible' });

    // Add some wait for data
    await page.waitForTimeout(1000);

    // Take screenshots
    if (page.viewportSize()?.width && page.viewportSize()!.width > 1000) {
        await page.screenshot({ path: '/Users/tobiasmorixbauer/.gemini/antigravity/brain/1251316c-36f4-4044-8a87-311a19041fe2/inter_warehouse_transfer_after_desktop.png', fullPage: true });
    } else {
        await page.screenshot({ path: '/Users/tobiasmorixbauer/.gemini/antigravity/brain/1251316c-36f4-4044-8a87-311a19041fe2/inter_warehouse_transfer_after_mobile.png', fullPage: true });
    }
});
