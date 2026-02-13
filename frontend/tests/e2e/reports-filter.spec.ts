import { expect, test } from "@playwright/test";

import { ensureE2EInventoryStock, loginAsAdminApi } from "./helpers/api";

test("reports page supports movement filter and csv export", async ({ page, request }) => {
  const token = await loginAsAdminApi(request);
  await ensureE2EInventoryStock(request, token, `E2E-RP-${Date.now()}`);

  const today = new Date().toISOString().slice(0, 10);

  await page.goto("/login");
  await page.getByTestId("login-username").fill(process.env.E2E_ADMIN_USERNAME ?? "admin");
  await page.getByTestId("login-password").fill(process.env.E2E_ADMIN_PASSWORD ?? "DirectStock2026!");
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/reports");
  await expect(page.getByTestId("reports-page")).toBeVisible();

  await page.getByTestId("reports-type-select").selectOption("movements");
  await page.getByTestId("reports-date-from").fill(today);
  await page.getByTestId("reports-date-to").fill(today);

  await expect.poll(async () => await page.getByTestId("reports-movements-table").locator("tbody tr").count()).toBeGreaterThan(0);
  await expect(page.getByTestId("reports-movements-table")).toContainText("goods_receipt");

  await page.getByTestId("reports-download-csv-btn").click();
});
