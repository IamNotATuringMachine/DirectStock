import { expect, test } from "@playwright/test";

import { loginAsAdminApi } from "./helpers/api";

test("audit log page shows phase-3 mutating endpoint entries", async ({ page, request }) => {
  const token = await loginAsAdminApi(request);
  const headers = { Authorization: `Bearer ${token}` };

  const create = await request.post("/api/return-orders", {
    headers,
    data: { notes: `audit-e2e-${Date.now()}` },
  });
  expect(create.ok()).toBeTruthy();

  await page.goto("/login");
  await page.getByTestId("login-username").fill(process.env.E2E_ADMIN_USERNAME ?? "admin");
  await page.getByTestId("login-password").fill(process.env.E2E_ADMIN_PASSWORD ?? "DirectStock2026!");
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/audit-trail");
  await expect(page.getByTestId("audit-trail-page")).toBeVisible();

  await page.getByTestId("audit-filter-entity").fill("return-orders");
  await page.getByTestId("audit-filter-action").fill("POST");

  await expect
    .poll(async () => await page.getByTestId("audit-table").locator("tbody tr").count())
    .toBeGreaterThan(0);
  await expect(page.getByTestId("audit-table")).toContainText("/api/return-orders");
  await expect(page.getByTestId("audit-table")).toContainText("POST");
});
