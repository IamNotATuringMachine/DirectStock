import { mkdirSync } from "node:fs";
import { expect, test, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";

import { createE2EUserWithRoles } from "./helpers/api";

type Rect = {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

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

type DashboardMetrics = {
  viewportWidth: number;
  htmlScrollWidth: number;
  bodyScrollWidth: number;
  panel: Rect;
  configCard: Rect | null;
  kpiGrid: Rect | null;
  capacityCard: Rect | null;
  quickActionsCard: Rect | null;
  twoColGrid: Rect | null;
  activityCard: Rect | null;
  criticalAlertsCard: Rect | null;
  kpiCards: Rect[];
  quickActionButtons: Rect[];
  toggleInputs: Rect[];
  twoColGridColumnCount: number;
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
  const catalogKeys = new Set(catalog.map((item) => item.card_key));

  const rows: DashboardConfigRow[] = catalog.map((card, index) => {
    const existing = configByKey.get(card.card_key);
    return {
      card_key: card.card_key,
      visible: true,
      display_order: existing?.display_order ?? card.default_order ?? index * 10,
    };
  });

  for (const row of configRows) {
    if (!catalogKeys.has(row.card_key)) {
      rows.push({ ...row, visible: true });
    }
  }

  rows.sort((a, b) => a.display_order - b.display_order);

  const updateResponse = await request.put("/api/dashboard/config/me", {
    headers,
    data: { cards: rows },
  });
  if (!updateResponse.ok()) {
    const payload = await updateResponse.text();
    throw new Error(`Failed to update dashboard config (${updateResponse.status()}): ${payload}`);
  }

  return rows.map((row) => row.card_key);
}

async function loginApi(request: APIRequestContext, username: string, password: string): Promise<string> {
  const response = await request.post("/api/auth/login", {
    data: { username, password },
  });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as { access_token: string };
  return payload.access_token;
}

async function openDashboardWithAllCardsVisible(
  page: Page,
  request: APIRequestContext
): Promise<{ cardKeys: string[]; username: string; password: string }> {
  const user = await createE2EUserWithRoles(request, ["admin"]);
  const token = await loginApi(request, user.username, user.password);
  const cardKeys = await setAllDashboardCardsVisible(request, token);

  await page.goto("/login");
  await page.getByTestId("login-username").fill(user.username);
  await page.getByTestId("login-password").fill(user.password);
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId("dashboard-page")).toBeVisible();

  return { cardKeys, username: user.username, password: user.password };
}

async function captureDashboardMetrics(page: Page): Promise<DashboardMetrics> {
  return page.evaluate(() => {
    const dashboard = document.querySelector('[data-testid="dashboard-page"]');
    if (!dashboard) {
      throw new Error("Dashboard root not found.");
    }

    const rect = (element: Element) => {
      const box = element.getBoundingClientRect();
      return {
        top: box.top,
        left: box.left,
        right: box.right,
        bottom: box.bottom,
        width: box.width,
        height: box.height,
      };
    };

    const articleByHeading = (heading: string) => {
      const allArticles = Array.from(document.querySelectorAll('[data-testid="dashboard-page"] article.subpanel'));
      return allArticles.find((article) => article.querySelector("h3")?.textContent?.trim() === heading) ?? null;
    };

    const panel = rect(dashboard);
    const configCard = articleByHeading("Karten konfigurieren");
    const kpiGrid = document.querySelector('[data-testid="dashboard-page"] .kpi-grid');
    const capacityCard = articleByHeading("Kapazität");
    const quickActionsCard = articleByHeading("Schnellaktionen");
    const twoColGrid = document.querySelector('[data-testid="dashboard-page"] .two-col-grid');
    const activityCard = articleByHeading("Aktivität heute");
    const criticalAlertsCard = document.querySelector('[data-testid="dashboard-critical-alerts"]');

    const toggleInputs = Array.from(
      document.querySelectorAll('[data-testid="dashboard-page"] [data-testid^="dashboard-card-toggle-"]')
    );
    const quickActionButtons = Array.from(
      document.querySelectorAll('[data-testid="dashboard-page"] [data-testid^="dashboard-quick-action-"]')
    );
    const kpiCards = Array.from(document.querySelectorAll('[data-testid="dashboard-page"] [data-testid^="dashboard-kpi-"]'));

    const twoColGridColumnCount = twoColGrid
      ? getComputedStyle(twoColGrid)
          .gridTemplateColumns.split(" ")
          .map((part) => part.trim())
          .filter(Boolean).length
      : 0;

    return {
      viewportWidth: window.innerWidth,
      htmlScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      panel,
      configCard: configCard ? rect(configCard) : null,
      kpiGrid: kpiGrid ? rect(kpiGrid) : null,
      capacityCard: capacityCard ? rect(capacityCard) : null,
      quickActionsCard: quickActionsCard ? rect(quickActionsCard) : null,
      twoColGrid: twoColGrid ? rect(twoColGrid) : null,
      activityCard: activityCard ? rect(activityCard) : null,
      criticalAlertsCard: criticalAlertsCard ? rect(criticalAlertsCard) : null,
      kpiCards: kpiCards.map((card) => rect(card)),
      quickActionButtons: quickActionButtons.map((button) => rect(button)),
      toggleInputs: toggleInputs.map((toggle) => rect(toggle)),
      twoColGridColumnCount,
    };
  });
}

test.describe("dashboard page ui and functional regression", () => {
  test("functional: toggles and dashboard links are operable", async ({ page, request }) => {
    const errors = collectClientErrors(page);
    const { cardKeys } = await openDashboardWithAllCardsVisible(page, request);

    for (const cardKey of cardKeys) {
      await expect(page.getByTestId(`dashboard-card-toggle-${cardKey}`)).toBeVisible();
    }

    const summaryToggle = page.getByTestId("dashboard-card-toggle-summary");
    const totalProductsCard = page.getByTestId("dashboard-kpi-total-products");
    await expect(summaryToggle).toBeChecked();
    await expect(summaryToggle).toBeEnabled();
    await expect(totalProductsCard).toBeVisible();
    await summaryToggle.click();
    await expect(summaryToggle).not.toBeChecked();
    await expect(totalProductsCard).toBeHidden();
    await expect(summaryToggle).toBeEnabled();
    await summaryToggle.click();
    await expect(summaryToggle).toBeChecked();
    await expect(totalProductsCard).toBeVisible();

    const quickActionsToggle = page.getByTestId("dashboard-card-toggle-quick-actions");
    const quickActionGoodsReceipt = page.getByTestId("dashboard-quick-action-goods-receipt");
    await expect(quickActionsToggle).toBeChecked();
    await expect(quickActionsToggle).toBeEnabled();
    await expect(quickActionGoodsReceipt).toBeVisible();
    await quickActionsToggle.click();
    await expect(quickActionsToggle).not.toBeChecked();
    await expect(quickActionGoodsReceipt).toBeHidden();
    await expect(quickActionsToggle).toBeEnabled();
    await quickActionsToggle.click();
    await expect(quickActionsToggle).toBeChecked();
    await expect(quickActionGoodsReceipt).toBeVisible();

    const quickActions = [
      { testId: "dashboard-quick-action-goods-receipt", path: "/goods-receipt", pageTestId: "goods-receipt-page" },
      { testId: "dashboard-quick-action-goods-issue", path: "/goods-issue", pageTestId: "goods-issue-page" },
      { testId: "dashboard-quick-action-stock-transfer", path: "/stock-transfer", pageTestId: "stock-transfer-page" },
      { testId: "dashboard-quick-action-scanner", path: "/scanner", pageTestId: "scanner-page" },
    ];

    for (const action of quickActions) {
      const link = page.getByTestId(action.testId);
      await link.scrollIntoViewIfNeeded();
      await link.click();
      await expect(page).toHaveURL(new RegExp(`${action.path.replace("/", "\\/")}$`));
      await expect(page.getByTestId(action.pageTestId)).toBeVisible();

      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(page.getByTestId("dashboard-page")).toBeVisible();
    }

    const openAlertsLink = page.getByTestId("dashboard-open-alerts-link");
    await openAlertsLink.scrollIntoViewIfNeeded();
    await openAlertsLink.click();
    await expect(page).toHaveURL(/\/alerts$/);
    await expect(page.getByTestId("alerts-page")).toBeVisible();

    await assertNoClientErrors(errors);
  });

  test("ui-formatting: cards are visible, aligned and responsive without overflow", async ({ page, request }, testInfo) => {
    const errors = collectClientErrors(page);
    await openDashboardWithAllCardsVisible(page, request);

    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Karten konfigurieren" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Schnellaktionen" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Aktivität heute" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Kritische Warnungen" })).toBeVisible();

    const kpiValue = page.getByTestId("dashboard-kpi-total-products").locator("strong");
    await expect.poll(async () => ((await kpiValue.textContent()) ?? "-").trim()).not.toBe("-");

    mkdirSync("output", { recursive: true });
    await page.screenshot({ path: `output/dashboard-page-${testInfo.project.name}.png`, fullPage: true });

    const metrics = await captureDashboardMetrics(page);
    expect(metrics.htmlScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);

    expect(metrics.panel.width).toBeGreaterThan(240);
    expect(metrics.panel.left).toBeGreaterThanOrEqual(-1);
    expect(metrics.panel.right).toBeLessThanOrEqual(metrics.viewportWidth + 1);

    for (const section of [
      metrics.configCard,
      metrics.kpiGrid,
      metrics.capacityCard,
      metrics.quickActionsCard,
      metrics.twoColGrid,
      metrics.activityCard,
      metrics.criticalAlertsCard,
    ]) {
      expect(section).not.toBeNull();
      if (!section) {
        continue;
      }
      expect(section.width).toBeGreaterThan(120);
      expect(section.height).toBeGreaterThan(36);
      expect(section.left).toBeGreaterThanOrEqual(metrics.panel.left - 1);
      expect(section.right).toBeLessThanOrEqual(metrics.panel.right + 1);
    }

    const stackOrder = [
      metrics.configCard,
      metrics.kpiGrid,
      metrics.capacityCard,
      metrics.quickActionsCard,
      metrics.twoColGrid,
      metrics.activityCard,
      metrics.criticalAlertsCard,
    ].filter(Boolean) as Rect[];

    for (let index = 1; index < stackOrder.length; index += 1) {
      expect(stackOrder[index].top).toBeGreaterThanOrEqual(stackOrder[index - 1].top);
      expect(stackOrder[index].top).toBeGreaterThanOrEqual(stackOrder[index - 1].bottom - 1);
    }

    expect(metrics.kpiCards.length).toBe(9);
    for (const card of metrics.kpiCards) {
      expect(card.width).toBeGreaterThan(90);
      expect(card.height).toBeGreaterThan(52);
      expect(card.left).toBeGreaterThanOrEqual((metrics.kpiGrid?.left ?? 0) - 1);
      expect(card.right).toBeLessThanOrEqual((metrics.kpiGrid?.right ?? metrics.viewportWidth) + 1);
    }

    for (const toggle of metrics.toggleInputs) {
      expect(toggle.width).toBeGreaterThanOrEqual(16);
      expect(toggle.height).toBeGreaterThanOrEqual(16);
      expect(toggle.left).toBeGreaterThanOrEqual(metrics.panel.left - 1);
      expect(toggle.right).toBeLessThanOrEqual(metrics.panel.right + 1);
    }

    for (const button of metrics.quickActionButtons) {
      expect(button.height).toBeGreaterThanOrEqual(36);
      expect(button.left).toBeGreaterThanOrEqual(metrics.panel.left - 1);
      expect(button.right).toBeLessThanOrEqual(metrics.panel.right + 1);
    }

    if (metrics.viewportWidth <= 900) {
      expect(metrics.twoColGridColumnCount).toBe(1);
    } else {
      expect(metrics.twoColGridColumnCount).toBeGreaterThanOrEqual(2);
    }

    await assertNoClientErrors(errors);
  });
});
