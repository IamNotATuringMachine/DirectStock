import { expect, test, type Page } from "@playwright/test";

import { loginViaUi } from "./helpers/ui";

type RouteConfig = {
  path: string;
  testId: string;
};

const ROUTES: RouteConfig[] = [
  { path: "/dashboard", testId: "dashboard-page" },
  { path: "/products", testId: "products-page" },
  { path: "/warehouse", testId: "warehouse-page" },
  { path: "/inventory", testId: "inventory-page" },
  { path: "/inventory-counts", testId: "inventory-count-page" },
  { path: "/purchasing", testId: "purchasing-page" },
  { path: "/picking", testId: "picking-page" },
  { path: "/returns", testId: "returns-page" },
  { path: "/approvals", testId: "approvals-page" },
  { path: "/documents", testId: "documents-page" },
  { path: "/audit-trail", testId: "audit-trail-page" },
  { path: "/reports", testId: "reports-page" },
  { path: "/alerts", testId: "alerts-page" },
  { path: "/goods-receipt", testId: "goods-receipt-page" },
  { path: "/goods-issue", testId: "goods-issue-page" },
  { path: "/stock-transfer", testId: "stock-transfer-page" },
  { path: "/inter-warehouse-transfer", testId: "inter-warehouse-transfer-page" },
  { path: "/shipping", testId: "shipping-page" },
  { path: "/scanner", testId: "scanner-page" },
  { path: "/sales-orders", testId: "sales-orders-page" },
  { path: "/invoices", testId: "invoices-page" },
  { path: "/users", testId: "users-page" },
];

const ROLE_CLASSES = ["section-title", "form-label-standard", "table-head-standard"] as const;

async function openRouteAndEnsureVisible(page: Page, route: RouteConfig): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.goto(route.path, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await expect(page.getByTestId(route.testId)).toBeVisible({ timeout: 45_000 });
      return;
    } catch (error) {
      if (attempt === 1) {
        throw error;
      }
      await loginViaUi(page);
    }
  }
}

test.describe("Taskbar Typography Consistency", () => {
  test("uses dashboard-aligned page frame and heading typography", async ({ page }) => {
    test.slow();
    await loginViaUi(page);

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator('[data-testid="dashboard-page"] .page-title')).toBeVisible();

    const dashboardHeadingSize = await page.evaluate(() => {
      const heading = document.querySelector('[data-testid="dashboard-page"] .page-title') as HTMLElement | null;
      if (!heading) return null;
      return getComputedStyle(heading).fontSize;
    });

    expect(dashboardHeadingSize).not.toBeNull();

    const seenRoleClass = new Set<(typeof ROLE_CLASSES)[number]>();

    for (const route of ROUTES) {
      await openRouteAndEnsureVisible(page, route);
      await expect(page.getByTestId(route.testId)).toHaveClass(/\bpage\b/);

      const headingSize = await page.evaluate((testId) => {
        const heading = document.querySelector(`[data-testid="${testId}"] .page-title`) as HTMLElement | null;
        if (!heading) return null;
        return getComputedStyle(heading).fontSize;
      }, route.testId);

      expect(headingSize).toBe(dashboardHeadingSize);

      for (const cls of ROLE_CLASSES) {
        const stats = await page.evaluate((payload) => {
          const { testId, clsName } = payload;
          const nodes = Array.from(document.querySelectorAll(`[data-testid="${testId}"] .${clsName}`)) as HTMLElement[];
          const uniqueSizes = [...new Set(nodes.map((node) => getComputedStyle(node).fontSize))];
          const uniqueWeights = [...new Set(nodes.map((node) => getComputedStyle(node).fontWeight))];
          return { count: nodes.length, uniqueSizes, uniqueWeights };
        }, { testId: route.testId, clsName: cls });

        if (stats.count === 0) {
          continue;
        }

        seenRoleClass.add(cls);
        expect(stats.uniqueSizes.length).toBe(1);
        expect(stats.uniqueWeights.length).toBe(1);
      }
    }

    for (const cls of ROLE_CLASSES) {
      expect(seenRoleClass.has(cls)).toBeTruthy();
    }
  });
});
