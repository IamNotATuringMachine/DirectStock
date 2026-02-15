import { expect, test, type Locator, type Page } from "@playwright/test";

type TableTarget = {
  path: string;
  tableTestId: string;
  requiredRows: boolean;
  prepare?: (page: Page) => Promise<void>;
};

const TABLE_TARGETS: TableTarget[] = [
  { path: "/products", tableTestId: "products-table", requiredRows: true },
  { path: "/inventory", tableTestId: "inventory-table", requiredRows: true },
  { path: "/alerts", tableTestId: "alerts-table", requiredRows: false },
  { path: "/users", tableTestId: "users-table", requiredRows: true },
  { path: "/sales-orders", tableTestId: "sales-orders-table", requiredRows: false },
  { path: "/invoices", tableTestId: "invoices-table", requiredRows: false },
  { path: "/services", tableTestId: "services-table", requiredRows: false },
  { path: "/audit-trail", tableTestId: "audit-table", requiredRows: true },
  {
    path: "/purchasing",
    tableTestId: "abc-table",
    requiredRows: false,
    prepare: async (page) => {
      const tab = page.getByTestId("purchasing-tab-abc");
      if (await tab.count()) {
        await tab.click();
      }
    },
  },
  {
    path: "/shipping",
    tableTestId: "shipping-tracking-table",
    requiredRows: false,
    prepare: async (page) => {
      const firstShipment = page.locator("[data-testid^='shipping-item-']").first();
      if (await firstShipment.count()) {
        await firstShipment.click();
      }
    },
  },
];

async function login(page: Page) {
  await page.goto("/login");
  await page.getByTestId("login-username").fill(process.env.E2E_ADMIN_USERNAME ?? "admin");
  await page.getByTestId("login-password").fill(process.env.E2E_ADMIN_PASSWORD ?? "DirectStock2026!");
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function getBeforeContent(locator: Locator): Promise<string> {
  return locator.evaluate((node) => getComputedStyle(node, "::before").content);
}

async function ensureAuthenticatedOnPath(page: Page, path: string) {
  await page.goto(path);
  if (/\/login$/.test(page.url())) {
    await login(page);
    await page.goto(path);
  }
}

test.describe("mobile cards table readability", () => {
  test("mobile layout shows data-label markers on cardified tables", async ({ page }) => {
    await login(page);
    const isMobile = await page.evaluate(() => window.matchMedia("(max-width: 768px)").matches);
    test.skip(!isMobile, "Card table layout only applies to mobile viewports.");

    for (const target of TABLE_TARGETS) {
      await ensureAuthenticatedOnPath(page, target.path);
      if (target.prepare) {
        await target.prepare(page);
      }

      const table = page.getByTestId(target.tableTestId);
      if ((await table.count()) === 0) {
        continue;
      }

      await expect(table).toHaveClass(/mobile-cards-table/);
      const rows = table.locator("tbody tr");
      if (target.requiredRows) {
        await expect.poll(async () => await rows.count()).toBeGreaterThan(0);
      }
      const rowCount = await rows.count();
      if (rowCount === 0) {
        continue;
      }

      const labeledCell = table.locator("tbody tr td[data-label]").first();
      await expect(labeledCell).toBeVisible();
      const pseudoContent = await getBeforeContent(labeledCell);
      expect(pseudoContent).not.toBe("none");
      expect(pseudoContent).not.toBe('""');

      const metrics = await page.evaluate(() => ({
        viewportWidth: window.innerWidth,
        htmlScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
      }));
      expect(metrics.htmlScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
      expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    }
  });

  test("desktop keeps header row and no pseudo labels", async ({ page }) => {
    await login(page);
    const isMobile = await page.evaluate(() => window.matchMedia("(max-width: 768px)").matches);
    test.skip(isMobile, "Desktop-only assertion.");

    await page.goto("/products");
    const table = page.getByTestId("products-table");
    await expect(table).toHaveClass(/mobile-cards-table/);
    await expect(table.locator("thead")).toBeVisible();

    const firstCell = table.locator("tbody tr td[data-label]").first();
    await expect(firstCell).toBeVisible();
    const pseudoContent = await getBeforeContent(firstCell);
    expect(pseudoContent).toBe("none");
  });
});
