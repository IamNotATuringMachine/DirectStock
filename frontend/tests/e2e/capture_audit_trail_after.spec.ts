import { test, expect } from '@playwright/test';
import { loginAsAdminApi } from './helpers/api';

test('capture audit trail page after', async ({ page, request }) => {
    // 1. Login
    const token = await loginAsAdminApi(request);

    // 2. Inject some data to make sure list is not empty
    const headers = { Authorization: `Bearer ${token}` };
    await request.post("/api/return-orders", {
        headers,
        data: { notes: `audit-capture-after-${Date.now()}` },
    });

    // 3. Navigate
    await page.goto('/audit-trail');
    await page.waitForLoadState('networkidle');

    // 4. Capture Desktop
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.screenshot({ path: 'audit-trail-after-desktop.png', fullPage: true });

    // 5. Capture Mobile
    await page.setViewportSize({ width: 375, height: 812 });
    await page.screenshot({ path: 'audit-trail-after-mobile.png', fullPage: true });
});
