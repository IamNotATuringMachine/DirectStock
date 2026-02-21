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

type ClientErrors = {
  pageErrors: string[];
  consoleErrors: string[];
};

type SeededWarehouse = {
  id: number;
  code: string;
  name: string;
};

type SeededProduct = {
  id: number;
  productNumber: string;
  name: string;
};

type InventorySeed = {
  marker: string;
  searchableProduct: SeededProduct;
  filteredProduct: SeededProduct;
  primaryWarehouse: SeededWarehouse;
  secondaryWarehouse: SeededWarehouse;
};

type InventoryLayoutMetrics = {
  viewportWidth: number;
  htmlScrollWidth: number;
  bodyScrollWidth: number;
  panel: Rect;
  panelHeader: Rect | null;
  toolbar: Rect | null;
  searchInput: Rect | null;
  searchButton: Rect | null;
  warehouseFilter: Rect | null;
  kpiCards: Rect[];
  tableWrap: Rect | null;
  table: Rect | null;
  firstRow: Rect | null;
  firstRowDisplay: string | null;
  pagination: Rect | null;
  paginationActions: Rect | null;
  twoColGrid: Rect | null;
  twoColGridColumns: number;
  lowStockPanel: Rect | null;
  movementsPanel: Rect | null;
};

type InventoryModalMetrics = {
  viewportWidth: number;
  viewportHeight: number;
  backdrop: Rect | null;
  modal: Rect | null;
  header: Rect | null;
  closeButton: Rect | null;
  contentGridColumns: number;
};

type ProductListResponse = {
  items: Array<{ id: number; product_number: string; name: string }>;
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
  const relevantPageErrors = errors.pageErrors.filter(
    (message) =>
      !/AxiosError:\s*Network Error/i.test(message) &&
      !/XMLHttpRequest cannot load .* due to access control checks\./i.test(message),
  );
  await expect(relevantPageErrors, `Unexpected page errors: ${relevantPageErrors.join(" | ")}`).toEqual([]);
  const relevantConsoleErrors = errors.consoleErrors.filter(
    (message) => !/Failed to load resource: the server responded with a status of 404 \(Not Found\)/i.test(message),
  );
  await expect(relevantConsoleErrors, `Unexpected console errors: ${relevantConsoleErrors.join(" | ")}`).toEqual([]);
}

async function loginApi(request: APIRequestContext, username: string, password: string): Promise<string> {
  const response = await request.post("/api/auth/login", { data: { username, password } });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as { access_token: string };
  return payload.access_token;
}

async function ensureProductGroup(request: APIRequestContext, token: string, marker: string): Promise<number> {
  const groupName = `E2E-INV-G-${marker}`;
  const headers = { Authorization: `Bearer ${token}` };

  const listResponse = await request.get("/api/product-groups", { headers });
  expect(listResponse.ok()).toBeTruthy();
  const groups = (await listResponse.json()) as Array<{ id: number; name: string }>;
  const existing = groups.find((group) => group.name === groupName);
  if (existing) {
    return existing.id;
  }

  const createResponse = await request.post("/api/product-groups", {
    headers,
    data: {
      name: groupName,
      description: `Inventory UI test group ${marker}`,
    },
  });
  if (!createResponse.ok()) {
    expect(createResponse.status()).toBe(409);
    const refreshResponse = await request.get("/api/product-groups", { headers });
    expect(refreshResponse.ok()).toBeTruthy();
    const refreshed = (await refreshResponse.json()) as Array<{ id: number; name: string }>;
    const conflictGroup = refreshed.find((group) => group.name === groupName);
    expect(conflictGroup).toBeTruthy();
    return conflictGroup!.id;
  }

  const created = (await createResponse.json()) as { id: number };
  return created.id;
}

async function findProductByNumber(
  request: APIRequestContext,
  token: string,
  productNumber: string
): Promise<{ id: number; product_number: string; name: string } | null> {
  const response = await request.get(`/api/products?search=${encodeURIComponent(productNumber)}&page_size=200`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as ProductListResponse;
  return payload.items.find((item) => item.product_number === productNumber) ?? null;
}

async function createProductForInventoryUi(
  request: APIRequestContext,
  token: string,
  productGroupId: number,
  productNumber: string,
  name: string,
): Promise<SeededProduct> {
  const headers = { Authorization: `Bearer ${token}` };
  const createResponse = await request.post("/api/products", {
    headers,
    data: {
      product_number: productNumber,
      name,
      description: "Inventory UI regression seed data",
      product_group_id: productGroupId,
      unit: "piece",
      status: "active",
    },
  });

  if (!createResponse.ok()) {
    expect(createResponse.status()).toBe(409);
    const existing = await findProductByNumber(request, token, productNumber);
    expect(existing).toBeTruthy();
    return {
      id: existing!.id,
      productNumber,
      name: existing!.name,
    };
  }

  const created = (await createResponse.json()) as { id: number };
  return {
    id: created.id,
    productNumber,
    name,
  };
}

async function createWarehouse(
  request: APIRequestContext,
  token: string,
  marker: string,
  suffix: string,
): Promise<SeededWarehouse> {
  const headers = { Authorization: `Bearer ${token}` };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = `E2EI${marker.slice(-5)}${suffix}${attempt}`;
    const name = `E2E Inventory ${suffix}-${marker.slice(-4)}-${attempt}`;
    const response = await request.post("/api/warehouses", {
      headers,
      data: {
        code,
        name,
        address: `Inventory UI ${marker}`,
        is_active: true,
      },
    });
    if (response.ok()) {
      return (await response.json()) as SeededWarehouse;
    }
    expect(response.status()).toBe(409);
  }

  throw new Error(`Could not create warehouse for marker ${marker}/${suffix}`);
}

async function createZone(
  request: APIRequestContext,
  token: string,
  warehouseId: number,
  marker: string,
  suffix: string,
): Promise<{ id: number; code: string }> {
  const headers = { Authorization: `Bearer ${token}` };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = `E2IZ${marker.slice(-4)}${suffix}${attempt}`.slice(0, 10);
    const response = await request.post(`/api/warehouses/${warehouseId}/zones`, {
      headers,
      data: {
        code,
        name: `E2E Zone ${suffix}-${attempt}`,
        zone_type: "storage",
        is_active: true,
      },
    });
    if (response.ok()) {
      return (await response.json()) as { id: number; code: string };
    }
    expect(response.status()).toBe(409);
  }

  throw new Error(`Could not create zone for warehouse ${warehouseId}`);
}

async function createBin(
  request: APIRequestContext,
  token: string,
  zoneId: number,
  marker: string,
  suffix: string,
): Promise<{ id: number; code: string }> {
  const headers = { Authorization: `Bearer ${token}` };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = `E2IB${marker.slice(-4)}${suffix}${attempt}`.slice(0, 16);
    const response = await request.post(`/api/zones/${zoneId}/bins`, {
      headers,
      data: {
        code,
        bin_type: "storage",
        is_active: true,
      },
    });
    if (response.ok()) {
      return (await response.json()) as { id: number; code: string };
    }
    expect(response.status()).toBe(409);
  }

  throw new Error(`Could not create bin for zone ${zoneId}`);
}

async function createAndCompleteGoodsReceipt(
  request: APIRequestContext,
  token: string,
  binId: number,
  items: Array<{ productId: number; quantity: string }>,
): Promise<void> {
  const headers = { Authorization: `Bearer ${token}` };
  const receiptResponse = await request.post("/api/goods-receipts", {
    headers,
    data: {
      notes: `E2E inventory ui ${Date.now()}`,
    },
  });
  expect(receiptResponse.ok()).toBeTruthy();
  const receipt = (await receiptResponse.json()) as { id: number };

  for (const item of items) {
    const itemResponse = await request.post(`/api/goods-receipts/${receipt.id}/items`, {
      headers,
      data: {
        product_id: item.productId,
        received_quantity: item.quantity,
        unit: "piece",
        target_bin_id: binId,
      },
    });
    expect(itemResponse.ok()).toBeTruthy();
  }

  const completeResponse = await request.post(`/api/goods-receipts/${receipt.id}/complete`, { headers });
  expect(completeResponse.ok()).toBeTruthy();
}

async function seedInventoryData(request: APIRequestContext, token: string): Promise<InventorySeed> {
  const marker = `${Date.now()}${Math.floor(Math.random() * 10_000)
    .toString()
    .padStart(4, "0")}`;

  const productGroupId = await ensureProductGroup(request, token, marker);
  const primaryWarehouse = await createWarehouse(request, token, marker, "A");
  const secondaryWarehouse = await createWarehouse(request, token, marker, "B");
  const primaryZone = await createZone(request, token, primaryWarehouse.id, marker, "A");
  const secondaryZone = await createZone(request, token, secondaryWarehouse.id, marker, "B");
  const primaryBin = await createBin(request, token, primaryZone.id, marker, "A");
  const secondaryBin = await createBin(request, token, secondaryZone.id, marker, "B");

  const searchableProduct = await createProductForInventoryUi(
    request,
    token,
    productGroupId,
    `E2E-INV-S-${marker.slice(-6)}`,
    `Inventory Search Product ${marker.slice(-6)}`,
  );

  const filteredProduct = await createProductForInventoryUi(
    request,
    token,
    productGroupId,
    `E2E-INV-F-${marker.slice(-6)}`,
    `Inventory Filter Product ${marker.slice(-6)}`,
  );

  const extraProducts: SeededProduct[] = [];
  for (let index = 0; index < 4; index += 1) {
    const product = await createProductForInventoryUi(
      request,
      token,
      productGroupId,
      `E2E-INV-X-${marker.slice(-5)}-${index}`,
      `Inventory Extra ${marker.slice(-5)}-${index}`,
    );
    extraProducts.push(product);
  }

  await createAndCompleteGoodsReceipt(
    request,
    token,
    primaryBin.id,
    [
      { productId: searchableProduct.id, quantity: "7" },
      ...extraProducts.map((product, index) => ({ productId: product.id, quantity: String(2 + index) })),
    ],
  );

  await createAndCompleteGoodsReceipt(request, token, secondaryBin.id, [
    { productId: filteredProduct.id, quantity: "3" },
  ]);

  return {
    marker,
    searchableProduct,
    filteredProduct,
    primaryWarehouse,
    secondaryWarehouse,
  };
}

async function loginAndOpenInventory(page: Page, username: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByTestId("login-username").fill(username);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/inventory");
  await expect(page).toHaveURL(/\/inventory$/);
  await expect(page.getByTestId("inventory-page")).toBeVisible();
}

function parsePaginationValues(text: string): { page: number; totalPages: number; total: number } {
  const match = text.match(/Seite\s+(\d+)\s*\/\s*(\d+)\s*\((\d+)\s+Eintr[aä]ge\)/i);
  if (!match) {
    throw new Error(`Could not parse pagination text: "${text}"`);
  }
  return {
    page: Number(match[1]),
    totalPages: Number(match[2]),
    total: Number(match[3]),
  };
}

async function captureInventoryLayoutMetrics(page: Page): Promise<InventoryLayoutMetrics> {
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

    const panel = document.querySelector('[data-testid="inventory-page"]');
    if (!panel) {
      throw new Error("Inventory panel root not found.");
    }

    const panelHeader = panel.querySelector(".panel-header");
    const toolbar = panel.querySelector(".products-toolbar");
    const searchInput = panel.querySelector('[data-testid="inventory-search-input"]');
    const searchButton = panel.querySelector('[data-testid="inventory-search-btn"]');
    const warehouseFilter = panel.querySelector('[data-testid="inventory-warehouse-filter"]');
    const kpiCards = Array.from(panel.querySelectorAll('[data-testid="inventory-kpi-card"]'));
    const tableWrap = panel.querySelector(".table-wrap");
    const table = panel.querySelector('[data-testid="inventory-table"]');
    const firstRow = panel.querySelector('[data-testid^="inventory-row-"]');
    const pagination = panel.querySelector(".pagination");
    const paginationActions = panel.querySelector(".pagination-actions");
    const twoColGrid = panel.querySelector(".two-col-grid");
    const lowStockPanel = Array.from(panel.querySelectorAll("article.subpanel")).find(
      (item) => item.querySelector("h3")?.textContent?.includes("Niedrige Bestände")
    );
    const movementsPanel = Array.from(panel.querySelectorAll("article.subpanel")).find(
      (item) => item.querySelector("h3")?.textContent?.includes("Letzte Bewegungen")
    );

    const twoColGridColumns = twoColGrid
      ? getComputedStyle(twoColGrid)
        .gridTemplateColumns.split(" ")
        .map((chunk) => chunk.trim())
        .filter(Boolean).length
      : 0;

    return {
      viewportWidth: window.innerWidth,
      htmlScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      panel: rect(panel),
      panelHeader: panelHeader ? rect(panelHeader) : null,
      toolbar: toolbar ? rect(toolbar) : null,
      searchInput: searchInput ? rect(searchInput) : null,
      searchButton: searchButton ? rect(searchButton) : null,
      warehouseFilter: warehouseFilter ? rect(warehouseFilter) : null,
      kpiCards: kpiCards.map((card) => rect(card)),
      tableWrap: tableWrap ? rect(tableWrap) : null,
      table: table ? rect(table) : null,
      firstRow: firstRow ? rect(firstRow) : null,
      firstRowDisplay: firstRow ? getComputedStyle(firstRow).display : null,
      pagination: pagination ? rect(pagination) : null,
      paginationActions: paginationActions ? rect(paginationActions) : null,
      twoColGrid: twoColGrid ? rect(twoColGrid) : null,
      twoColGridColumns,
      lowStockPanel: lowStockPanel ? rect(lowStockPanel) : null,
      movementsPanel: movementsPanel ? rect(movementsPanel) : null,
    };
  });
}

async function captureInventoryModalMetrics(page: Page): Promise<InventoryModalMetrics> {
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

    const backdrop = document.querySelector(".modal-backdrop");
    const modal = document.querySelector('[data-testid="inventory-detail-sheet"]');
    const header = modal?.querySelector(".panel-header") ?? null;
    const closeButton = modal
      ? Array.from(modal.querySelectorAll("button.btn")).find((button) => button.textContent?.includes("Schließen")) ?? null
      : null;
    const contentGrid = modal?.querySelector(".two-col-grid") ?? null;
    const contentGridColumns = contentGrid
      ? getComputedStyle(contentGrid)
        .gridTemplateColumns.split(" ")
        .map((chunk) => chunk.trim())
        .filter(Boolean).length
      : 0;

    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      backdrop: backdrop ? rect(backdrop) : null,
      modal: modal ? rect(modal) : null,
      header: header ? rect(header) : null,
      closeButton: closeButton ? rect(closeButton) : null,
      contentGridColumns,
    };
  });
}

test.describe("/inventory page ui and functional regression", () => {
  test("functional and ui-formatting: controls, modal, alignment and responsiveness", async (
    { page, request },
    testInfo: TestInfo,
  ) => {
    test.slow();
    const errors = collectClientErrors(page);
    const user = await createE2EUserWithRoles(request, ["admin"]);
    const token = await loginApi(request, user.username, user.password);
    const seed = await seedInventoryData(request, token);

    await loginAndOpenInventory(page, user.username, user.password);

    await expect(page.getByRole("heading", { name: "Bestandsübersicht" })).toBeVisible();
    await expect(page.getByTestId("inventory-search-input")).toBeVisible();
    await expect(page.getByTestId("inventory-search-btn")).toBeVisible();
    await expect(page.getByTestId("inventory-warehouse-filter")).toBeVisible();
    await expect(page.getByTestId("inventory-table")).toBeVisible();
    await expect(page.locator(".pagination")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Niedrige Bestände" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Letzte Bewegungen" })).toBeVisible();

    await page.getByTestId("inventory-search-input").fill(seed.searchableProduct.productNumber);
    await page.getByTestId("inventory-search-btn").click();
    await expect(page.getByTestId(`inventory-row-${seed.searchableProduct.id}`)).toBeVisible();
    await expect(page.getByTestId(`inventory-row-${seed.filteredProduct.id}`)).toHaveCount(0);

    await page.getByTestId("inventory-search-input").fill("");
    await page.getByTestId("inventory-search-btn").click();
    await expect(page.getByTestId("inventory-table")).toBeVisible();

    await page.getByTestId("inventory-warehouse-filter").selectOption(seed.secondaryWarehouse.id.toString());
    await expect(page.getByTestId(`inventory-row-${seed.filteredProduct.id}`)).toBeVisible();
    await expect(page.getByTestId(`inventory-row-${seed.searchableProduct.id}`)).toHaveCount(0);

    await page.getByTestId("inventory-warehouse-filter").selectOption("");
    await page.getByTestId("inventory-search-input").fill(seed.searchableProduct.productNumber);
    await page.getByTestId("inventory-search-btn").click();
    const searchableRow = page.getByTestId(`inventory-row-${seed.searchableProduct.id}`);
    await expect(searchableRow).toBeVisible();

    await searchableRow.click();
    const detailSheet = page.getByTestId("inventory-detail-sheet");
    await expect(detailSheet).toBeVisible();
    await expect(detailSheet.getByRole("heading", { name: seed.searchableProduct.productNumber })).toBeVisible();
    await expect(detailSheet.getByRole("heading", { name: "Bestand pro Lagerplatz" })).toBeVisible();
    await expect(detailSheet.getByRole("heading", { name: "Letzte 10 Bewegungen" })).toBeVisible();
    await expect(detailSheet.getByText(seed.primaryWarehouse.code, { exact: false })).toBeVisible();

    mkdirSync("output", { recursive: true });
    await page.screenshot({ path: `output/inventory-page-modal-${testInfo.project.name}.png` });

    const modalMetrics = await captureInventoryModalMetrics(page);
    expect(modalMetrics.backdrop).not.toBeNull();
    expect(modalMetrics.modal).not.toBeNull();
    expect(modalMetrics.header).not.toBeNull();
    expect(modalMetrics.closeButton).not.toBeNull();
    if (modalMetrics.modal) {
      expect(modalMetrics.modal.width).toBeGreaterThan(260);
      expect(modalMetrics.modal.height).toBeGreaterThan(120);
      expect(modalMetrics.modal.left).toBeGreaterThanOrEqual(0);
      expect(modalMetrics.modal.right).toBeLessThanOrEqual(modalMetrics.viewportWidth + 1);
      expect(modalMetrics.modal.top).toBeGreaterThanOrEqual(0);
      expect(modalMetrics.modal.bottom).toBeLessThanOrEqual(modalMetrics.viewportHeight + 1);
    }
    if (modalMetrics.viewportWidth <= 900) {
      expect(modalMetrics.contentGridColumns).toBe(1);
    } else {
      expect(modalMetrics.contentGridColumns).toBe(2);
    }

    await detailSheet.getByRole("button", { name: "Schließen" }).click();
    await expect(detailSheet).toHaveCount(0);

    await searchableRow.click();
    await expect(detailSheet).toBeVisible();
    await page.locator(".modal-backdrop").click({ position: { x: 8, y: 8 } });
    await expect(detailSheet).toHaveCount(0);

    await page.getByTestId("inventory-search-input").fill("");
    await page.getByTestId("inventory-search-btn").click();

    const paginationTextLocator = page.locator(".pagination > span");
    await expect(paginationTextLocator).toBeVisible();
    const paginationBeforeText = (await paginationTextLocator.textContent()) ?? "";
    const paginationBefore = parsePaginationValues(paginationBeforeText);
    const backButton = page.getByRole("button", { name: "Zurück" });
    const nextButton = page.getByRole("button", { name: "Weiter" });

    if (paginationBefore.totalPages > 1) {
      await expect(nextButton).toBeEnabled();
      await nextButton.click();
      await expect.poll(async () => parsePaginationValues((await paginationTextLocator.textContent()) ?? "").page).toBe(
        paginationBefore.page + 1
      );
      await expect(backButton).toBeEnabled();
      await backButton.click();
      await expect.poll(async () => parsePaginationValues((await paginationTextLocator.textContent()) ?? "").page).toBe(
        paginationBefore.page
      );
    } else {
      await expect(nextButton).toBeDisabled();
      await expect(backButton).toBeDisabled();
    }

    await expect(page.locator('[data-testid^="inventory-row-"]').first()).toBeVisible();

    await page.waitForTimeout(250);
    await page.screenshot({ path: `output/inventory-page-${testInfo.project.name}.png` });
    const metrics = await captureInventoryLayoutMetrics(page);

    const overflowTolerance = metrics.viewportWidth <= 1024 ? 32 : 1;
    expect(metrics.htmlScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + overflowTolerance);
    expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + overflowTolerance);
    expect(metrics.panel.width).toBeGreaterThan(240);
    expect(metrics.panel.left).toBeGreaterThanOrEqual(-1);
    expect(metrics.panel.right).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.panelHeader).not.toBeNull();
    expect(metrics.toolbar).not.toBeNull();
    expect(metrics.searchInput).not.toBeNull();
    expect(metrics.searchButton).not.toBeNull();
    expect(metrics.warehouseFilter).not.toBeNull();
    expect(metrics.kpiCards.length).toBe(4);
    expect(metrics.tableWrap).not.toBeNull();
    expect(metrics.table).not.toBeNull();
    expect(metrics.pagination).not.toBeNull();
    expect(metrics.paginationActions).not.toBeNull();
    expect(metrics.twoColGrid).not.toBeNull();
    expect(metrics.lowStockPanel).not.toBeNull();
    expect(metrics.movementsPanel).not.toBeNull();
    expect(metrics.firstRow).not.toBeNull();

    for (const [name, area] of [
      ["panelHeader", metrics.panelHeader],
      ["toolbar", metrics.toolbar],
      ["searchInput", metrics.searchInput],
      ["searchButton", metrics.searchButton],
      ["warehouseFilter", metrics.warehouseFilter],
      ["tableWrap", metrics.tableWrap],
      ["pagination", metrics.pagination],
      ["paginationActions", metrics.paginationActions],
      ["twoColGrid", metrics.twoColGrid],
      ["lowStockPanel", metrics.lowStockPanel],
      ["movementsPanel", metrics.movementsPanel],
    ] as const) {
      expect(area, `Missing area: ${name}`).not.toBeNull();
      if (!area) {
        continue;
      }
      expect(area.width, `${name} width`).toBeGreaterThan(60);
      expect(area.height, `${name} height`).toBeGreaterThan(24);
      expect(area.left, `${name} left`).toBeGreaterThanOrEqual(metrics.panel.left - 1);
      expect(area.right, `${name} right`).toBeLessThanOrEqual(metrics.panel.right + overflowTolerance);
    }

    for (const [index, card] of metrics.kpiCards.entries()) {
      expect(card.width, `kpi card ${index} width`).toBeGreaterThan(80);
      expect(card.height, `kpi card ${index} height`).toBeGreaterThan(40);
      expect(card.left, `kpi card ${index} left`).toBeGreaterThanOrEqual(metrics.panel.left - 1);
      expect(card.right, `kpi card ${index} right`).toBeLessThanOrEqual(metrics.panel.right + overflowTolerance);
    }

    if (metrics.searchInput && metrics.searchButton) {
      expect(intersects(metrics.searchInput, metrics.searchButton)).toBeFalsy();
    }
    if (metrics.searchButton && metrics.warehouseFilter) {
      expect(intersects(metrics.searchButton, metrics.warehouseFilter)).toBeFalsy();
    }

    if (metrics.lowStockPanel && metrics.movementsPanel) {
      if (metrics.viewportWidth <= 900) {
        expect(metrics.twoColGridColumns).toBe(1);
        expect(metrics.movementsPanel.top).toBeGreaterThanOrEqual(metrics.lowStockPanel.bottom - 1);
      } else {
        expect(metrics.twoColGridColumns).toBe(2);
        expect(intersects(metrics.lowStockPanel, metrics.movementsPanel)).toBeFalsy();
      }
    }

    expect(metrics.firstRowDisplay).toBe("table-row");

    await assertNoClientErrors(errors);
  });
});
