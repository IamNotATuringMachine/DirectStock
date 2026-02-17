import { test, expect } from '@playwright/test';
import { loginAsAdminApi } from './helpers/api';

test('capture returns page simple', async ({ page, request }) => {
    await loginAsAdminApi(request);

    await page.goto('/returns');
    await page.waitForLoadState('networkidle');

    // Desktop Viewport
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.screenshot({ path: 'returns-final-desktop.png', fullPage: true });

    // Mobile Viewport
    await page.setViewportSize({ width: 375, height: 812 });
    await page.screenshot({ path: 'returns-final-mobile.png', fullPage: true });
});
