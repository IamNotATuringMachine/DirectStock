import { test, expect } from '@playwright/test';

const ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME ?? "admin";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "DirectStock2026!";

test('verify inter-warehouse transfer page layout', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="login-username"]', ADMIN_USERNAME);
    await page.fill('[data-testid="login-password"]', ADMIN_PASSWORD);
    await page.click('[data-testid="login-submit"]');
    await expect(page).toHaveURL(/\/dashboard(?:$|[?#])/);

    await page.goto('/inter-warehouse-transfer');
    await expect(page.getByTestId("inter-warehouse-transfer-page")).toBeVisible();

    await page.waitForTimeout(1000);

    if (page.viewportSize()?.width && page.viewportSize()!.width > 1000) {
        await page.screenshot({ path: 'output/inter_warehouse_transfer_after_desktop.png', fullPage: true });
    } else {
        await page.screenshot({ path: 'output/inter_warehouse_transfer_after_mobile.png', fullPage: true });
    }
});
