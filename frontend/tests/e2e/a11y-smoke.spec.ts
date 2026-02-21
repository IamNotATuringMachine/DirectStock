import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { loginViaUi } from "./helpers/ui";

const UI_A11Y_ROUTES: Array<{ path: string; testId: string }> = [
  { path: "/dashboard", testId: "dashboard-page" },
  { path: "/products", testId: "products-page" },
  { path: "/inventory", testId: "inventory-page" },
  { path: "/warehouse", testId: "warehouse-page" },
  { path: "/purchasing", testId: "purchasing-page" },
  { path: "/reports", testId: "reports-page" },
  { path: "/alerts", testId: "alerts-page" },
  { path: "/customers", testId: "customers-page" },
  { path: "/sales-orders", testId: "sales-orders-page" },
  { path: "/invoices", testId: "invoices-page" },
];

async function login(page: Page): Promise<void> {
  await loginViaUi(page);
}

function formatViolations(route: string, violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"]): string {
  return [
    `Route: ${route}`,
    ...violations.map((item) => `${item.id} (${item.impact ?? "unknown"}): ${item.help}`),
  ].join("\n");
}

test.describe("a11y smoke gate", () => {
  test("core UI pages have no critical accessibility violations", async ({ page }) => {
    test.slow();
    await login(page);

    for (const route of UI_A11Y_ROUTES) {
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      await expect(page.getByTestId(route.testId)).toBeVisible();

      const results = await new AxeBuilder({ page })
        .include(`[data-testid="${route.testId}"]`)
        .analyze();

      const blocking = results.violations.filter((item) => item.impact === "critical");
      expect(blocking, formatViolations(route.path, blocking)).toEqual([]);
    }
  });
});
