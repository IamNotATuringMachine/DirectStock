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

type SeededProduct = {
  id: number;
  productNumber: string;
  name: string;
  description: string;
  status: "active" | "blocked";
  groupName: string;
};

type SeededProductDetailData = {
  marker: string;
  stockedProduct: SeededProduct;
  emptyProduct: SeededProduct;
  warehouseCode: string;
  zoneCode: string;
  binCode: string;
  receivedQuantity: string;
};

type ProductDetailLayoutMetrics = {
  viewportWidth: number;
  htmlScrollWidth: number;
  bodyScrollWidth: number;
  isStackedLayout: boolean;
  panel: Rect;
  header: Rect | null;
  actionsCell: Rect | null;
  toListLink: Rect | null;
  editLink: Rect | null;
  summaryCard: Rect | null;
  twoColGrid: Rect | null;
  inventoryCard: Rect | null;
  movementsCard: Rect | null;
  firstInventoryItem: Rect | null;
  firstMovementItem: Rect | null;
  actionsCellDisplay: string | null;
};

type ProductListItem = {
  id: number;
  product_number: string;
  name: string;
};

type ProductListResponse = {
  items: ProductListItem[];
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

async function loginApi(request: APIRequestContext, username: string, password: string): Promise<string> {
  const response = await request.post("/api/auth/login", {
    data: { username, password },
  });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as { access_token: string };
  return payload.access_token;
}

async function ensureProductGroup(request: APIRequestContext, token: string, groupName: string): Promise<number> {
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
      description: `E2E product detail group ${groupName}`,
    },
  });
  if (createResponse.ok()) {
    const created = (await createResponse.json()) as { id: number };
    return created.id;
  }

  expect(createResponse.status()).toBe(409);
  const refreshResponse = await request.get("/api/product-groups", { headers });
  expect(refreshResponse.ok()).toBeTruthy();
  const refreshed = (await refreshResponse.json()) as Array<{ id: number; name: string }>;
  const refreshedGroup = refreshed.find((group) => group.name === groupName);
  expect(refreshedGroup).toBeTruthy();
  return refreshedGroup!.id;
}

async function findProductByNumber(
  request: APIRequestContext,
  token: string,
  productNumber: string
): Promise<ProductListItem | null> {
  const response = await request.get(`/api/products?search=${encodeURIComponent(productNumber)}&page_size=200`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as ProductListResponse;
  return payload.items.find((item) => item.product_number === productNumber) ?? null;
}

async function createProductWithFallback(
  request: APIRequestContext,
  token: string,
  payload: {
    product_number: string;
    name: string;
    description: string;
    product_group_id: number;
    unit: string;
    status: "active" | "blocked";
  }
): Promise<SeededProduct> {
  const headers = { Authorization: `Bearer ${token}` };
  const createResponse = await request.post("/api/products", {
    headers,
    data: payload,
  });

  if (!createResponse.ok()) {
    expect(createResponse.status()).toBe(409);
    const existing = await findProductByNumber(request, token, payload.product_number);
    expect(existing).toBeTruthy();
    return {
      id: existing!.id,
      productNumber: payload.product_number,
      name: payload.name,
      description: payload.description,
      status: payload.status,
      groupName: "",
    };
  }

  const created = (await createResponse.json()) as { id: number };
  return {
    id: created.id,
    productNumber: payload.product_number,
    name: payload.name,
    description: payload.description,
    status: payload.status,
    groupName: "",
  };
}

async function createWarehouseZoneBin(
  request: APIRequestContext,
  token: string,
  marker: string
): Promise<{ warehouseId: number; warehouseCode: string; zoneId: number; zoneCode: string; binId: number; binCode: string }> {
  const headers = { Authorization: `Bearer ${token}` };
  let createdWarehouse: { id: number; code: string } | null = null;
  let codeSuffix = "";

  for (let attempt = 0; attempt < 5; attempt += 1) {
    codeSuffix = `${marker.slice(-8)}${attempt}`;
    const createWarehouse = await request.post("/api/warehouses", {
      headers,
      data: {
        code: `E2EPD${codeSuffix}`,
        name: `E2E Product Detail ${codeSuffix}`,
        is_active: true,
      },
    });
    if (createWarehouse.ok()) {
      createdWarehouse = (await createWarehouse.json()) as { id: number; code: string };
      break;
    }
    if (createWarehouse.status() !== 409) {
      expect(createWarehouse.ok()).toBeTruthy();
    }
  }

  expect(createdWarehouse).toBeTruthy();

  const createZone = await request.post(`/api/warehouses/${createdWarehouse!.id}/zones`, {
    headers,
    data: {
      code: `Z${codeSuffix}`,
      name: `E2E Zone ${codeSuffix}`,
      zone_type: "storage",
      is_active: true,
    },
  });
  expect(createZone.ok()).toBeTruthy();
  const zone = (await createZone.json()) as { id: number; code: string };

  const createBin = await request.post(`/api/zones/${zone.id}/bins`, {
    headers,
    data: {
      code: `B${codeSuffix}`,
      bin_type: "storage",
      is_active: true,
    },
  });
  expect(createBin.ok()).toBeTruthy();
  const bin = (await createBin.json()) as { id: number; code: string };

  return {
    warehouseId: createdWarehouse!.id,
    warehouseCode: createdWarehouse!.code,
    zoneId: zone.id,
    zoneCode: zone.code,
    binId: bin.id,
    binCode: bin.code,
  };
}

async function createReceiptStockMovement(
  request: APIRequestContext,
  token: string,
  productId: number,
  binId: number,
  quantity: string
): Promise<void> {
  const headers = { Authorization: `Bearer ${token}` };
  const receiptResponse = await request.post("/api/goods-receipts", {
    headers,
    data: { notes: `E2E product detail receipt ${Date.now()}` },
  });
  expect(receiptResponse.ok()).toBeTruthy();
  const receipt = (await receiptResponse.json()) as { id: number };

  const itemResponse = await request.post(`/api/goods-receipts/${receipt.id}/items`, {
    headers,
    data: {
      product_id: productId,
      received_quantity: quantity,
      unit: "piece",
      target_bin_id: binId,
    },
  });
  expect(itemResponse.ok()).toBeTruthy();

  const completeResponse = await request.post(`/api/goods-receipts/${receipt.id}/complete`, {
    headers,
  });
  expect(completeResponse.ok()).toBeTruthy();
}

async function seedProductDetailData(request: APIRequestContext, token: string): Promise<SeededProductDetailData> {
  const marker = `${Date.now()}${Math.floor(Math.random() * 10_000)
    .toString()
    .padStart(4, "0")}`;

  const groupName = `E2E-PD-GROUP-${marker}`;
  const groupId = await ensureProductGroup(request, token, groupName);

  const stockedProduct = await createProductWithFallback(request, token, {
    product_number: `E2E-PD-${marker}-STOCK`,
    name: `E2E Product Detail Stock ${marker}`,
    description: `Seeded stocked product ${marker}`,
    product_group_id: groupId,
    unit: "piece",
    status: "active",
  });

  const emptyProduct = await createProductWithFallback(request, token, {
    product_number: `E2E-PD-${marker}-EMPTY`,
    name: `E2E Product Detail Empty ${marker}`,
    description: `Seeded empty product ${marker}`,
    product_group_id: groupId,
    unit: "piece",
    status: "blocked",
  });

  const location = await createWarehouseZoneBin(request, token, marker);
  const receivedQuantity = "7";

  await createReceiptStockMovement(request, token, stockedProduct.id, location.binId, receivedQuantity);

  return {
    marker,
    stockedProduct: { ...stockedProduct, groupName },
    emptyProduct: { ...emptyProduct, groupName },
    warehouseCode: location.warehouseCode,
    zoneCode: location.zoneCode,
    binCode: location.binCode,
    receivedQuantity,
  };
}

async function loginAndOpenProductDetail(page: Page, username: string, password: string, productId: number): Promise<void> {
  await page.goto("/login");
  await page.getByTestId("login-username").fill(username);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto(`/products/${productId}`);
  await expect(page).toHaveURL(new RegExp(`/products/${productId}$`));
  await expect(page.getByTestId("product-detail-page")).toBeVisible();
}

async function captureLayoutMetrics(page: Page): Promise<ProductDetailLayoutMetrics> {
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

    const panel = document.querySelector('[data-testid="product-detail-page"]');
    if (!panel) {
      throw new Error("Product detail panel not found");
    }

    const header = panel.querySelector(".panel-header");
    const actionsCell = header?.querySelector(".actions-cell") ?? null;
    const links = actionsCell ? Array.from(actionsCell.querySelectorAll("a.btn")) : [];
    const toListLink = links.find((link) => link.textContent?.includes("Zur Liste")) ?? null;
    const editLink = links.find((link) => link.textContent?.includes("Bearbeiten")) ?? null;
    const directChildren = Array.from(panel.children);
    const summaryCard = directChildren.find((child) => child.matches("article.subpanel")) ?? null;
    const twoColGrid = directChildren.find((child) => child.matches("div.two-col-grid")) ?? null;
    const inventoryCard = panel.querySelector('[data-testid="product-detail-inventory"]');
    const movementsCard = panel.querySelector('[data-testid="product-detail-movements"]');
    const firstInventoryItem = inventoryCard?.querySelector(".list-item") ?? null;
    const firstMovementItem = movementsCard?.querySelector(".list-item") ?? null;

    return {
      viewportWidth: window.innerWidth,
      htmlScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      isStackedLayout: window.matchMedia("(max-width: 900px)").matches,
      panel: rect(panel),
      header: header ? rect(header) : null,
      actionsCell: actionsCell ? rect(actionsCell) : null,
      toListLink: toListLink ? rect(toListLink) : null,
      editLink: editLink ? rect(editLink) : null,
      summaryCard: summaryCard ? rect(summaryCard) : null,
      twoColGrid: twoColGrid ? rect(twoColGrid) : null,
      inventoryCard: inventoryCard ? rect(inventoryCard) : null,
      movementsCard: movementsCard ? rect(movementsCard) : null,
      firstInventoryItem: firstInventoryItem ? rect(firstInventoryItem) : null,
      firstMovementItem: firstMovementItem ? rect(firstMovementItem) : null,
      actionsCellDisplay: actionsCell ? window.getComputedStyle(actionsCell).display : null,
    };
  });
}

test.describe("product detail page ui and functional regression", () => {
  test("functional: interactive elements are operable and data states are correct", async ({ page, request }) => {
    const errors = collectClientErrors(page);
    const user = await createE2EUserWithRoles(request, ["admin"]);
    const token = await loginApi(request, user.username, user.password);
    const seed = await seedProductDetailData(request, token);

    await loginAndOpenProductDetail(page, user.username, user.password, seed.stockedProduct.id);

    await expect(page.getByRole("heading", { name: "Produktdetails" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Zur Liste" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Bearbeiten" })).toBeVisible();

    const summaryCard = page.locator('[data-testid="product-detail-page"] > article.subpanel').first();
    await expect(summaryCard).toBeVisible();
    await expect(summaryCard).toContainText(seed.stockedProduct.productNumber);
    await expect(summaryCard).toContainText(seed.stockedProduct.name);
    await expect(summaryCard).toContainText(seed.stockedProduct.description);
    await expect(summaryCard).toContainText(`Einheit: piece`);
    await expect(summaryCard).toContainText(`Status: ${seed.stockedProduct.status}`);
    await expect(summaryCard).toContainText(`Gruppe: ${seed.stockedProduct.groupName}`);

    const inventoryPanel = page.getByTestId("product-detail-inventory");
    await expect(inventoryPanel).toBeVisible();
    await expect
      .poll(async () => await inventoryPanel.locator(".list-item").count(), { timeout: 20_000 })
      .toBeGreaterThan(0);
    await expect(inventoryPanel).toContainText(`${seed.warehouseCode} / ${seed.zoneCode} / ${seed.binCode}`);
    await expect(inventoryPanel).toContainText(new RegExp(`Menge:\\s*${seed.receivedQuantity}`));

    const movementPanel = page.getByTestId("product-detail-movements");
    await expect(movementPanel).toBeVisible();
    await expect
      .poll(async () => await movementPanel.locator(".list-item").count(), { timeout: 20_000 })
      .toBeGreaterThan(0);
    await expect(movementPanel).toContainText(/goods_receipt/i);
    await expect(movementPanel).toContainText(new RegExp(`goods_receipt\\s+${seed.receivedQuantity}`));

    await page.getByRole("link", { name: "Bearbeiten" }).click();
    await expect(page).toHaveURL(new RegExp(`/products/${seed.stockedProduct.id}/edit$`));
    await expect(page.getByTestId("product-form-page")).toBeVisible();
    await expect(page.getByRole("heading", { name: new RegExp(`Artikel bearbeiten #${seed.stockedProduct.id}`) })).toBeVisible();

    await page.goto(`/products/${seed.stockedProduct.id}`);
    await expect(page.getByTestId("product-detail-page")).toBeVisible();

    await page.getByRole("link", { name: "Zur Liste" }).click();
    await expect(page).toHaveURL(/\/products$/);
    await expect(page.getByTestId("products-page")).toBeVisible();

    await page.goto(`/products/${seed.emptyProduct.id}`);
    await expect(page.getByTestId("product-detail-page")).toBeVisible();
    await expect(page.getByTestId("product-detail-inventory")).toContainText("Kein Bestand vorhanden.");
    await expect(page.getByTestId("product-detail-movements")).toContainText("Keine Bewegungen.");

    await assertNoClientErrors(errors);
  });

  test("ui-formatting: cards, alignment and responsive layout are correct", async ({ page, request }, testInfo: TestInfo) => {
    const errors = collectClientErrors(page);
    const user = await createE2EUserWithRoles(request, ["admin"]);
    const token = await loginApi(request, user.username, user.password);
    const seed = await seedProductDetailData(request, token);

    await loginAndOpenProductDetail(page, user.username, user.password, seed.stockedProduct.id);

    await expect(page.getByTestId("product-detail-page")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Produktdetails" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Zur Liste" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Bearbeiten" })).toBeVisible();
    await expect(page.getByTestId("product-detail-inventory")).toBeVisible();
    await expect(page.getByTestId("product-detail-movements")).toBeVisible();
    await expect(page.locator('[data-testid="product-detail-page"] > article.subpanel').first()).toBeVisible();

    mkdirSync("output", { recursive: true });
    await page.screenshot({ path: `output/product-detail-page-${testInfo.project.name}.png`, fullPage: true });

    const metrics = await captureLayoutMetrics(page);

    expect(metrics.htmlScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);

    expect(metrics.panel.width).toBeGreaterThan(220);
    expect(metrics.header).not.toBeNull();
    expect(metrics.actionsCell).not.toBeNull();
    expect(metrics.toListLink).not.toBeNull();
    expect(metrics.editLink).not.toBeNull();
    expect(metrics.summaryCard).not.toBeNull();
    expect(metrics.twoColGrid).not.toBeNull();
    expect(metrics.inventoryCard).not.toBeNull();
    expect(metrics.movementsCard).not.toBeNull();

    expect(metrics.actionsCellDisplay).toBe("flex");
    expect(metrics.toListLink!.height).toBeGreaterThanOrEqual(36);
    expect(metrics.editLink!.height).toBeGreaterThanOrEqual(36);
    expect(intersects(metrics.toListLink!, metrics.editLink!)).toBe(false);

    expect(metrics.summaryCard!.left).toBeGreaterThanOrEqual(metrics.panel.left - 1);
    expect(metrics.summaryCard!.right).toBeLessThanOrEqual(metrics.panel.right + 1);
    expect(metrics.inventoryCard!.left).toBeGreaterThanOrEqual(metrics.panel.left - 1);
    expect(metrics.inventoryCard!.right).toBeLessThanOrEqual(metrics.panel.right + 1);
    expect(metrics.movementsCard!.left).toBeGreaterThanOrEqual(metrics.panel.left - 1);
    expect(metrics.movementsCard!.right).toBeLessThanOrEqual(metrics.panel.right + 1);

    if (metrics.isStackedLayout) {
      expect(metrics.movementsCard!.top).toBeGreaterThan(metrics.inventoryCard!.bottom - 1);
    } else {
      expect(Math.abs(metrics.inventoryCard!.top - metrics.movementsCard!.top)).toBeLessThanOrEqual(8);
    }

    if (metrics.firstInventoryItem) {
      expect(metrics.firstInventoryItem.right).toBeLessThanOrEqual(metrics.inventoryCard!.right + 1);
    }
    if (metrics.firstMovementItem) {
      expect(metrics.firstMovementItem.right).toBeLessThanOrEqual(metrics.movementsCard!.right + 1);
    }

    await assertNoClientErrors(errors);
  });
});
