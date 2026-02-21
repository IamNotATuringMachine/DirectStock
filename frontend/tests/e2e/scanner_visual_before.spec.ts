import { expect, test } from "@playwright/test";

import { loginAndOpenRoute, saveProjectScopedScreenshot } from "./helpers/ui";

test("capture scanner page state", async ({ page }, testInfo) => {
  test.slow();
  await loginAndOpenRoute(page, "/scanner", { rootTestId: "scanner-page" });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await saveProjectScopedScreenshot(page, testInfo, "scanner-before");
  await expect(page.getByTestId("scanner-page")).toBeVisible();
});
