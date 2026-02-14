import { expect, test } from "@playwright/test";
import { createE2EUserWithRoles } from "./helpers/api";

test("darkmode persistence flow keeps theme preference across reload", async ({ page, request }) => {
  const user = await createE2EUserWithRoles(request, ["admin"]);

  await page.goto("/login");
  await page.getByTestId("login-username").fill(user.username);
  await page.getByTestId("login-password").fill(user.password);
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/dashboard$/);

  const themeButton = page.getByTestId("theme-toggle-btn");
  const before = (await themeButton.textContent())?.trim() ?? "";
  let after = before;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await themeButton.click();
    await page.waitForTimeout(250);
    after = (await themeButton.textContent())?.trim() ?? "";
    if (after !== before) {
      break;
    }
  }
  expect(after).not.toBe(before);
  await page.reload();
  await expect(themeButton).toHaveText(after);
});
