import { test, expect } from '@playwright/test';

test('capture current state of sales orders page', async ({ page }) => {
    // Go to the login page
    await page.goto('/login');

    // Fill in the login form
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');

    // Wait for navigation to the dashboard or home page
    await page.waitForURL('**/dashboard');

    // Navigate to the Sales Orders page
    await page.goto('/sales-orders');

    // Wait for the page to load
    await page.waitForSelector('h1', { state: 'visible' });

    // Take a full page screenshot
    await page.screenshot({ path: 'output/sales-orders-before.png', fullPage: true });
});
