import { expect, test } from "@playwright/test";
import { createE2EUserWithRoles } from "./helpers/api";

test("darkmode persistence flow keeps theme preference across reload", async ({ page, request }) => {
  test.slow();
  const user = await createE2EUserWithRoles(request, ["admin"]);

  await page.goto("/login");
  await page.getByTestId("login-username").fill(user.username);
  await page.getByTestId("login-password").fill(user.password);
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/dashboard$/);
  const isMobileLayout = await page.evaluate(() => window.matchMedia("(max-width: 1100px)").matches);
  if (isMobileLayout) {
    await page.getByTestId("sidebar-toggle").click();
  }

  const themeButton = page.getByTestId("theme-toggle-btn");
  await expect(themeButton).toBeVisible();
  const before = await page.evaluate(() => document.documentElement.getAttribute("data-theme") ?? "light");
  await themeButton.click();
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => document.documentElement.getAttribute("data-theme") ?? "light");
  expect(after).not.toBe(before);
  await page.reload();
  if (isMobileLayout) {
    await page.getByTestId("sidebar-toggle").click();
  }
  await expect(page.getByTestId("theme-toggle-btn")).toBeVisible();
  await expect
    .poll(
      async () => await page.evaluate(() => document.documentElement.getAttribute("data-theme") ?? "light"),
      { timeout: 5000 }
    )
    .toBe(after);
});
