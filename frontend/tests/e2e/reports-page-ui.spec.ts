import { mkdirSync } from "node:fs";
import { expect, test, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";

import { ensureE2EInventoryStock, loginAsAdminApi } from "./helpers/api";

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

type ReportsSeed = {
  productId: number;
  warehouseId: number;
  dateFrom: string;
  dateTo: string;
};

type ToolbarControlMetric = {
  testId: string | null;
  tagName: string;
  rect: Rect;
};

type ReportsLayoutMetrics = {
  viewportWidth: number;
  htmlScrollWidth: number;
  bodyScrollWidth: number;
  panel: Rect;
  panelHeader: Rect | null;
  kpiGrid: Rect | null;
  toolbar: Rect | null;
  kpiCards: Rect[];
  toolbarControls: ToolbarControlMetric[];
  tableWrap: Rect | null;
  activeTable: Rect | null;
  tableRowDisplay: string | null;
  toolbarColumns: number;
};

function intersects(a: Rect, b: Rect): boolean {
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

function dateRange() {
  const now = new Date();
  const dateTo = now.toISOString().slice(0, 10);
  const fromDate = new Date(now);
  fromDate.setDate(fromDate.getDate() - 30);
  const dateFrom = fromDate.toISOString().slice(0, 10);
  return { dateFrom, dateTo };
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

async function loginUi(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByTestId("login-username").fill(process.env.E2E_ADMIN_USERNAME ?? "admin");
  await page.getByTestId("login-password").fill(process.env.E2E_ADMIN_PASSWORD ?? "DirectStock2026!");
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function seedReportsData(request: APIRequestContext): Promise<ReportsSeed> {
  const token = await loginAsAdminApi(request);
  const seeded = await ensureE2EInventoryStock(request, token, `E2E-RP-UI-${Date.now()}`);
  const headers = { Authorization: `Bearer ${token}` };

  const productResponse = await request.get(`/api/products?search=${encodeURIComponent(seeded.productNumber)}&page_size=200`, {
    headers,
  });
  expect(productResponse.ok()).toBeTruthy();
  const productPayload = (await productResponse.json()) as {
    items: Array<{ id: number; product_number: string }>;
  };
  const product = productPayload.items.find((item) => item.product_number === seeded.productNumber);
  expect(product).toBeTruthy();

  const issueResponse = await request.post("/api/goods-issues", {
    headers,
    data: {
      notes: `E2E reports ui goods issue ${Date.now()}`,
    },
  });
  expect(issueResponse.ok()).toBeTruthy();
  const issuePayload = (await issueResponse.json()) as { id: number };

  const itemResponse = await request.post(`/api/goods-issues/${issuePayload.id}/items`, {
    headers,
    data: {
      product_id: product!.id,
      requested_quantity: "1",
      unit: "piece",
      source_bin_id: seeded.binId,
    },
  });
  expect(itemResponse.ok()).toBeTruthy();

  const completeResponse = await request.post(`/api/goods-issues/${issuePayload.id}/complete`, { headers });
  expect(completeResponse.ok()).toBeTruthy();

  const { dateFrom, dateTo } = dateRange();
  const recomputeResponse = await request.post("/api/reports/demand-forecast/recompute", {
    headers,
    data: {
      date_from: dateFrom,
      date_to: dateTo,
      warehouse_id: seeded.warehouseId,
    },
  });
  expect(recomputeResponse.ok()).toBeTruthy();

  return {
    productId: product!.id,
    warehouseId: seeded.warehouseId,
    dateFrom,
    dateTo,
  };
}

async function openReportsPage(page: Page, seed: ReportsSeed): Promise<void> {
  await loginUi(page);
  await page.goto("/reports");
  await expect(page.getByTestId("reports-page")).toBeVisible();

  await page.getByTestId("reports-date-from").fill(seed.dateFrom);
  await page.getByTestId("reports-date-to").fill(seed.dateTo);
}

async function captureLayoutMetrics(page: Page, tableTestId: string): Promise<ReportsLayoutMetrics> {
  return page.evaluate((requestedTableTestId) => {
    const rectFromDomRect = (box: DOMRect) => ({
      top: box.top,
      left: box.left,
      right: box.right,
      bottom: box.bottom,
      width: box.width,
      height: box.height,
    });

    const panel = document.querySelector('[data-testid="reports-page"]');
    if (!panel) {
      throw new Error("Reports panel not found.");
    }

    const panelHeader = panel.querySelector(".panel-header");
    const kpiGrid = panel.querySelector(".kpi-grid");
    const toolbar = panel.querySelector(".products-toolbar");
    const activeTable = panel.querySelector(`table[data-testid="${requestedTableTestId}"]`);
    const tableWrap = activeTable?.closest(".table-wrap") ?? null;

    const visibleToolbarControls = Array.from(panel.querySelectorAll(".products-toolbar > *"))
      .filter((element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      })
      .map((element) => ({
        testId: element.getAttribute("data-testid"),
        tagName: element.tagName.toLowerCase(),
        rect: rectFromDomRect(element.getBoundingClientRect()),
      }));

    const tableBodyFirstRow = activeTable?.querySelector("tbody tr") ?? null;
    const tableRowDisplay = tableBodyFirstRow ? window.getComputedStyle(tableBodyFirstRow).display : null;

    const toolbarColumns = toolbar
      ? window
          .getComputedStyle(toolbar)
          .gridTemplateColumns.split(" ")
          .map((value) => value.trim())
          .filter(Boolean).length
      : 0;

    return {
      viewportWidth: window.innerWidth,
      htmlScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      panel: rectFromDomRect(panel.getBoundingClientRect()),
      panelHeader: panelHeader ? rectFromDomRect(panelHeader.getBoundingClientRect()) : null,
      kpiGrid: kpiGrid ? rectFromDomRect(kpiGrid.getBoundingClientRect()) : null,
      toolbar: toolbar ? rectFromDomRect(toolbar.getBoundingClientRect()) : null,
      kpiCards: Array.from(panel.querySelectorAll('[data-testid^="reports-kpi-"]')).map((card) =>
        rectFromDomRect(card.getBoundingClientRect())
      ),
      toolbarControls: visibleToolbarControls,
      tableWrap: tableWrap ? rectFromDomRect(tableWrap.getBoundingClientRect()) : null,
      activeTable: activeTable ? rectFromDomRect(activeTable.getBoundingClientRect()) : null,
      tableRowDisplay,
      toolbarColumns,
    };
  }, tableTestId);
}

async function captureScreenshots(page: Page, testInfo: TestInfo): Promise<void> {
  mkdirSync("output", { recursive: true });
  const project = testInfo.project.name;

  await page.screenshot({
    path: `output/reports-page-${project}.png`,
    fullPage: true,
  });

  await page.getByTestId("reports-type-select").selectOption("demand-forecast");
  await expect(page.getByTestId("reports-demand-forecast-table")).toBeVisible();
  await page.screenshot({
    path: `output/reports-page-demand-forecast-${project}.png`,
    fullPage: true,
  });
}

test.describe("reports page ui and functional regression", () => {
  test("functional: all filters and actions are operable", async ({ page, request }) => {
    const errors = collectClientErrors(page);
    const seed = await seedReportsData(request);

    await openReportsPage(page, seed);

    await expect(page.getByTestId("reports-kpi-turnover")).toBeVisible();
    await expect(page.getByTestId("reports-kpi-dock-to-stock")).toBeVisible();
    await expect(page.getByTestId("reports-kpi-accuracy")).toBeVisible();
    await expect(page.getByTestId("reports-kpi-alerts")).toBeVisible();
    await expect(page.getByTestId("reports-kpi-pick-accuracy")).toBeVisible();
    await expect(page.getByTestId("reports-kpi-returns-rate")).toBeVisible();
    await expect(page.getByTestId("reports-kpi-approval-cycle")).toBeVisible();
    await expect(page.getByTestId("reports-kpi-iwt-transfers")).toBeVisible();
    await expect(page.getByTestId("reports-kpi-iwt-quantity")).toBeVisible();

    await page.getByTestId("reports-type-select").selectOption("stock");
    await expect(page.getByTestId("reports-stock-table")).toBeVisible();
    const stockSearch = page.getByTestId("reports-search-input");
    await stockSearch.fill(`E2E-RP-UI-${seed.productId}`);
    await stockSearch.clear();

    await page.getByTestId("reports-type-select").selectOption("movements");
    await expect(page.getByTestId("reports-movements-table")).toBeVisible();
    await page.getByTestId("reports-movement-type-select").selectOption("goods_receipt");
    await expect
      .poll(async () => await page.getByTestId("reports-movements-table").locator("tbody tr").count())
      .toBeGreaterThan(0);

    await page.getByTestId("reports-type-select").selectOption("inbound-outbound");
    await expect(page.getByTestId("reports-inbound-outbound-table")).toBeVisible();

    await page.getByTestId("reports-type-select").selectOption("inventory-accuracy");
    await expect(page.getByTestId("reports-accuracy-table")).toBeVisible();

    await page.getByTestId("reports-type-select").selectOption("abc");
    await expect(page.getByTestId("reports-abc-table")).toBeVisible();
    await page.getByTestId("reports-search-input").fill("E2E");
    await page.getByTestId("reports-search-input").clear();

    await page.getByTestId("reports-type-select").selectOption("returns");
    await expect(page.getByTestId("reports-returns-table")).toBeVisible();

    await page.getByTestId("reports-type-select").selectOption("picking-performance");
    await expect(page.getByTestId("reports-picking-performance-table")).toBeVisible();

    await page.getByTestId("reports-type-select").selectOption("purchase-recommendations");
    await expect(page.getByTestId("reports-purchase-recommendations-table")).toBeVisible();

    await page.getByTestId("reports-type-select").selectOption("trends");
    await expect(page.getByTestId("reports-trends-sparkline-table")).toBeVisible();
    await expect(page.getByTestId("reports-trends-table")).toBeVisible();
    await page.getByTestId("reports-trend-product-id").fill(String(seed.productId));
    await page.getByTestId("reports-trend-warehouse-id").fill(String(seed.warehouseId));
    await expect.poll(async () => await page.getByTestId("reports-trends-table").locator("tbody tr").count()).toBeGreaterThan(0);

    await page.getByTestId("reports-type-select").selectOption("demand-forecast");
    await expect(page.getByTestId("reports-demand-forecast-table")).toBeVisible();
    await page.getByTestId("reports-forecast-product-id").fill(String(seed.productId));
    await page.getByTestId("reports-forecast-warehouse-id").fill(String(seed.warehouseId));
    await expect
      .poll(async () => await page.getByTestId("reports-demand-forecast-table").locator("tbody tr").count())
      .toBeGreaterThan(0);

    const recomputeButton = page.getByTestId("reports-forecast-recompute-btn");
    await recomputeButton.click();
    await expect(recomputeButton).toBeEnabled();

    await page.getByTestId("reports-download-csv-btn").click();
    await expect(page.getByTestId("reports-download-csv-btn")).toBeEnabled();

    const pagination = page.locator("footer.pagination");
    if (await pagination.isVisible()) {
      const previousButton = pagination.getByRole("button", { name: "Zurück" });
      const nextButton = pagination.getByRole("button", { name: "Weiter" });
      await expect(previousButton).toBeVisible();
      await expect(nextButton).toBeVisible();
      if (await nextButton.isEnabled()) {
        await nextButton.click();
      }
      if (await previousButton.isEnabled()) {
        await previousButton.click();
      }
    }

    await assertNoClientErrors(errors);
  });

  test("ui: layout and responsiveness stay stable", async ({ page, request }, testInfo) => {
    const errors = collectClientErrors(page);
    const seed = await seedReportsData(request);

    await openReportsPage(page, seed);

    await page.getByTestId("reports-type-select").selectOption("stock");
    await expect(page.getByTestId("reports-stock-table")).toBeVisible();
    const stockMetrics = await captureLayoutMetrics(page, "reports-stock-table");

    await expect(stockMetrics.htmlScrollWidth).toBeLessThanOrEqual(stockMetrics.viewportWidth + 1);
    await expect(stockMetrics.bodyScrollWidth).toBeLessThanOrEqual(stockMetrics.viewportWidth + 1);

    await expect(stockMetrics.panelHeader).not.toBeNull();
    await expect(stockMetrics.kpiGrid).not.toBeNull();
    await expect(stockMetrics.toolbar).not.toBeNull();
    await expect(stockMetrics.tableWrap).not.toBeNull();
    await expect(stockMetrics.activeTable).not.toBeNull();

    await expect(stockMetrics.kpiCards.length).toBeGreaterThanOrEqual(9);
    await expect(stockMetrics.toolbarControls.length).toBeGreaterThanOrEqual(4);

    for (const card of stockMetrics.kpiCards) {
      await expect(card.width).toBeGreaterThan(0);
      await expect(card.height).toBeGreaterThan(0);
      await expect(card.left).toBeGreaterThanOrEqual(stockMetrics.panel.left - 1);
      await expect(card.right).toBeLessThanOrEqual(stockMetrics.panel.right + 1);
    }

    for (const control of stockMetrics.toolbarControls) {
      await expect(control.rect.width).toBeGreaterThan(20);
      await expect(control.rect.height).toBeGreaterThan(30);
      await expect(control.rect.left).toBeGreaterThanOrEqual(stockMetrics.panel.left - 1);
      await expect(control.rect.right).toBeLessThanOrEqual(stockMetrics.panel.right + 1);
    }

    for (let i = 0; i < stockMetrics.toolbarControls.length; i += 1) {
      for (let j = i + 1; j < stockMetrics.toolbarControls.length; j += 1) {
        const a = stockMetrics.toolbarControls[i]!.rect;
        const b = stockMetrics.toolbarControls[j]!.rect;
        await expect(intersects(a, b)).toBeFalsy();
      }
    }

    if (stockMetrics.viewportWidth <= 768) {
      await expect(stockMetrics.toolbarColumns).toBe(1);
    } else {
      await expect(stockMetrics.toolbarColumns).toBeGreaterThanOrEqual(2);
    }

    if (stockMetrics.tableRowDisplay) {
      await expect(stockMetrics.tableRowDisplay).toBe("table-row");
    }

    await page.getByTestId("reports-type-select").selectOption("demand-forecast");
    await page.getByTestId("reports-forecast-product-id").fill(String(seed.productId));
    await page.getByTestId("reports-forecast-warehouse-id").fill(String(seed.warehouseId));
    await expect(page.getByTestId("reports-demand-forecast-table")).toBeVisible();

    const forecastMetrics = await captureLayoutMetrics(page, "reports-demand-forecast-table");
    await expect(forecastMetrics.toolbarControls.length).toBeGreaterThanOrEqual(7);

    for (let i = 0; i < forecastMetrics.toolbarControls.length; i += 1) {
      for (let j = i + 1; j < forecastMetrics.toolbarControls.length; j += 1) {
        const a = forecastMetrics.toolbarControls[i]!.rect;
        const b = forecastMetrics.toolbarControls[j]!.rect;
        await expect(intersects(a, b)).toBeFalsy();
      }
    }

    await captureScreenshots(page, testInfo);
    await assertNoClientErrors(errors);
  });
});
