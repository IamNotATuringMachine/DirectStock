import { expect, test, type Page } from "@playwright/test";

const PAGES: Array<{ path: string; testId: string; navLabel: string }> = [
  { path: "/dashboard", testId: "dashboard-page", navLabel: "Dashboard" },
  { path: "/inventory", testId: "inventory-page", navLabel: "Bestandsübersicht" },
  { path: "/products", testId: "products-page", navLabel: "Artikelstamm" },
  { path: "/reports", testId: "reports-page", navLabel: "Reports" },
  { path: "/alerts", testId: "alerts-page", navLabel: "Alerts" },
  { path: "/goods-receipt", testId: "goods-receipt-page", navLabel: "Wareneingang" },
  { path: "/goods-issue", testId: "goods-issue-page", navLabel: "Warenausgang" },
  { path: "/stock-transfer", testId: "stock-transfer-page", navLabel: "Umlagerung" },
  { path: "/shipping", testId: "shipping-page", navLabel: "Shipping" },
  { path: "/scanner", testId: "scanner-page", navLabel: "Scanner" },
];

async function login(page: Page) {
  await page.goto("/login");
  await page.getByTestId("login-username").fill(process.env.E2E_ADMIN_USERNAME ?? "admin");
  await page.getByTestId("login-password").fill(process.env.E2E_ADMIN_PASSWORD ?? "DirectStock2026!");
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe("responsive layout baseline", () => {
  test("core pages render without viewport overflow and topbar overlap", async ({ page }) => {
    await login(page);
    const isMobileLayout = await page.evaluate(() => window.matchMedia("(max-width: 1100px)").matches);
    const shell = page.getByTestId("app-shell");

    for (const item of PAGES) {
      if (isMobileLayout) {
        const isDrawerOpen = await shell.evaluate((node) => node.classList.contains("mobile-nav-open"));
        if (!isDrawerOpen) {
          await page.getByTestId("sidebar-toggle").click();
        }
      }

      await page.getByRole("navigation").getByRole("link", { name: item.navLabel }).click();
      await expect(page).toHaveURL(new RegExp(`${item.path.replace("/", "\\/")}$`));
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
          hasTopbar: Boolean(topbarRect),
          hasContent: Boolean(contentRect),
          topbarBottom: topbarRect?.bottom ?? 0,
          contentTop: contentRect?.top ?? 0,
        };
      });

      expect(metrics.hasTopbar).toBeTruthy();
      expect(metrics.hasContent).toBeTruthy();
      expect(metrics.htmlScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
      expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
      expect(metrics.topbarBottom).toBeLessThanOrEqual(metrics.contentTop + 1);
    }
  });

  test("mobile and tablet drawer opens and closes correctly", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard");

    const isMobileLayout = await page.evaluate(() => window.matchMedia("(max-width: 1100px)").matches);
    test.skip(!isMobileLayout, "Drawer behavior applies only for mobile/tablet layouts.");

    const shell = page.getByTestId("app-shell");
    await expect(shell).not.toHaveClass(/mobile-nav-open/);

    await page.getByTestId("sidebar-toggle").click();
    await expect(shell).toHaveClass(/mobile-nav-open/);
    await expect(page.getByRole("navigation").getByRole("link", { name: "Dashboard" })).toBeVisible();

    await page.getByRole("navigation").getByRole("link", { name: "Bestandsübersicht" }).click();
    await expect(page).toHaveURL(/\/inventory$/);
    await expect(shell).not.toHaveClass(/mobile-nav-open/);
  });
});
