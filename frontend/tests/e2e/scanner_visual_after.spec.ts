import { test, expect } from '@playwright/test';

test('verify scanner page layout', async ({ page }) => {
    // Log network requests
    // Log network requests
    // page.on('request', request => console.log('>>', request.method(), request.url()));
    // page.on('response', response => console.log('<<', response.status(), response.url()));


    // Mock Authentication
    await page.route('**/api/auth/login', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                access_token: 'mock-access-token',
                refresh_token: 'mock-refresh-token',
                token_type: 'bearer',
                expires_in: 3600
            })
        });
    });

    await page.route('**/api/auth/me', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: 1,
                username: 'admin',
                email: 'admin@directstock.local',
                roles: ['admin'],
                permissions: ['page.scanner.view', 'page.dashboard.view'],
                is_active: true
            })
        });
    });

    // Mock Token Refresh
    await page.route('**/api/auth/refresh', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                access_token: 'mock-access-token-refreshed',
                refresh_token: 'mock-refresh-token-refreshed',
                token_type: 'bearer',
                expires_in: 3600
            })
        });
    });

    // Mock UI Preferences
    await page.route('**/api/ui-preferences/me', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                theme: 'light',
                density: 'comfortable'
            })
        });
    });

    // Mock Dashboard data
    await page.route('**/api/dashboard/summary', async route => {
        await route.fulfill({ status: 200, body: JSON.stringify({}) });
    });

    // Login
    await page.goto('/login');
    await page.fill('[data-testid="login-username"]', 'admin');
    await page.fill('[data-testid="login-password"]', 'password');
    await page.click('[data-testid="login-submit"]');
    await page.waitForURL('**/dashboard');

    // Navigate to Scanner
    await page.goto('/scanner');
    // Wait for the new header to appear
    await page.waitForSelector('h1:has-text("Scanner")', { state: 'visible' });

    // Wait a bit for everything to settle
    await page.waitForTimeout(1000);

    // Desktop Screenshot
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.waitForTimeout(500); // Allow resize to settle
    await page.screenshot({ path: 'output/scanner_after_desktop.png', fullPage: true });

    // Mobile Screenshot
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500); // Allow resize to settle
    await page.screenshot({ path: 'output/scanner_after_mobile.png', fullPage: true });
});
