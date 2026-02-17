import { test, expect } from '@playwright/test';

test.setTimeout(60000);

test('visual stress test of sales orders page', async ({ page }) => {
    // Go to the login page
    console.log('Navigating to login...');
    await page.goto('http://localhost:5173/login', { timeout: 30000 });

    // Fill in the login form
    console.log('Filling login form...');
    await page.waitForSelector('input[type="email"]', { state: 'visible', timeout: 10000 });
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');

    // Wait for navigation to the dashboard or home page
    console.log('Waiting for dashboard...');
    await page.waitForURL('**/dashboard', { timeout: 30000 });

    // Navigate to the Sales Orders page
    console.log('Navigating to sales orders...');
    await page.goto('http://localhost:5173/sales-orders');

    // Wait for the page to load
    console.log('Waiting for page header...');
    // Use h2 which is "Verkaufsaufträge"
    await page.waitForSelector('h2', { state: 'visible', timeout: 30000 });

    // 1. Desktop Viewport
    console.log('Taking desktop screenshot...');
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.waitForTimeout(2000); // Allow layout to settle
    await page.screenshot({ path: 'sales-orders-modern-desktop.png', fullPage: true });

    // Check for horizontal scrolling on body (should be 0)
    const scrollWidthDesktop = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidthDesktop = await page.evaluate(() => window.innerWidth);
    expect(scrollWidthDesktop).toBeLessThanOrEqual(viewportWidthDesktop);

    // Open details of first order if available
    const detailsButtons = page.locator('button:has-text("Details")');
    if (await detailsButtons.count() > 0) {
        console.log('Opening details...');
        await detailsButtons.first().click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'sales-orders-details-desktop.png', fullPage: true });
    }

    // 2. Mobile Viewport
    console.log('Taking mobile screenshot...');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(2000); // Allow layout to settle
    await page.screenshot({ path: 'sales-orders-modern-mobile.png', fullPage: true });

    // Check for horizontal scrolling on body (should be 0 or very close)
    const scrollWidthMobile = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidthMobile = await page.evaluate(() => window.innerWidth);
    expect(scrollWidthMobile).toBeLessThanOrEqual(viewportWidthMobile);

    // details should still be open
    await page.screenshot({ path: 'sales-orders-details-mobile.png', fullPage: true });
    console.log('Test completed.');
});
