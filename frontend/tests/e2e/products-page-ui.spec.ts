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
  status: "active" | "blocked";
  groupName: string;
};

type ProductsSeed = {
  marker: string;
  groupAName: string;
  groupBName: string;
  productActiveGroupA: SeededProduct;
  productBlockedGroupB: SeededProduct;
  productBlockedGroupA: SeededProduct;
  productDelete: SeededProduct;
};

type ProductsLayoutMetrics = {
  viewportWidth: number;
  htmlScrollWidth: number;
  bodyScrollWidth: number;
  isMobileLayout: boolean;
  panel: Rect;
  header: Rect | null;
  toolbar: Rect | null;
  searchInput: Rect | null;
  searchButton: Rect | null;
  statusFilter: Rect | null;
  groupFilter: Rect | null;
  tableWrap: Rect | null;
  table: Rect | null;
  pagination: Rect | null;
  paginationActions: Rect | null;
  rowDisplay: string | null;
  actionCellDisplay: string | null;
  actionButtons: Rect[];
};

type ProductCreatePayload = {
  product_number: string;
  name: string;
  description: string;
  product_group_id: number;
  unit: string;
  status: "active" | "blocked";
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
      description: `E2E products ui group ${groupName}`,
    },
  });
  expect(createResponse.ok()).toBeTruthy();
  const created = (await createResponse.json()) as { id: number };
  return created.id;
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
  payload: ProductCreatePayload
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
      status: payload.status,
      groupName: "",
    };
  }

  const created = (await createResponse.json()) as { id: number };
  return {
    id: created.id,
    productNumber: payload.product_number,
    name: payload.name,
    status: payload.status,
    groupName: "",
  };
}

async function seedProductsData(request: APIRequestContext, token: string): Promise<ProductsSeed> {
  const marker = `${Date.now()}${Math.floor(Math.random() * 10_000)
    .toString()
    .padStart(4, "0")}`;

  const groupAName = `E2E-PG-A-${marker}`;
  const groupBName = `E2E-PG-B-${marker}`;
  const groupAId = await ensureProductGroup(request, token, groupAName);
  const groupBId = await ensureProductGroup(request, token, groupBName);

  const productActiveGroupA = await createProductWithFallback(request, token, {
    product_number: `E2E-PROD-${marker}-A`,
    name: `E2E Active Group A ${marker}`,
    description: "Products UI regression test data",
    product_group_id: groupAId,
    unit: "piece",
    status: "active",
  });

  const productBlockedGroupB = await createProductWithFallback(request, token, {
    product_number: `E2E-PROD-${marker}-B`,
    name: `E2E Blocked Group B ${marker}`,
    description: "Products UI regression test data",
    product_group_id: groupBId,
    unit: "piece",
    status: "blocked",
  });

  const productBlockedGroupA = await createProductWithFallback(request, token, {
    product_number: `E2E-PROD-${marker}-C`,
    name: `E2E Blocked Group A ${marker}`,
    description: "Products UI regression test data",
    product_group_id: groupAId,
    unit: "piece",
    status: "blocked",
  });

  const productDelete = await createProductWithFallback(request, token, {
    product_number: `E2E-PROD-${marker}-DEL`,
    name: `E2E Delete Candidate ${marker}`,
    description: "Products UI regression delete candidate",
    product_group_id: groupAId,
    unit: "piece",
    status: "active",
  });

  return {
    marker,
    groupAName,
    groupBName,
    productActiveGroupA: { ...productActiveGroupA, groupName: groupAName },
    productBlockedGroupB: { ...productBlockedGroupB, groupName: groupBName },
    productBlockedGroupA: { ...productBlockedGroupA, groupName: groupAName },
    productDelete: { ...productDelete, groupName: groupAName },
  };
}

async function loginAndOpenProducts(page: Page, username: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByTestId("login-username").fill(username);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/products");
  await expect(page).toHaveURL(/\/products$/);
  await expect(page.getByTestId("products-page")).toBeVisible();
}

async function fillSearchAndSubmit(page: Page, value: string): Promise<void> {
  await page.getByTestId("products-search-input").fill(value);
  await page.getByTestId("products-search-btn").click();
}

async function captureProductsLayoutMetrics(page: Page): Promise<ProductsLayoutMetrics> {
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

    const panel = document.querySelector('[data-testid="products-page"]');
    if (!panel) {
      throw new Error("Products panel root not found.");
    }

    const header = panel.querySelector(".panel-header");
    const toolbar = panel.querySelector(".products-toolbar");
    const searchInput = panel.querySelector('[data-testid="products-search-input"]');
    const searchButton = panel.querySelector('[data-testid="products-search-btn"]');
    const statusFilter = panel.querySelector('[data-testid="products-status-filter"]');
    const groupFilter = panel.querySelector('[data-testid="products-group-filter"]');
    const tableWrap = panel.querySelector(".table-wrap");
    const table = panel.querySelector('[data-testid="products-table"]');
    const pagination = panel.querySelector(".pagination");
    const paginationActions = panel.querySelector(".pagination-actions");
    const firstRow = panel.querySelector('[data-testid="products-table"] tbody tr');
    const actionCell = firstRow?.querySelector("td.actions-cell") ?? null;
    const actionButtons = Array.from(panel.querySelectorAll('[data-testid="products-table"] tbody td.actions-cell .btn'));

    return {
      viewportWidth: window.innerWidth,
      htmlScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      isMobileLayout: window.matchMedia("(max-width: 768px)").matches,
      panel: rect(panel),
      header: header ? rect(header) : null,
      toolbar: toolbar ? rect(toolbar) : null,
      searchInput: searchInput ? rect(searchInput) : null,
      searchButton: searchButton ? rect(searchButton) : null,
      statusFilter: statusFilter ? rect(statusFilter) : null,
      groupFilter: groupFilter ? rect(groupFilter) : null,
      tableWrap: tableWrap ? rect(tableWrap) : null,
      table: table ? rect(table) : null,
      pagination: pagination ? rect(pagination) : null,
      paginationActions: paginationActions ? rect(paginationActions) : null,
      rowDisplay: firstRow ? getComputedStyle(firstRow).display : null,
      actionCellDisplay: actionCell ? getComputedStyle(actionCell).display : null,
      actionButtons: actionButtons.map((button) => rect(button)),
    };
  });
}

function parsePaginationValues(text: string): { page: number; totalPages: number; total: number } {
  const match = text.match(/Seite\s+(\d+)\s*\/\s*(\d+)\s*\((\d+)\s+Artikel\)/i);
  if (!match) {
    throw new Error(`Could not parse pagination text: "${text}"`);
  }
  return {
    page: Number(match[1]),
    totalPages: Number(match[2]),
    total: Number(match[3]),
  };
}

test.describe("products page ui and functional regression", () => {
  test("functional: all controls are operable and row actions work", async ({ page, request }) => {
    const errors = collectClientErrors(page);
    const user = await createE2EUserWithRoles(request, ["admin"]);
    const token = await loginApi(request, user.username, user.password);
    const seed = await seedProductsData(request, token);

    await loginAndOpenProducts(page, user.username, user.password);

    await expect(page.getByRole("heading", { name: "Artikelstamm" })).toBeVisible();
    await expect(page.getByTestId("products-create-btn")).toBeVisible();
    await expect(page.getByTestId("products-search-input")).toBeVisible();
    await expect(page.getByTestId("products-search-btn")).toBeVisible();
    await expect(page.getByTestId("products-status-filter")).toBeVisible();
    await expect(page.getByTestId("products-group-filter")).toBeVisible();
    await expect(page.getByTestId("products-table")).toBeVisible();

    await fillSearchAndSubmit(page, `E2E-PROD-${seed.marker}`);
    const table = page.getByTestId("products-table");
    await expect(table).toContainText(seed.productActiveGroupA.productNumber);
    await expect(table).toContainText(seed.productBlockedGroupB.productNumber);
    await expect(table).toContainText(seed.productBlockedGroupA.productNumber);
    await expect(table).toContainText(seed.productDelete.productNumber);

    await page.getByTestId("products-status-filter").selectOption("blocked");
    await expect(table).toContainText(seed.productBlockedGroupB.productNumber);
    await expect(table).toContainText(seed.productBlockedGroupA.productNumber);
    await expect(table).not.toContainText(seed.productActiveGroupA.productNumber);
    await expect(table).not.toContainText(seed.productDelete.productNumber);

    await page.getByTestId("products-group-filter").selectOption({ label: seed.groupAName });
    await expect(table).toContainText(seed.productBlockedGroupA.productNumber);
    await expect(table).not.toContainText(seed.productBlockedGroupB.productNumber);

    await page.getByTestId("products-status-filter").selectOption("");
    await expect(table).toContainText(seed.productActiveGroupA.productNumber);
    await expect(table).toContainText(seed.productBlockedGroupA.productNumber);
    await expect(table).toContainText(seed.productDelete.productNumber);
    await expect(table).not.toContainText(seed.productBlockedGroupB.productNumber);

    await page.getByTestId("products-group-filter").selectOption("");
    await fillSearchAndSubmit(page, seed.productActiveGroupA.productNumber);
    const detailRow = page.locator('[data-testid^="products-row-"]', { hasText: seed.productActiveGroupA.productNumber }).first();
    await expect(detailRow).toBeVisible();

    await detailRow.getByRole("link", { name: "Details" }).click();
    await expect(page).toHaveURL(/\/products\/\d+$/);
    await expect(page.getByTestId("product-detail-page")).toContainText(seed.productActiveGroupA.productNumber);
    await page.getByRole("link", { name: "Zur Liste" }).click();
    await expect(page).toHaveURL(/\/products$/);
    await expect(page.getByTestId("products-page")).toBeVisible();

    await fillSearchAndSubmit(page, seed.productActiveGroupA.productNumber);
    const editRow = page.locator('[data-testid^="products-row-"]', { hasText: seed.productActiveGroupA.productNumber }).first();
    await editRow.getByRole("link", { name: "Bearbeiten" }).click();
    await expect(page).toHaveURL(/\/products\/\d+\/edit$/);
    await expect(page.getByTestId("product-form-page")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Artikel bearbeiten/i })).toBeVisible();
    await page.getByRole("link", { name: "Zur Liste" }).click();
    await expect(page).toHaveURL(/\/products$/);

    await fillSearchAndSubmit(page, seed.productDelete.productNumber);
    const deleteRow = page.locator('[data-testid^="products-row-"]', { hasText: seed.productDelete.productNumber }).first();
    await expect(deleteRow).toBeVisible();
    await deleteRow.getByRole("button", { name: "Löschen" }).click();
    await expect(page.getByTestId("products-table")).not.toContainText(seed.productDelete.productNumber);

    await fillSearchAndSubmit(page, "");
    const pagination = page.locator(".pagination span").first();
    await expect(pagination).toBeVisible();
    const paginationText = ((await pagination.textContent()) ?? "").trim();
    const parsed = parsePaginationValues(paginationText);
    expect(parsed.page).toBe(1);

    const previousButton = page.getByRole("button", { name: "Zurück" });
    const nextButton = page.getByRole("button", { name: "Weiter" });
    await expect(previousButton).toBeDisabled();
    if (parsed.totalPages > 1) {
      await expect(nextButton).toBeEnabled();
      await nextButton.click();
      await expect(page.locator(".pagination span").first()).toContainText(/^Seite 2 \/ \d+ \(\d+ Artikel\)$/);
      await previousButton.click();
      await expect(page.locator(".pagination span").first()).toContainText(/^Seite 1 \/ \d+ \(\d+ Artikel\)$/);
    } else {
      await expect(nextButton).toBeDisabled();
    }

    await assertNoClientErrors(errors);
  });

  test("ui-formatting: products layout is visible, aligned and responsive without overlap", async ({ page, request }, testInfo) => {
    const errors = collectClientErrors(page);
    const user = await createE2EUserWithRoles(request, ["admin"]);
    const token = await loginApi(request, user.username, user.password);
    const seed = await seedProductsData(request, token);

    await loginAndOpenProducts(page, user.username, user.password);
    await fillSearchAndSubmit(page, `E2E-PROD-${seed.marker}`);

    await expect(page.getByRole("heading", { name: "Artikelstamm" })).toBeVisible();
    await expect(page.getByTestId("products-search-input")).toBeVisible();
    await expect(page.getByTestId("products-search-btn")).toBeVisible();
    await expect(page.getByTestId("products-status-filter")).toBeVisible();
    await expect(page.getByTestId("products-group-filter")).toBeVisible();
    await expect(page.getByTestId("products-table")).toBeVisible();

    mkdirSync("output", { recursive: true });
    await page.screenshot({ path: `output/products-page-${testInfo.project.name}.png`, fullPage: true });

    const metrics = await captureProductsLayoutMetrics(page);
    expect(metrics.htmlScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);

    expect(metrics.panel.width).toBeGreaterThan(220);
    expect(metrics.panel.left).toBeGreaterThanOrEqual(-1);
    expect(metrics.panel.right).toBeLessThanOrEqual(metrics.viewportWidth + 1);

    for (const [name, section] of [
      ["header", metrics.header],
      ["toolbar", metrics.toolbar],
      ["searchInput", metrics.searchInput],
      ["searchButton", metrics.searchButton],
      ["statusFilter", metrics.statusFilter],
      ["groupFilter", metrics.groupFilter],
      ["tableWrap", metrics.tableWrap],
      ["table", metrics.table],
      ["pagination", metrics.pagination],
      ["paginationActions", metrics.paginationActions],
    ] as const) {
      expect(section, `Missing section "${name}"`).not.toBeNull();
      if (!section) {
        continue;
      }
      expect(section.width, `Section "${name}" width`).toBeGreaterThan(72);
      expect(section.height, `Section "${name}" height`).toBeGreaterThan(20);
      expect(section.left, `Section "${name}" left boundary`).toBeGreaterThanOrEqual(metrics.panel.left - 1);
      expect(section.right, `Section "${name}" right boundary`).toBeLessThanOrEqual(metrics.panel.right + 1);
    }

    if (metrics.searchInput && metrics.searchButton) {
      expect(intersects(metrics.searchInput, metrics.searchButton)).toBeFalsy();
    }
    if (metrics.statusFilter && metrics.groupFilter) {
      expect(intersects(metrics.statusFilter, metrics.groupFilter)).toBeFalsy();
    }

    for (const actionButton of metrics.actionButtons) {
      expect(actionButton.width).toBeGreaterThan(52);
      expect(actionButton.height).toBeGreaterThan(28);
      expect(actionButton.left).toBeGreaterThanOrEqual(metrics.panel.left - 1);
      expect(actionButton.right).toBeLessThanOrEqual(metrics.panel.right + 1);
    }

    if (metrics.isMobileLayout) {
      expect(metrics.rowDisplay).toBe("grid");
    } else {
      expect(metrics.rowDisplay).toBe("table-row");
    }
    expect(metrics.actionCellDisplay).toBe("flex");

    await assertNoClientErrors(errors);
  });
});
