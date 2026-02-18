import { expect, test, type Page } from "@playwright/test";

import { createE2EUserWithRoles } from "./helpers/api";

const VALID_USERNAME = process.env.E2E_ADMIN_USERNAME ?? "admin";
const VALID_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "DirectStock2026!";

async function loginUi(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByTestId("login-username").fill(VALID_USERNAME);
  await page.getByTestId("login-password").fill(VALID_PASSWORD);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function loginWithCredentials(
  page: Page,
  username: string,
  password: string,
  expectedPath: RegExp = /\/dashboard$/,
): Promise<void> {
  await page.goto("/login");
  await page.getByTestId("login-username").fill(username);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(expectedPath);
}

test.describe("auth guards and session behavior", () => {
  test("invalid login shows error and stays on login", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("login-username").fill("invalid-user");
    await page.getByTestId("login-password").fill("invalid-password");
    await page.getByTestId("login-submit").click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByTestId("login-error")).toContainText("Anmeldung fehlgeschlagen");
  });

  test("unauthenticated access to protected route redirects to login", async ({ page }) => {
    await page.goto("/reports");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByTestId("login-form")).toBeVisible();
  });

  test("valid login redirects to dashboard", async ({ page }) => {
    await loginUi(page);
    await expect(page.getByTestId("dashboard-page")).toBeVisible();
  });

  test("user without dashboard permission redirects to first accessible page after login", async ({ page, request }) => {
    const scopedUser = await createE2EUserWithRoles(request, ["auditor"]);
    await loginWithCredentials(page, scopedUser.username, scopedUser.password, /\/documents$/);
  });

  test("deep-link to inaccessible page falls back to first accessible page after login", async ({ page, request }) => {
    const scopedUser = await createE2EUserWithRoles(request, ["auditor"]);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);

    await page.getByTestId("login-username").fill(scopedUser.username);
    await page.getByTestId("login-password").fill(scopedUser.password);
    await page.getByTestId("login-submit").click();

    await expect(page).toHaveURL(/\/documents$/);
  });

  test("logout clears session and revokes current API token", async ({ page, request }) => {
    const scopedUser = await createE2EUserWithRoles(request, ["admin"]);
    await loginWithCredentials(page, scopedUser.username, scopedUser.password);

    const accessToken = await page.evaluate(() => {
      const raw = window.localStorage.getItem("directstock-auth");
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { state?: { accessToken?: string } };
      return parsed.state?.accessToken ?? null;
    });

    expect(accessToken).not.toBeNull();
    expect(accessToken).not.toBe("");

    await page.getByTestId("logout-btn").click();
    await expect(page).toHaveURL(/\/login$/);

    const meResponse = await request.get("/api/auth/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    expect(meResponse.status()).toBe(401);

    const payload = (await meResponse.json()) as {
      code: string;
      message: string;
      request_id: string;
      details: unknown;
    };
    expect(payload.code).toBe("unauthenticated");
    expect(payload.request_id).not.toBe("");
  });
});
