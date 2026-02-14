import { expect, test } from "@playwright/test";
import { createE2EUserWithRoles } from "./helpers/api";

test("dashboard config flow toggles summary card visibility", async ({ page, request }) => {
  const user = await createE2EUserWithRoles(request, ["admin"]);

  await page.goto("/login");
  await page.getByTestId("login-username").fill(user.username);
  await page.getByTestId("login-password").fill(user.password);
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId("dashboard-page")).toBeVisible();

  const toggle = page.getByTestId("dashboard-card-toggle-summary");
  const kpi = page.getByTestId("dashboard-kpi-total-products");
  await expect(kpi).toBeVisible();

  await toggle.click();
  await expect(kpi).toBeHidden();

  await toggle.click();
  await expect(kpi).toBeVisible();
});
