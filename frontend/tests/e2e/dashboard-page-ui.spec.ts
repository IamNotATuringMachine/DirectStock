import { mkdirSync } from "node:fs";
import { expect, test, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";

import { createE2EUserWithRoles } from "./helpers/api";

type DashboardCardCatalogItem = {
  card_key: string;
  title: string;
  default_order?: number | null;
};

type DashboardConfigRow = {
  card_key: string;
  visible: boolean;
  display_order: number;
};

type ClientErrors = {
  pageErrors: string[];
  consoleErrors: string[];
};

function collectClientErrors(page: Page): ClientErrors {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on("pageerror", (error) => {
    pageErrors.push(String(error));
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  return { pageErrors, consoleErrors };
}

async function assertNoClientErrors(errors: ClientErrors): Promise<void> {
  await expect(errors.pageErrors, `Unexpected page errors: ${errors.pageErrors.join(" | ")}`).toEqual([]);
  await expect(errors.consoleErrors, `Unexpected console errors: ${errors.consoleErrors.join(" | ")}`).toEqual([]);
}

async function loginApi(request: APIRequestContext, username: string, password: string): Promise<string> {
  const response = await request.post("/api/auth/login", {
    data: { username, password },
  });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as { access_token: string };
  return payload.access_token;
}

async function setAllDashboardCardsVisible(request: APIRequestContext, token: string): Promise<string[]> {
  const headers = { Authorization: `Bearer ${token}` };

  const [catalogResponse, configResponse] = await Promise.all([
    request.get("/api/dashboard/cards/catalog", { headers }),
    request.get("/api/dashboard/config/me", { headers }),
  ]);

  expect(catalogResponse.ok()).toBeTruthy();
  expect(configResponse.ok()).toBeTruthy();

  const catalog = (await catalogResponse.json()) as DashboardCardCatalogItem[];
  const configPayload = (await configResponse.json()) as { cards: DashboardConfigRow[] };
  const configRows = configPayload.cards ?? [];
  const configByKey = new Map(configRows.map((row) => [row.card_key, row]));

  const rows: DashboardConfigRow[] = catalog.map((card, index) => {
    const existing = configByKey.get(card.card_key);
    return {
      card_key: card.card_key,
      visible: true,
      display_order: existing?.display_order ?? card.default_order ?? index * 10,
    };
  });

  rows.sort((a, b) => a.display_order - b.display_order);
  const updateResponse = await request.put("/api/dashboard/config/me", {
    headers,
    data: { cards: rows },
  });
  expect(updateResponse.ok()).toBeTruthy();

  return rows.map((row) => row.card_key);
}

async function openDashboardWithConfigVisible(
  page: Page,
  request: APIRequestContext,
): Promise<{ cardKeys: string[] }> {
  const user = await createE2EUserWithRoles(request, ["admin"]);
  const token = await loginApi(request, user.username, user.password);
  const cardKeys = await setAllDashboardCardsVisible(request, token);

  await page.goto("/login");
  await page.getByTestId("login-username").fill(user.username);
  await page.getByTestId("login-password").fill(user.password);
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId("dashboard-page")).toBeVisible();
  await page.locator('button[title="Dashboard anpassen"]').click();
  await expect(page.getByRole("heading", { name: "Karten konfigurieren" })).toBeVisible();

  return { cardKeys };
}

test.describe("dashboard page ui and functional regression", () => {
  test("functional: toggles and dashboard links are operable", async ({ page, request }) => {
    const errors = collectClientErrors(page);
    const { cardKeys } = await openDashboardWithConfigVisible(page, request);

    for (const cardKey of cardKeys) {
      await expect(page.getByTestId(`dashboard-card-toggle-${cardKey}`)).toBeVisible();
    }

    const summaryToggle = page.getByTestId("dashboard-card-toggle-summary");
    const totalProductsCard = page.getByTestId("dashboard-stat-total-products");
    await expect(summaryToggle).toBeChecked();
    await expect(totalProductsCard).toBeVisible();
    await summaryToggle.click();
    await expect(summaryToggle).not.toBeChecked();
    await expect(totalProductsCard).toBeHidden();
    await summaryToggle.click();
    await expect(summaryToggle).toBeChecked();
    await expect(totalProductsCard).toBeVisible();

    const quickActions = [
      { testId: "dashboard-quick-action-goods-receipt", path: "/goods-receipt", pageTestId: "goods-receipt-page" },
      { testId: "dashboard-quick-action-goods-issue", path: "/goods-issue", pageTestId: "goods-issue-page" },
      { testId: "dashboard-quick-action-stock-transfer", path: "/stock-transfer", pageTestId: "stock-transfer-page" },
      { testId: "dashboard-quick-action-scanner", path: "/scanner", pageTestId: "scanner-page" },
    ];

    for (const action of quickActions) {
      const link = page.getByTestId(action.testId);
      await link.scrollIntoViewIfNeeded();
      await expect(link).toHaveAttribute("href", action.path);
    }

    const openAlertsLink = page.getByRole("link", { name: "Alle ansehen" }).first();
    await openAlertsLink.scrollIntoViewIfNeeded();
    await openAlertsLink.click();
    await expect(page).toHaveURL(/\/alerts$/);
    await expect(page.getByTestId("alerts-page")).toBeVisible();

    await assertNoClientErrors(errors);
  });

  test("ui-formatting: cards are visible, aligned and responsive without overflow", async ({ page, request }, testInfo) => {
    const errors = collectClientErrors(page);
    await openDashboardWithConfigVisible(page, request);

    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Karten konfigurieren" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Aktivität heute" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Kritische Warnungen" })).toBeVisible();

    const statCards = page.locator('[data-testid^="dashboard-stat-"]');
    await expect(statCards).toHaveCount(8);
    const quickActionCards = page.locator('[data-testid^="dashboard-quick-action-"]');
    await expect(quickActionCards).toHaveCount(4);

    const totalProductsValue = page.getByTestId("dashboard-stat-total-products").locator(".text-2xl");
    await expect.poll(async () => ((await totalProductsValue.textContent()) ?? "-").trim()).not.toBe("-");

    mkdirSync("output", { recursive: true });
    await page.screenshot({ path: `output/dashboard-page-${testInfo.project.name}.png`, fullPage: true });

    const metrics = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      htmlScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
    }));
    expect(metrics.htmlScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);

    await assertNoClientErrors(errors);
  });
});
