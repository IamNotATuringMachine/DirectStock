import { test, expect } from '@playwright/test';
import path from 'path';

test('capture scanner page state', async ({ page }) => {
    // Login
    await page.goto('http://localhost:5173/login');
    await page.fill('[data-testid="login-username"]', 'admin@directstock.com');
    await page.fill('[data-testid="login-password"]', 'password');
    await page.click('[data-testid="login-submit"]');
    await page.waitForURL('**/dashboard');

    // Navigate
    await page.goto('http://localhost:5173/scanner');
    // Wait for some content (the heading likely)
    // I'll wait specifically for 'Scanner' or similar text,
    // but just to be safe I'll wait for a generic selector or timeout.
    // The previous test waited for h1. Let's inspect ScannerPage.tsx quickly to be sure.
    // Actually, I'll just wait for load state networkidle.
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Take screenshot
    const screenshotPath = '/Users/tobiasmorixbauer/.gemini/antigravity/brain/9ea0c9c3-927e-4c40-8dab-f95367654367/scanner_before.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
});
