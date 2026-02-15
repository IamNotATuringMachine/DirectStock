import { mkdirSync } from "node:fs";
import { expect, test, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";

import { createE2EUserWithRoles, ensureE2EInventoryStock } from "./helpers/api";

type Rect = {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

type ClientErrors = {
  pageErrors: string[];
  consoleErrors: string[];
};

type AlertListResponse = {
  items: Array<{
    id: number;
    status: "open" | "acknowledged";
    severity: "low" | "medium" | "high" | "critical";
    alert_type: "low_stock" | "zero_stock" | "expiry_window";
    triggered_at: string;
  }>;
  total: number;
};

type ProductListResponse = {
  items: Array<{
    id: number;
    product_number: string;
  }>;
};

type AlertsLayoutMetrics = {
  viewportWidth: number;
  htmlScrollWidth: number;
  bodyScrollWidth: number;
  panel: Rect;
  panelHeader: Rect | null;
  kpiGrid: Rect | null;
  kpiCards: Rect[];
  toolbar: Rect | null;
  statusFilter: Rect | null;
  severityFilter: Rect | null;
  typeFilter: Rect | null;
  tableWrap: Rect | null;
  table: Rect | null;
  firstRow: Rect | null;
  firstRowDisplay: string | null;
  actionsBar: Rect | null;
  pageIndicator: Rect | null;
  prevButton: Rect | null;
  nextButton: Rect | null;
  toolbarColumns: number;
  paginationDirection: string | null;
};

type SeededAlert = {
  alertId: number;
};

function intersects(a: Rect, b: Rect): boolean {
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loginApi(request: APIRequestContext, username: string, password: string): Promise<string> {
  const response = await request.post("/api/auth/login", {
    data: { username, password },
  });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as { access_token: string };
  return payload.access_token;
}

async function loginAndOpenAlertsPage(page: Page, username: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByTestId("login-username").fill(username);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/alerts");
  await expect(page).toHaveURL(/\/alerts$/);
  await expect(page.getByTestId("alerts-page")).toBeVisible();
}

async function fetchProductIdByNumber(
  request: APIRequestContext,
  token: string,
  productNumber: string,
): Promise<number> {
  const response = await request.get(`/api/products?search=${encodeURIComponent(productNumber)}&page_size=200`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as ProductListResponse;
  const match = payload.items.find((item) => item.product_number === productNumber);
  expect(match).toBeTruthy();
  return match!.id;
}

async function fetchAlertsCount(
  request: APIRequestContext,
  token: string,
  status: "open" | "acknowledged",
): Promise<number> {
  const response = await request.get("/api/alerts", {
    headers: { Authorization: `Bearer ${token}` },
    params: {
      page: 1,
      page_size: 1,
      status,
      severity: "critical",
      alert_type: "low_stock",
    },
  });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as AlertListResponse;
  return payload.total;
}

async function createLowStockAlert(
  request: APIRequestContext,
  token: string,
  marker: string,
): Promise<SeededAlert> {
  const headers = { Authorization: `Bearer ${token}` };
  const seeded = await ensureE2EInventoryStock(request, token, `E2E-ALUI-${marker}`);
  const productId = await fetchProductIdByNumber(request, token, seeded.productNumber);

  const updateWarehouseSettings = await request.put(
    `/api/products/${productId}/warehouse-settings/${seeded.warehouseId}`,
    {
      headers,
      data: {
        min_stock: "5",
        reorder_point: "5",
      },
    },
  );
  expect(updateWarehouseSettings.ok()).toBeTruthy();

  const createRule = await request.post("/api/alert-rules", {
    headers,
    data: {
      name: `E2E Alerts UI ${marker}`,
      rule_type: "low_stock",
      severity: "critical",
      is_active: true,
      product_id: productId,
      warehouse_id: seeded.warehouseId,
      threshold_quantity: "5",
      dedupe_window_minutes: 1,
    },
  });
  expect(createRule.ok()).toBeTruthy();

  const issue = await request.post("/api/goods-issues", {
    headers,
    data: { notes: `E2E alerts issue ${marker}` },
  });
  expect(issue.ok()).toBeTruthy();
  const issuePayload = (await issue.json()) as { id: number };

  const issueItem = await request.post(`/api/goods-issues/${issuePayload.id}/items`, {
    headers,
    data: {
      product_id: productId,
      requested_quantity: "1",
      unit: "piece",
      source_bin_id: seeded.binId,
    },
  });
  expect(issueItem.ok()).toBeTruthy();

  const completeIssue = await request.post(`/api/goods-issues/${issuePayload.id}/complete`, { headers });
  expect(completeIssue.ok()).toBeTruthy();

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const alertsResponse = await request.get("/api/alerts", {
      headers,
      params: {
        page: 1,
        page_size: 25,
        status: "open",
        severity: "critical",
        alert_type: "low_stock",
        product_id: productId,
      },
    });
    expect(alertsResponse.ok()).toBeTruthy();
    const payload = (await alertsResponse.json()) as AlertListResponse;
    if (payload.items.length > 0) {
      return { alertId: payload.items[0].id };
    }
    await delay(250);
  }

  throw new Error(`Timed out waiting for low-stock alert for marker ${marker}`);
}

async function seedAlertsWithStatusSpread(
  request: APIRequestContext,
  token: string,
): Promise<{ openAlertForUi: number }> {
  const seededAlerts: SeededAlert[] = [];

  for (let index = 0; index < 3; index += 1) {
    const marker = `${Date.now()}-${Math.floor(Math.random() * 10_000)}-${index}`;
    seededAlerts.push(await createLowStockAlert(request, token, marker));
  }

  const acknowledgeOne = await request.post(`/api/alerts/${seededAlerts[0].alertId}/ack`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(acknowledgeOne.ok()).toBeTruthy();

  return {
    openAlertForUi: seededAlerts[1].alertId,
  };
}

async function ensureStatusCountsDiffer(
  request: APIRequestContext,
  token: string,
): Promise<{ openCount: number; acknowledgedCount: number }> {
  let openCount = await fetchAlertsCount(request, token, "open");
  let acknowledgedCount = await fetchAlertsCount(request, token, "acknowledged");

  for (let attempt = 0; attempt < 3 && openCount === acknowledgedCount; attempt += 1) {
    const marker = `${Date.now()}-${Math.floor(Math.random() * 10_000)}-delta-${attempt}`;
    await createLowStockAlert(request, token, marker);
    openCount = await fetchAlertsCount(request, token, "open");
    acknowledgedCount = await fetchAlertsCount(request, token, "acknowledged");
  }

  return { openCount, acknowledgedCount };
}

async function readKpiValue(page: Page, testId: string): Promise<number | null> {
  const strong = page.getByTestId(testId).locator("strong");
  const text = (await strong.innerText()).trim();
  if (text === "-" || text.length === 0) {
    return null;
  }
  const parsed = Number(text.replace(/[^\d-]/g, ""));
  if (!Number.isFinite(parsed)) {
    throw new Error(`Could not parse KPI "${testId}" value from "${text}"`);
  }
  return parsed;
}

async function captureLayoutMetrics(page: Page): Promise<AlertsLayoutMetrics> {
  return page.evaluate(() => {
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

    const panel = document.querySelector('[data-testid="alerts-page"]');
    if (!panel) {
      throw new Error("Alerts panel not found");
    }

    const panelHeader = panel.querySelector(".panel-header");
    const kpiGrid = panel.querySelector(".kpi-grid");
    const kpiCards = kpiGrid ? Array.from(kpiGrid.querySelectorAll(".kpi-card")) : [];
    const toolbar = panel.querySelector(".products-toolbar");
    const statusFilter = panel.querySelector('[data-testid="alerts-status-filter"]');
    const severityFilter = panel.querySelector('[data-testid="alerts-severity-filter"]');
    const typeFilter = panel.querySelector('[data-testid="alerts-type-filter"]');
    const tableWrap = panel.querySelector(".table-wrap");
    const table = panel.querySelector('[data-testid="alerts-table"]');
    const firstRow = panel.querySelector('[data-testid^="alerts-row-"]');
    const actionsBar = panel.querySelector('[data-testid="alerts-page-prev"]')?.closest(".actions-cell") ?? null;
    const pageIndicator = panel.querySelector('[data-testid="alerts-page-indicator"]');
    const prevButton = panel.querySelector('[data-testid="alerts-page-prev"]');
    const nextButton = panel.querySelector('[data-testid="alerts-page-next"]');

    const toolbarColumns = toolbar
      ? getComputedStyle(toolbar)
          .gridTemplateColumns.split(" ")
          .map((chunk) => chunk.trim())
          .filter(Boolean).length
      : 0;

    const paginationDirection = actionsBar ? getComputedStyle(actionsBar).flexDirection : null;

    return {
      viewportWidth: window.innerWidth,
      htmlScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      panel: rect(panel),
      panelHeader: panelHeader ? rect(panelHeader) : null,
      kpiGrid: kpiGrid ? rect(kpiGrid) : null,
      kpiCards: kpiCards.map((card) => rect(card)),
      toolbar: toolbar ? rect(toolbar) : null,
      statusFilter: statusFilter ? rect(statusFilter) : null,
      severityFilter: severityFilter ? rect(severityFilter) : null,
      typeFilter: typeFilter ? rect(typeFilter) : null,
      tableWrap: tableWrap ? rect(tableWrap) : null,
      table: table ? rect(table) : null,
      firstRow: firstRow ? rect(firstRow) : null,
      firstRowDisplay: firstRow ? getComputedStyle(firstRow).display : null,
      actionsBar: actionsBar ? rect(actionsBar) : null,
      pageIndicator: pageIndicator ? rect(pageIndicator) : null,
      prevButton: prevButton ? rect(prevButton) : null,
      nextButton: nextButton ? rect(nextButton) : null,
      toolbarColumns,
      paginationDirection,
    };
  });
}

test.describe("/alerts page ui and functional regression", () => {
  test("functional + ui: controls are operable, layout is stable and responsive", async ({ page, request }, testInfo: TestInfo) => {
    const errors = collectClientErrors(page);
    const user = await createE2EUserWithRoles(request, ["admin"]);
    const token = await loginApi(request, user.username, user.password);

    const seeded = await seedAlertsWithStatusSpread(request, token);

    await loginAndOpenAlertsPage(page, user.username, user.password);

    await expect(page.getByTestId("alerts-page")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Warnungen" })).toBeVisible();
    await expect(page.getByTestId("alerts-kpi-open-count")).toBeVisible();
    await expect(page.getByTestId("alerts-kpi-active-rules")).toBeVisible();
    await expect(page.getByTestId("alerts-status-filter")).toBeVisible();
    await expect(page.getByTestId("alerts-severity-filter")).toBeVisible();
    await expect(page.getByTestId("alerts-type-filter")).toBeVisible();
    await expect(page.getByTestId("alerts-table")).toBeVisible();
    await expect(page.getByTestId("alerts-page-prev")).toBeVisible();
    await expect(page.getByTestId("alerts-page-next")).toBeVisible();
    await expect(page.getByTestId("alerts-page-indicator")).toContainText("Seite");

    await page.getByTestId("alerts-severity-filter").selectOption("critical");
    await page.getByTestId("alerts-type-filter").selectOption("low_stock");
    await page.getByTestId("alerts-status-filter").selectOption("open");

    const openRow = page.getByTestId(`alerts-row-${seeded.openAlertForUi}`);
    await expect(openRow).toBeVisible();
    const openRowAckButton = page.getByTestId(`alerts-ack-${seeded.openAlertForUi}`);
    await expect(openRowAckButton).toBeEnabled();

    const counts = await ensureStatusCountsDiffer(request, token);
    expect(counts.openCount).not.toBe(counts.acknowledgedCount);
    await page.reload();
    await expect(page.getByTestId("alerts-page")).toBeVisible();
    await page.getByTestId("alerts-severity-filter").selectOption("critical");
    await page.getByTestId("alerts-type-filter").selectOption("low_stock");
    await page.getByTestId("alerts-status-filter").selectOption("open");
    await expect(page.getByTestId(`alerts-row-${seeded.openAlertForUi}`)).toBeVisible();

    await expect
      .poll(async () => await readKpiValue(page, "alerts-kpi-open-count"))
      .not.toBeNull();
    const openKpiReference = await readKpiValue(page, "alerts-kpi-open-count");
    expect(openKpiReference).not.toBeNull();

    await page.getByTestId("alerts-status-filter").selectOption("acknowledged");
    await expect(page.getByTestId("alerts-page-indicator")).toContainText("Seite");

    await expect
      .poll(async () => await readKpiValue(page, "alerts-kpi-open-count"))
      .toEqual(openKpiReference as number);

    await page.getByTestId("alerts-status-filter").selectOption("open");
    await expect(openRow).toBeVisible();
    await openRowAckButton.click();

    await expect(openRow).toBeHidden();
    await page.getByTestId("alerts-status-filter").selectOption("acknowledged");
    const acknowledgedRow = page.getByTestId(`alerts-row-${seeded.openAlertForUi}`);
    await expect(acknowledgedRow).toBeVisible();
    await expect(page.getByTestId(`alerts-ack-${seeded.openAlertForUi}`)).toBeDisabled();

    await expect(page.getByTestId("alerts-page-prev")).toBeDisabled();
    const nextButton = page.getByTestId("alerts-page-next");
    if (await nextButton.isEnabled()) {
      await nextButton.click();
      await expect(page.getByTestId("alerts-page-indicator")).toContainText("Seite 2");
      await page.getByTestId("alerts-page-prev").click();
      await expect(page.getByTestId("alerts-page-indicator")).toContainText("Seite 1");
    } else {
      await expect(nextButton).toBeDisabled();
    }

    await page.getByTestId("alerts-status-filter").selectOption("open");
    await expect(page.getByTestId("alerts-table")).toBeVisible();

    mkdirSync("output", { recursive: true });
    await page.screenshot({ path: `output/alerts-page-${testInfo.project.name}.png`, fullPage: true });

    const metrics = await captureLayoutMetrics(page);

    expect(metrics.htmlScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);

    expect(metrics.panel.width).toBeGreaterThan(220);
    expect(metrics.panel.left).toBeGreaterThanOrEqual(-1);
    expect(metrics.panel.right).toBeLessThanOrEqual(metrics.viewportWidth + 1);

    for (const [name, section] of [
      ["panelHeader", metrics.panelHeader],
      ["kpiGrid", metrics.kpiGrid],
      ["toolbar", metrics.toolbar],
      ["statusFilter", metrics.statusFilter],
      ["severityFilter", metrics.severityFilter],
      ["typeFilter", metrics.typeFilter],
      ["tableWrap", metrics.tableWrap],
      ["table", metrics.table],
      ["actionsBar", metrics.actionsBar],
      ["pageIndicator", metrics.pageIndicator],
      ["prevButton", metrics.prevButton],
      ["nextButton", metrics.nextButton],
    ] as const) {
      expect(section, `Missing section "${name}"`).not.toBeNull();
      if (!section) {
        continue;
      }
      expect(section.width, `${name} width`).toBeGreaterThan(24);
      expect(section.height, `${name} height`).toBeGreaterThan(14);
      expect(section.left, `${name} left`).toBeGreaterThanOrEqual(metrics.panel.left - 1);
      expect(section.right, `${name} right`).toBeLessThanOrEqual(metrics.panel.right + 1);
    }

    expect(metrics.kpiCards.length).toBeGreaterThanOrEqual(2);
    expect(metrics.kpiCards[0].height).toBeGreaterThan(30);
    expect(metrics.kpiCards[1].height).toBeGreaterThan(30);
    expect(intersects(metrics.kpiCards[0], metrics.kpiCards[1])).toBe(false);

    expect(metrics.firstRow).not.toBeNull();
    if (metrics.viewportWidth <= 768) {
      expect(metrics.firstRowDisplay).toBe("grid");
      expect(metrics.toolbarColumns).toBe(1);
    } else {
      expect(metrics.firstRowDisplay).toBe("table-row");
      expect(metrics.toolbarColumns).toBeGreaterThanOrEqual(2);
    }
    expect(metrics.paginationDirection).toBe("row");

    await assertNoClientErrors(errors);
  });
});
