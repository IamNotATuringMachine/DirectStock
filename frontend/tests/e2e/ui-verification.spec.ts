import { test, expect } from '@playwright/test';

test('verify UI changes for Artikelstamm and Top Taskbar', async ({ page }) => {
    // Go to Products page
    await page.goto('/products');

    // Login if redirected
    if (page.url().includes('/login')) {
        console.log('On login page, attempting to login...');
        await page.fill('[data-testid="login-username"]', 'admin');
        await page.fill('[data-testid="login-password"]', 'DirectStock2026!');
        await page.click('[data-testid="login-submit"]');

        // Wait for navigation to dashboard or products
        await page.waitForURL(/.*(dashboard|products).*/, { timeout: 15000 });
        console.log('Login submitted, current URL:', page.url());

        // If we landed on dashboard, click on Products
        if (page.url().includes('/dashboard')) {
            await page.goto('/products');
        }
    }

    // Ensure we are on products page
    console.log('Current URL before expect:', page.url());
    if (page.url().includes('/dashboard')) {
        console.log('Redirected to dashboard, navigating to products...');
        await page.goto('/products');
    }
    await expect(page).toHaveURL(/.*\/products.*/);

    // 1. Verify Artikelstamm Search Input
    const searchInput = page.locator('[data-testid="products-search-input"]');
    await expect(searchInput).toBeVisible();

    // Check for 'pl-10' class which we added
    await expect(searchInput).toHaveClass(/pl-10/);

    // 2. Verify Search Icon (sibling of input)
    // We can find it by its parent relative div
    const searchIcon = page.locator('.relative > .lucide-search');
    await expect(searchIcon).toHaveClass(/pointer-events-none/);
    await expect(searchIcon).toHaveClass(/left-3\.5/);

    // 3. Verify Filter Input
    const statusSelect = page.locator('[data-testid="products-status-filter"]');
    await expect(statusSelect).toHaveClass(/pl-10/);

    // 4. Verify Top Taskbar Title
    const topbarTitle = page.locator('.topbar-title');
    await expect(topbarTitle).toHaveClass(/font-semibold/);
    await expect(topbarTitle).toHaveClass(/tracking-tight/);
    await expect(topbarTitle).toHaveClass(/text-lg/);

    // 5. Verify User Avatar Section
    const userAvatar = page.locator('.user-avatar');
    await expect(userAvatar).toBeVisible();
    await expect(userAvatar).toHaveClass(/rounded-full/);
});
