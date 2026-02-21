import { expect, test } from "@playwright/test";

import { loginAndOpenRoute, saveProjectScopedScreenshot } from "./helpers/ui";

test("visual stress test of sales orders page", async ({ page }, testInfo) => {
  test.slow();
  await loginAndOpenRoute(page, "/sales-orders", { rootTestId: "sales-orders-page" });

  await page.setViewportSize({ width: 1400, height: 900 });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await saveProjectScopedScreenshot(page, testInfo, "sales-orders-modern-desktop");

  const scrollWidthDesktop = await page.evaluate(() => document.body.scrollWidth);
  const viewportWidthDesktop = await page.evaluate(() => window.innerWidth);
  expect(scrollWidthDesktop).toBeLessThanOrEqual(viewportWidthDesktop + 1);

  const detailsButtons = page.locator('button:has-text("Details")');
  if ((await detailsButtons.count()) > 0) {
    await detailsButtons.first().click();
    await page.waitForTimeout(300);
    await saveProjectScopedScreenshot(page, testInfo, "sales-orders-details-desktop");
  }

  await page.setViewportSize({ width: 375, height: 667 });
  await expect(page.getByTestId("sales-orders-page")).toBeVisible();
  await saveProjectScopedScreenshot(page, testInfo, "sales-orders-modern-mobile");

  await saveProjectScopedScreenshot(page, testInfo, "sales-orders-details-mobile");
});
