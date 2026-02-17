import { test, expect } from "@playwright/test";

test("capture approvals page after modernization", async ({ page, request }) => {
    // Login
    await page.goto("/login");
    await page.getByTestId("login-username").fill("admin");
    await page.getByTestId("login-password").fill("DirectStock2026!");
    await page.getByTestId("login-submit").click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // Seed data
    const tokenResp = await request.post("/api/login/access-token", { form: { username: "admin", password: "DirectStock2026!" } });
    const token = (await tokenResp.json()).access_token;
    const headers = { Authorization: `Bearer ${token}` };

    // Seed a long item to test truncation/break
    await request.post("/api/approvals", {
        headers,
        data: {
            entity_type: "purchase_order",
            entity_id: 8888,
            amount: "9999.99",
            reason: "This is a very long reason text to test if the layout breaks or if it wraps correctly as expected in a modern UI.",
        },
    });

    // Navigate to Approvals
    await page.goto("/approvals");
    await expect(page.getByTestId("approvals-page")).toBeVisible();

    // 1. Desktop Light
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.screenshot({ path: "approvals-after-desktop-light.png", fullPage: true });

    // 2. Mobile Light
    await page.setViewportSize({ width: 375, height: 800 });
    await page.screenshot({ path: "approvals-after-mobile-light.png", fullPage: true });

    // 3. Desktop Dark
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    await page.screenshot({ path: "approvals-after-desktop-dark.png", fullPage: true });
});
