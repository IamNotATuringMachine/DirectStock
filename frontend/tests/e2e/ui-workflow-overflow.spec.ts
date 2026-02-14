import { expect, test, type Page } from "@playwright/test";

const WORKFLOW_PAGES: Array<{ path: string; testId: string }> = [
  { path: "/goods-receipt", testId: "goods-receipt-page" },
  { path: "/goods-issue", testId: "goods-issue-page" },
  { path: "/stock-transfer", testId: "stock-transfer-page" },
];

async function login(page: Page) {
  await page.goto("/login");
  await page.getByTestId("login-username").fill(process.env.E2E_ADMIN_USERNAME ?? "admin");
  await page.getByTestId("login-password").fill(process.env.E2E_ADMIN_PASSWORD ?? "DirectStock2026!");
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe("workflow overflow guard", () => {
  test("workflow pages have no global overflow and no topbar overlap", async ({ page }) => {
    await login(page);

    for (const item of WORKFLOW_PAGES) {
      await page.goto(item.path);
      await expect(page.getByTestId(item.testId)).toBeVisible();

      const metrics = await page.evaluate(() => {
        const topbar = document.querySelector(".topbar");
        const content = document.querySelector(".content");
        const html = document.documentElement;
        const body = document.body;
        const topbarRect = topbar?.getBoundingClientRect();
        const contentRect = content?.getBoundingClientRect();

        return {
          viewportWidth: window.innerWidth,
          htmlScrollWidth: html.scrollWidth,
          bodyScrollWidth: body.scrollWidth,
          topbarBottom: topbarRect?.bottom ?? 0,
          contentTop: contentRect?.top ?? 0,
        };
      });

      expect(metrics.htmlScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
      expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
      expect(metrics.topbarBottom).toBeLessThanOrEqual(metrics.contentTop + 1);
    }
  });
});
