import { test, expect } from "@playwright/test";

test("capture approvals page before", async ({ page, request }) => {
    // Login
    await page.goto("/login");
    await page.getByTestId("login-username").fill("admin");
    await page.getByTestId("login-password").fill("DirectStock2026!");
    await page.getByTestId("login-submit").click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // Seed data (optional, but good for visualization)
    const headers = { Authorization: `Bearer ${await (await request.post("/api/login/access-token", { form: { username: "admin", password: "DirectStock2026!" } })).json().then(r => r.access_token)}` };
    // Clean up existing if possible? No, just add one.
    await request.post("/api/approvals", {
        headers,
        data: {
            entity_type: "purchase_order",
            entity_id: 999,
            amount: "123.45",
            reason: "Screenshot Demo Request",
        },
    });

    // Navigate to Approvals
    await page.goto("/approvals");
    await expect(page.getByTestId("approvals-page")).toBeVisible();

    // Take Screenshot
    await page.screenshot({ path: "approvals-before.png", fullPage: true });
});
