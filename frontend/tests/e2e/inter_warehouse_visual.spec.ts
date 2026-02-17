import { test, expect } from '@playwright/test';

test('capture inter-warehouse transfer page state', async ({ page }) => {
    console.log('Navigating to login...');
    await page.goto('http://localhost:5173/login');
    await page.screenshot({ path: 'login_page.png' });

    console.log('Filling login form...');
    await page.fill('[data-testid="login-username"]', 'admin@directstock.com');
    await page.fill('[data-testid="login-password"]', 'password');
    await page.click('[data-testid="login-submit"]');

    console.log('Waiting for dashboard...');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await page.screenshot({ path: 'dashboard.png' });

    console.log('Navigating to inter-warehouse-transfer...');
    await page.goto('http://localhost:5173/inter-warehouse-transfer');

    console.log('Waiting for content...');
    // Wait for the page to load
    try {
        await page.waitForSelector('h2', { state: 'visible', timeout: 5000 });
    } catch (e) {
        console.log('h2 not found, checking page content...');
        await page.screenshot({ path: 'inter_warehouse_failure.png' });
        throw e;
    }

    // Wait a bit for any animations or data fetching
    await page.waitForTimeout(2000);

    console.log('Taking final screenshot...');
    // Take a full page screenshot
    await page.screenshot({ path: '/Users/tobiasmorixbauer/.gemini/antigravity/brain/1251316c-36f4-4044-8a87-311a19041fe2/inter_warehouse_transfer_before.png', fullPage: true });
});
