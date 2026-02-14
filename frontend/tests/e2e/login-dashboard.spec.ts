import { expect, test } from "@playwright/test";
import { ensureDashboardCardVisible, loginAsAdminApi } from "./helpers/api";

test("login to dashboard shows KPI data", async ({ page, request }) => {
  const token = await loginAsAdminApi(request);
  await ensureDashboardCardVisible(request, token, "summary");

  await page.goto("/login");

  await page.getByTestId("login-username").fill(process.env.E2E_ADMIN_USERNAME ?? "admin");
  await page.getByTestId("login-password").fill(process.env.E2E_ADMIN_PASSWORD ?? "DirectStock2026!");
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId("dashboard-page")).toBeVisible();

  const kpiValue = page.getByTestId("dashboard-kpi-total-products").locator("strong");
  await expect.poll(async () => (await kpiValue.textContent())?.trim() ?? "").not.toBe("-");
});
