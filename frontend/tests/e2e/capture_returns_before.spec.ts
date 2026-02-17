import { test, expect } from '@playwright/test';
import { loginAsAdminApi } from './helpers/api';

test('capture returns page state', async ({ page, request }) => {
    await loginAsAdminApi(request);

    await page.goto('/returns');
    await page.waitForLoadState('networkidle');

    // Create screenshots directory if it doesn't exist (Playwright does this automatically usually, but good to know)

    // Desktop Viewport
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.screenshot({ path: 'frontend/test-results/returns-before-desktop.png', fullPage: true });

    // Mobile Viewport
    await page.setViewportSize({ width: 375, height: 812 });
    // Toggle sidebar if needed or just capture as is
    await page.screenshot({ path: 'frontend/test-results/returns-before-mobile.png', fullPage: true });
});
