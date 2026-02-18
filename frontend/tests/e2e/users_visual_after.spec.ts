import { test, expect } from '@playwright/test';

test('verify users page layout after modernization', async ({ page }) => {
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
                permissions: ['page.users.view', 'page.dashboard.view'],
                is_active: true
            })
        });
    });

    // Mock Users Data
    await page.route('**/api/users*', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                items: [
                    {
                        id: 1,
                        username: 'admin',
                        email: 'admin@directstock.local',
                        full_name: 'Administrator',
                        roles: ['admin'],
                        is_active: true,
                        created_at: '2026-01-01T00:00:00Z',
                        updated_at: '2026-01-01T00:00:00Z'
                    },
                    {
                        id: 2,
                        username: 'lager1',
                        email: 'lager1@directstock.local',
                        full_name: 'Lager Mitarbeiter 1',
                        roles: ['lagermitarbeiter'],
                        is_active: true,
                        created_at: '2026-01-01T00:00:00Z',
                        updated_at: '2026-01-01T00:00:00Z'
                    },
                    {
                        id: 3,
                        username: 'inactive_user',
                        email: 'inactive@directstock.local',
                        full_name: 'LongNameUserWithPotentialOverflowIssuesIfNotHandledCorrectly',
                        roles: ['viewer', 'controller', 'auditor', 'purchasing'],
                        is_active: false,
                        created_at: '2026-01-01T00:00:00Z',
                        updated_at: '2026-01-01T00:00:00Z'
                    }
                ]
            })
        });
    });

    await page.route('**/api/users/*/access-profile', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                user_id: 2,
                username: 'lager1',
                roles: ['lagermitarbeiter'],
                allow_permissions: ['module.permissions.read'],
                deny_permissions: [],
                effective_permissions: ['page.dashboard.view', 'module.permissions.read']
            })
        });
    });

    // Mock Roles Data
    await page.route('**/api/roles', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
                { id: 1, name: 'admin', permissions: ['all'] },
                { id: 2, name: 'lagermitarbeiter', permissions: ['read', 'write'] },
                { id: 3, name: 'viewer', permissions: ['read'] },
                { id: 4, name: 'controller', permissions: ['read', 'report'] },
                { id: 5, name: 'auditor', permissions: ['read', 'audit'] },
                { id: 6, name: 'purchasing', permissions: ['read', 'purchase'] }
            ])
        });
    });

    // Mock Permissions Data
    await page.route('**/api/permissions', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
                { code: 'read', description: 'Read access' },
                { code: 'write', description: 'Write access' },
                { code: 'delete', description: 'Delete access' },
                { code: 'admin', description: 'Admin access' },
                { code: 'report', description: 'View reports' },
                { code: 'audit', description: 'Audit access' },
                { code: 'purchase', description: 'Purchase access' },
                { code: 'very.long.permission.code.that.might.break.layout.if.not.wrapped.properly', description: 'Long permission description' }
            ])
        });
    });

    // Mock Token Refresh and UI Preferences (Standard Boilerplate)
    await page.route('**/api/auth/refresh', async route => {
        await route.fulfill({ status: 200, body: JSON.stringify({ access_token: 'mock', refresh_token: 'mock' }) });
    });
    await page.route('**/api/ui-preferences/me', async route => {
        await route.fulfill({ status: 200, body: JSON.stringify({ theme: 'light', density: 'comfortable' }) });
    });
    await page.route('**/api/dashboard/summary', async route => {
        await route.fulfill({ status: 200, body: JSON.stringify({}) });
    });


    // Login and Navigate
    await page.goto('/login');
    await page.fill('[data-testid="login-username"]', 'admin');
    await page.fill('[data-testid="login-password"]', 'password');
    await page.click('[data-testid="login-submit"]');
    await page.waitForURL('**/dashboard');

    await page.goto('/users');
    await page.waitForSelector('h2:has-text("Benutzerverwaltung")', { state: 'visible' });
    await page.waitForTimeout(1000); // Allow animations/fetches to settle

    // Desktop Screenshot
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'output/users_after_desktop.png', fullPage: true });

    // Mobile Screenshot
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'output/users_after_mobile.png', fullPage: true });
});
