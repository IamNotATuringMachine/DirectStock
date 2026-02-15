import { expect, test, type Page } from "@playwright/test";

const CORE_PAGES: Array<{ path: string; testId: string; navLabel: string }> = [
  { path: "/dashboard", testId: "dashboard-page", navLabel: "Dashboard" },
  { path: "/inventory", testId: "inventory-page", navLabel: "Bestandsübersicht" },
  { path: "/products", testId: "products-page", navLabel: "Artikelstamm" },
  { path: "/reports", testId: "reports-page", navLabel: "Berichte" },
  { path: "/alerts", testId: "alerts-page", navLabel: "Warnungen" },
];

async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByTestId("login-username").fill(process.env.E2E_ADMIN_USERNAME ?? "admin");
  await page.getByTestId("login-password").fill(process.env.E2E_ADMIN_PASSWORD ?? "DirectStock2026!");
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe("shell navigation smoke", () => {
  test("core page navigation works across layouts", async ({ page }) => {
    await login(page);

    const isMobileLayout = await page.evaluate(() => window.matchMedia("(max-width: 1100px)").matches);
    const shell = page.getByTestId("app-shell");

    for (const item of CORE_PAGES) {
      if (isMobileLayout) {
        const drawerOpen = await shell.evaluate((node) => node.classList.contains("mobile-nav-open"));
        if (!drawerOpen) {
          await page.getByTestId("sidebar-toggle").click();
        }
      }

      await page.getByRole("navigation").getByRole("link", { name: item.navLabel }).click();
      await expect(page).toHaveURL(new RegExp(`${item.path.replace("/", "\\/")}$`));
      await expect(page.getByTestId(item.testId)).toBeVisible();
    }
  });

  test("mobile drawer opens and closes via navigation", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard");

    const isMobileLayout = await page.evaluate(() => window.matchMedia("(max-width: 1100px)").matches);
    test.skip(!isMobileLayout, "Drawer behavior only applies to mobile/tablet layouts.");

    const shell = page.getByTestId("app-shell");
    await expect(shell).not.toHaveClass(/mobile-nav-open/);

    await page.getByTestId("sidebar-toggle").click();
    await expect(shell).toHaveClass(/mobile-nav-open/);

    await page.getByRole("navigation").getByRole("link", { name: "Bestandsübersicht" }).click();
    await expect(page).toHaveURL(/\/inventory$/);
    await expect(shell).not.toHaveClass(/mobile-nav-open/);
  });
});
