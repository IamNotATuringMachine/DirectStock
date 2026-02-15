import { mkdirSync } from "node:fs";
import { expect, test, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";

import {
  createE2EUserWithRoles,
  ensureE2EInventoryStock,
  ensureE2EProduct,
  ensureE2ESupplier,
} from "./helpers/api";

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

type ProductSeed = {
  id: number;
  productNumber: string;
};

type PurchasingSeed = {
  username: string;
  password: string;
  token: string;
  supplierId: number;
  productA: ProductSeed;
  productB: ProductSeed;
};

type OrdersLayoutMetrics = {
  viewportWidth: number;
  htmlScrollWidth: number;
  bodyScrollWidth: number;
  panel: Rect;
  panelHeader: Rect | null;
  tabsRow: Rect | null;
  tabButtons: Rect[];
  warehouseGrid: Rect | null;
  warehouseGridColumns: number;
  subpanels: Rect[];
  orderCreateForm: Rect | null;
  orderList: Rect | null;
  orderItemsList: Rect | null;
  statusWorkflow: Rect | null;
};

type TabLayoutMetrics = {
  viewportWidth: number;
  panel: Rect;
  tabPanel: Rect | null;
  tableWrap: Rect | null;
  tableRect: Rect | null;
  firstRowDisplay: string | null;
};

function intersects(a: Rect, b: Rect): boolean {
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

function expectedWarehouseGridColumns(viewportWidth: number): number {
  if (viewportWidth <= 900) {
    return 1;
  }
  if (viewportWidth <= 1360) {
    return 2;
  }
  return 3;
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

async function loginApi(request: APIRequestContext, username: string, password: string): Promise<string> {
  const response = await request.post("/api/auth/login", {
    data: { username, password },
  });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as { access_token: string };
  return payload.access_token;
}

async function loginUi(page: Page, username: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByTestId("login-username").fill(username);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function fetchProductByNumber(
  request: APIRequestContext,
  token: string,
  productNumber: string,
): Promise<ProductSeed> {
  const response = await request.get(`/api/products?search=${encodeURIComponent(productNumber)}&page_size=200`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as {
    items: Array<{ id: number; product_number: string }>;
  };

  const found = payload.items.find((item) => item.product_number === productNumber);
  expect(found).toBeTruthy();
  return { id: found!.id, productNumber };
}

async function upsertWarehouseSetting(
  request: APIRequestContext,
  token: string,
  productId: number,
  warehouseId: number,
): Promise<void> {
  const response = await request.put(`/api/products/${productId}/warehouse-settings/${warehouseId}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      min_stock: "10",
      reorder_point: "12",
      safety_stock: "3",
      max_stock: "40",
      lead_time_days: 3,
    },
  });
  expect(response.ok()).toBeTruthy();
}

async function createProductSupplierRelation(
  request: APIRequestContext,
  token: string,
  productId: number,
  supplierId: number,
): Promise<void> {
  const response = await request.post(`/api/products/${productId}/suppliers`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      supplier_id: supplierId,
      supplier_product_number: `E2E-SKU-${Date.now()}`,
      price: "11.90",
      lead_time_days: 2,
      min_order_quantity: "2",
      is_preferred: true,
    },
  });
  expect(response.ok()).toBeTruthy();
}

async function createGoodsIssueForAbc(
  request: APIRequestContext,
  token: string,
  productId: number,
  sourceBinId: number,
): Promise<void> {
  const headers = { Authorization: `Bearer ${token}` };
  const issue = await request.post("/api/goods-issues", {
    headers,
    data: {
      notes: `E2E purchasing abc seed ${Date.now()}`,
    },
  });
  expect(issue.ok()).toBeTruthy();
  const issuePayload = (await issue.json()) as { id: number };

  const item = await request.post(`/api/goods-issues/${issuePayload.id}/items`, {
    headers,
    data: {
      product_id: productId,
      requested_quantity: "1",
      unit: "piece",
      source_bin_id: sourceBinId,
    },
  });
  expect(item.ok()).toBeTruthy();

  const complete = await request.post(`/api/goods-issues/${issuePayload.id}/complete`, { headers });
  expect(complete.ok()).toBeTruthy();
}

async function fetchRecommendationById(
  request: APIRequestContext,
  token: string,
  recommendationId: number,
): Promise<{
  id: number;
  product_id: number;
  status: string;
  converted_purchase_order_id: number | null;
} | null> {
  const response = await request.get("/api/purchase-recommendations", {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as {
    items: Array<{
      id: number;
      product_id: number;
      status: string;
      converted_purchase_order_id: number | null;
    }>;
  };

  return payload.items.find((item) => item.id === recommendationId) ?? null;
}

async function waitForOpenRecommendations(
  request: APIRequestContext,
  token: string,
  productIds: number[],
): Promise<Map<number, number>> {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const foundByProduct = new Map<number, number>();
    for (const productId of productIds) {
      const response = await request.get(`/api/purchase-recommendations?status=open&product_id=${productId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.ok()).toBeTruthy();
      const payload = (await response.json()) as {
        items: Array<{ id: number; product_id: number }>;
      };

      const item = payload.items.find((candidate) => candidate.product_id === productId);
      if (item) {
        foundByProduct.set(productId, item.id);
      }
    }

    if (foundByProduct.size === productIds.length) {
      return foundByProduct;
    }

    await new Promise((resolve) => setTimeout(resolve, 350));
  }

  throw new Error("Timed out waiting for open purchase recommendations for seeded products");
}

async function seedPurchasingData(request: APIRequestContext): Promise<PurchasingSeed> {
  const user = await createE2EUserWithRoles(request, ["admin"]);
  const token = await loginApi(request, user.username, user.password);
  const marker = `${Date.now()}${Math.floor(Math.random() * 10_000)
    .toString()
    .padStart(4, "0")}`;

  const supplier = await ensureE2ESupplier(request, token, `E2E-SUP-PU-${marker}`);

  const seededInventory = await ensureE2EInventoryStock(request, token, `E2E-PU-A-${marker}`);
  const productBNumber = await ensureE2EProduct(request, token, `E2E-PU-B-${marker}`);

  const productA = await fetchProductByNumber(request, token, seededInventory.productNumber);
  const productB = await fetchProductByNumber(request, token, productBNumber);

  await upsertWarehouseSetting(request, token, productA.id, seededInventory.warehouseId);
  await upsertWarehouseSetting(request, token, productB.id, seededInventory.warehouseId);
  await createProductSupplierRelation(request, token, productA.id, supplier.id);
  await createGoodsIssueForAbc(request, token, productA.id, seededInventory.binId);

  return {
    username: user.username,
    password: user.password,
    token,
    supplierId: supplier.id,
    productA,
    productB,
  };
}

async function openPurchasingPage(page: Page, username: string, password: string): Promise<void> {
  await loginUi(page, username, password);
  await page.goto("/purchasing");
  await expect(page).toHaveURL(/\/purchasing$/);
  await expect(page.getByTestId("purchasing-page")).toBeVisible();
}

async function captureOrdersLayoutMetrics(page: Page): Promise<OrdersLayoutMetrics> {
  return page.evaluate(() => {
    const toRect = (element: Element) => {
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

    const panel = document.querySelector('[data-testid="purchasing-page"]');
    if (!panel) {
      throw new Error("Purchasing panel not found");
    }

    const tabsRow = panel.querySelector(".actions-cell");
    const tabButtons = Array.from(panel.querySelectorAll('[data-testid^="purchasing-tab-"]'));
    const warehouseGrid = panel.querySelector(".warehouse-grid");
    const subpanels = warehouseGrid ? Array.from(warehouseGrid.querySelectorAll(":scope > article.subpanel")) : [];
    const panelHeader = panel.querySelector(".panel-header");

    const warehouseGridColumns = warehouseGrid
      ? window
          .getComputedStyle(warehouseGrid)
          .gridTemplateColumns.split(" ")
          .map((chunk) => chunk.trim())
          .filter(Boolean).length
      : 0;

    return {
      viewportWidth: window.innerWidth,
      htmlScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      panel: toRect(panel),
      panelHeader: panelHeader ? toRect(panelHeader) : null,
      tabsRow: tabsRow ? toRect(tabsRow) : null,
      tabButtons: tabButtons.map((button) => toRect(button)),
      warehouseGrid: warehouseGrid ? toRect(warehouseGrid) : null,
      warehouseGridColumns,
      subpanels: subpanels.map((panelItem) => toRect(panelItem)),
      orderCreateForm: panel.querySelector('[data-testid="purchase-order-create-form"]')
        ? toRect(panel.querySelector('[data-testid="purchase-order-create-form"]') as Element)
        : null,
      orderList: panel.querySelector('[data-testid="purchase-order-list"]')
        ? toRect(panel.querySelector('[data-testid="purchase-order-list"]') as Element)
        : null,
      orderItemsList: panel.querySelector('[data-testid="purchase-order-items-list"]')
        ? toRect(panel.querySelector('[data-testid="purchase-order-items-list"]') as Element)
        : null,
      statusWorkflow: panel.querySelector('[data-testid="purchase-order-selected-status"]')
        ? toRect(panel.querySelector('[data-testid="purchase-order-selected-status"]') as Element)
        : null,
    };
  });
}

async function captureTabLayoutMetrics(page: Page, tabPanelTestId: string, tableTestId: string): Promise<TabLayoutMetrics> {
  return page.evaluate(
    (payload) => {
      const toRect = (element: Element) => {
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

      const panel = document.querySelector('[data-testid="purchasing-page"]');
      if (!panel) {
        throw new Error("Purchasing panel not found");
      }

      const tabPanel = panel.querySelector(`[data-testid="${payload.tabPanelTestId}"]`);
      const table = panel.querySelector(`[data-testid="${payload.tableTestId}"]`);
      const tableWrap = table?.closest(".table-wrap") ?? null;
      const firstRow = table?.querySelector("tbody tr") ?? null;

      return {
        viewportWidth: window.innerWidth,
        panel: toRect(panel),
        tabPanel: tabPanel ? toRect(tabPanel) : null,
        tableWrap: tableWrap ? toRect(tableWrap) : null,
        tableRect: table ? toRect(table) : null,
        firstRowDisplay: firstRow ? window.getComputedStyle(firstRow).display : null,
      };
    },
    { tabPanelTestId, tableTestId },
  );
}

async function captureScreenshots(page: Page, testInfo: TestInfo): Promise<void> {
  mkdirSync("output", { recursive: true });
  const project = testInfo.project.name;

  await page.getByTestId("purchasing-tab-orders").click();
  await expect(page.getByTestId("purchase-order-create-form")).toBeVisible();
  await page.screenshot({
    path: `output/purchasing-page-${project}.png`,
    fullPage: true,
  });

  await page.getByTestId("purchasing-tab-abc").click();
  await expect(page.getByTestId("purchasing-abc-tab")).toBeVisible();
  await page.screenshot({
    path: `output/purchasing-page-abc-${project}.png`,
    fullPage: true,
  });

  await page.getByTestId("purchasing-tab-recommendations").click();
  await expect(page.getByTestId("purchasing-recommendations-tab")).toBeVisible();
  await page.screenshot({
    path: `output/purchasing-page-recommendations-${project}.png`,
    fullPage: true,
  });
}

test.describe("/purchasing page ui and functional regression", () => {
  test("functional: all interactive controls are operable end-to-end", async ({ page, request }) => {
    const errors = collectClientErrors(page);
    const seed = await seedPurchasingData(request);

    await openPurchasingPage(page, seed.username, seed.password);

    await expect(page.getByTestId("purchasing-tab-orders")).toBeVisible();
    await expect(page.getByTestId("purchasing-tab-abc")).toBeVisible();
    await expect(page.getByTestId("purchasing-tab-recommendations")).toBeVisible();

    await expect(page.getByRole("heading", { name: "1. Bestellung anlegen" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "2. Positionen" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "3. Statusworkflow" })).toBeVisible();

    await page.getByTestId("purchase-order-supplier-select").selectOption(String(seed.supplierId));
    await page.getByTestId("purchase-order-notes-input").fill(`E2E Purchasing UI ${Date.now()}`);
    await page.getByTestId("purchase-order-create-btn").click();

    await expect(page.getByTestId("purchase-order-selected-status")).toContainText("(draft)");
    await expect.poll(async () => await page.locator('[data-testid^="purchase-order-item-"]').count()).toBeGreaterThan(0);
    const firstOrderEntry = page.locator('[data-testid^="purchase-order-item-"]').first();
    await expect(firstOrderEntry.locator("strong")).toHaveCSS("display", "block");
    await expect(firstOrderEntry.locator("span")).toHaveCSS("display", "block");

    const option = page
      .locator('[data-testid="purchase-order-item-product-select"] option', { hasText: seed.productA.productNumber })
      .first();
    await expect(option).toHaveCount(1);
    const optionValue = await option.getAttribute("value");
    expect(optionValue).toBeTruthy();

    await page.getByTestId("purchase-order-item-product-select").selectOption(optionValue!);
    await page.getByTestId("purchase-order-item-quantity-input").fill("5");
    await page.getByTestId("purchase-order-item-price-input").fill("12.50");
    await page.getByTestId("purchase-order-item-add-btn").click();

    await expect(page.getByTestId("purchase-order-items-list")).toContainText(`Produkt #${seed.productA.id}`);
    await expect(page.getByTestId("purchase-order-items-list")).toContainText("Menge: 5");

    await page.getByTestId("purchase-order-status-approved").click();
    await expect(page.getByTestId("purchase-order-selected-status")).toContainText("(approved)");
    await page.getByTestId("purchase-order-status-ordered").click();
    await expect(page.getByTestId("purchase-order-selected-status")).toContainText("(ordered)");
    await expect(page.getByTestId("purchase-order-item-add-btn")).toBeDisabled();

    await page.getByTestId("purchasing-tab-abc").click();
    await expect(page.getByTestId("purchasing-abc-tab")).toBeVisible();
    await page.getByTestId("abc-recompute-btn").click();
    await expect.poll(async () => await page.getByTestId("abc-table").locator("tbody tr").count()).toBeGreaterThan(0);

    await page.getByTestId("purchasing-tab-recommendations").click();
    await expect(page.getByTestId("purchasing-recommendations-tab")).toBeVisible();
    await page.getByTestId("purchase-recommendations-generate-btn").click();

    const recommendationMap = await waitForOpenRecommendations(request, seed.token, [seed.productA.id, seed.productB.id]);
    const recommendationAId = recommendationMap.get(seed.productA.id);
    const recommendationBId = recommendationMap.get(seed.productB.id);
    expect(recommendationAId).toBeTruthy();
    expect(recommendationBId).toBeTruthy();

    await expect(page.getByTestId(`purchase-recommendation-convert-${recommendationAId!}`)).toBeVisible();
    await expect(page.getByTestId(`purchase-recommendation-dismiss-${recommendationBId!}`)).toBeVisible();

    await page.getByTestId(`purchase-recommendation-convert-${recommendationAId!}`).click();
    await expect(page.getByTestId(`purchase-recommendation-convert-${recommendationAId!}`)).toHaveCount(0);
    await expect
      .poll(async () => {
        const rec = await fetchRecommendationById(request, seed.token, recommendationAId!);
        return {
          status: rec?.status ?? null,
          po: rec?.converted_purchase_order_id ?? null,
        };
      })
      .toMatchObject({ status: "converted" });

    await page.getByTestId(`purchase-recommendation-dismiss-${recommendationBId!}`).click();
    await expect(page.getByTestId(`purchase-recommendation-dismiss-${recommendationBId!}`)).toHaveCount(0);
    await expect.poll(async () => (await fetchRecommendationById(request, seed.token, recommendationBId!))?.status).toBe(
      "dismissed",
    );

    await assertNoClientErrors(errors);
  });

  test("ui: cards, tables and responsive layout remain stable", async ({ page, request }, testInfo) => {
    const errors = collectClientErrors(page);
    const seed = await seedPurchasingData(request);

    await openPurchasingPage(page, seed.username, seed.password);

    const ordersMetrics = await captureOrdersLayoutMetrics(page);
    await expect(ordersMetrics.htmlScrollWidth).toBeLessThanOrEqual(ordersMetrics.viewportWidth + 1);
    await expect(ordersMetrics.bodyScrollWidth).toBeLessThanOrEqual(ordersMetrics.viewportWidth + 1);

    await expect(ordersMetrics.panelHeader).not.toBeNull();
    await expect(ordersMetrics.tabsRow).not.toBeNull();
    await expect(ordersMetrics.warehouseGrid).not.toBeNull();
    await expect(ordersMetrics.orderCreateForm).not.toBeNull();
    await expect(ordersMetrics.orderList).not.toBeNull();
    await expect(ordersMetrics.subpanels.length).toBe(3);
    await expect(ordersMetrics.warehouseGridColumns).toBe(expectedWarehouseGridColumns(ordersMetrics.viewportWidth));

    for (const button of ordersMetrics.tabButtons) {
      await expect(button.width).toBeGreaterThan(20);
      await expect(button.height).toBeGreaterThan(30);
      await expect(button.left).toBeGreaterThanOrEqual(ordersMetrics.panel.left - 1);
      await expect(button.right).toBeLessThanOrEqual(ordersMetrics.panel.right + 1);
    }

    for (let i = 0; i < ordersMetrics.tabButtons.length; i += 1) {
      for (let j = i + 1; j < ordersMetrics.tabButtons.length; j += 1) {
        await expect(intersects(ordersMetrics.tabButtons[i]!, ordersMetrics.tabButtons[j]!)).toBeFalsy();
      }
    }

    for (const subpanel of ordersMetrics.subpanels) {
      await expect(subpanel.width).toBeGreaterThan(0);
      await expect(subpanel.height).toBeGreaterThan(0);
      await expect(subpanel.left).toBeGreaterThanOrEqual(ordersMetrics.panel.left - 1);
      await expect(subpanel.right).toBeLessThanOrEqual(ordersMetrics.panel.right + 1);
    }

    for (let i = 0; i < ordersMetrics.subpanels.length; i += 1) {
      for (let j = i + 1; j < ordersMetrics.subpanels.length; j += 1) {
        await expect(intersects(ordersMetrics.subpanels[i]!, ordersMetrics.subpanels[j]!)).toBeFalsy();
      }
    }

    await page.getByTestId("purchasing-tab-abc").click();
    await expect(page.getByTestId("purchasing-abc-tab")).toBeVisible();
    const abcMetrics = await captureTabLayoutMetrics(page, "purchasing-abc-tab", "abc-table");
    await expect(abcMetrics.tabPanel).not.toBeNull();
    await expect(abcMetrics.tableWrap).not.toBeNull();
    await expect(abcMetrics.tableRect).not.toBeNull();
    if (abcMetrics.firstRowDisplay) {
      if (abcMetrics.viewportWidth <= 768) {
        await expect(abcMetrics.firstRowDisplay).toBe("grid");
      } else {
        await expect(abcMetrics.firstRowDisplay).toBe("table-row");
      }
    }

    await page.getByTestId("purchasing-tab-recommendations").click();
    await expect(page.getByTestId("purchasing-recommendations-tab")).toBeVisible();
    const recommendationsMetrics = await captureTabLayoutMetrics(
      page,
      "purchasing-recommendations-tab",
      "purchase-recommendations-table",
    );
    await expect(recommendationsMetrics.tabPanel).not.toBeNull();
    await expect(recommendationsMetrics.tableWrap).not.toBeNull();
    await expect(recommendationsMetrics.tableRect).not.toBeNull();
    if (recommendationsMetrics.firstRowDisplay) {
      if (recommendationsMetrics.viewportWidth <= 768) {
        await expect(recommendationsMetrics.firstRowDisplay).toBe("grid");
      } else {
        await expect(recommendationsMetrics.firstRowDisplay).toBe("table-row");
      }
    }

    await captureScreenshots(page, testInfo);
    await assertNoClientErrors(errors);
  });
});
