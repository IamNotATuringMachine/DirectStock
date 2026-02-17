import { test, expect } from '@playwright/test';

test('capture inter-warehouse transfer page state', async ({ page }) => {
    // Go to the login page
    await page.goto('http://localhost:5173/login');

    // Fill in the login form
    await page.fill('input[type="email"]', 'admin@directstock.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');

    // Wait for navigation to dashboard
    await page.waitForURL('**/dashboard');

    // Navigate to Inter-Warehouse Transfer page
    await page.goto('http://localhost:5173/inter-warehouse-transfer');

    // Wait for the page to load
    await page.waitForSelector('h1', { state: 'visible' });

    // Wait a bit for any animations or data fetching
    await page.waitForTimeout(2000);

    // Take a full page screenshot
    await page.screenshot({ path: '/Users/tobiasmorixbauer/.gemini/antigravity/brain/1251316c-36f4-4044-8a87-311a19041fe2/inter_warehouse_transfer_before.png', fullPage: true });
});
