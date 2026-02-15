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

type BaseLayoutMetrics = {
  viewportWidth: number;
  htmlScrollWidth: number;
  bodyScrollWidth: number;
  isNarrowLayout: boolean;
  splitGridColumns: number;
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
      description: `E2E edit-form group ${groupName}`,
    },
  });

  if (createResponse.ok()) {
    const payload = (await createResponse.json()) as { id: number };
    return payload.id;
  }

  expect(createResponse.status()).toBe(409);
  const refreshResponse = await request.get("/api/product-groups", { headers });
  expect(refreshResponse.ok()).toBeTruthy();
  const refreshed = (await refreshResponse.json()) as Array<{ id: number; name: string }>;
  const refreshedMatch = refreshed.find((group) => group.name === groupName);
  expect(refreshedMatch).toBeTruthy();
  return refreshedMatch!.id;
}

async function createProductForEdit(
  request: APIRequestContext,
  token: string,
  productNumber: string,
  groupId: number,
): Promise<{ id: number; product_number: string }> {
  const response = await request.post("/api/products", {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      product_number: productNumber,
      name: `E2E Edit Product ${productNumber}`,
      description: `Initial description ${productNumber}`,
      product_group_id: groupId,
      unit: "piece",
      status: "active",
    },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as { id: number; product_number: string };
}

async function createWarehouseForEdit(
  request: APIRequestContext,
  token: string,
  marker: string,
): Promise<{ id: number; code: string; name: string }> {
  const headers = { Authorization: `Bearer ${token}` };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = `${marker.slice(-6)}${attempt}`;
    const code = `E2EPF${suffix}`;
    const response = await request.post("/api/warehouses", {
      headers,
      data: {
        code,
        name: `E2E ProductForm Warehouse ${suffix}`,
        is_active: true,
      },
    });

    if (response.ok()) {
      return (await response.json()) as { id: number; code: string; name: string };
    }

    expect(response.status()).toBe(409);
  }

  throw new Error("Failed to create unique warehouse for edit page test");
}

async function createSupplierForEdit(
  request: APIRequestContext,
  token: string,
  marker: string,
): Promise<{ id: number; supplier_number: string; company_name: string }> {
  const headers = { Authorization: `Bearer ${token}` };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = `${marker.slice(-6)}${attempt}`;
    const supplierNumber = `E2ESUP${suffix}`;
    const response = await request.post("/api/suppliers", {
      headers,
      data: {
        supplier_number: supplierNumber,
        company_name: `E2E Supplier ${suffix}`,
        contact_name: "Playwright Contact",
        email: `e2e-supplier-${suffix}@example.com`,
        is_active: true,
      },
    });

    if (response.ok()) {
      return (await response.json()) as { id: number; supplier_number: string; company_name: string };
    }

    expect(response.status()).toBe(409);
  }

  throw new Error("Failed to create unique supplier for edit page test");
}

async function loginAndOpenProductEditPage(
  page: Page,
  username: string,
  password: string,
  productId: number,
): Promise<void> {
  await page.goto("/login");
  await page.getByTestId("login-username").fill(username);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto(`/products/${productId}/edit`);
  await expect(page).toHaveURL(new RegExp(`/products/${productId}/edit$`));
  await expect(page.getByTestId("product-form-page")).toBeVisible();
  await expect(page.getByRole("heading", { name: new RegExp(`Artikel bearbeiten #${productId}`) })).toBeVisible();
}

async function rectOf(locator: ReturnType<Page["locator"]>, name: string): Promise<Rect> {
  const box = await locator.boundingBox();
  expect(box, `Missing bounding box for ${name}`).toBeTruthy();
  if (!box) {
    throw new Error(`Missing bounding box for ${name}`);
  }
  return {
    top: box.y,
    left: box.x,
    right: box.x + box.width,
    bottom: box.y + box.height,
    width: box.width,
    height: box.height,
  };
}

async function captureBaseLayoutMetrics(page: Page): Promise<BaseLayoutMetrics> {
  return page.evaluate(() => {
    const splitGrid = document.querySelector('[data-testid="product-form-page"] .split-grid');
    const splitGridTemplate = splitGrid ? getComputedStyle(splitGrid).gridTemplateColumns : "";
    const splitGridColumns = splitGridTemplate
      ? splitGridTemplate
          .split(" ")
          .map((chunk) => chunk.trim())
          .filter(Boolean).length
      : 0;

    return {
      viewportWidth: window.innerWidth,
      htmlScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      isNarrowLayout: window.matchMedia("(max-width: 768px)").matches,
      splitGridColumns,
    };
  });
}

test.describe("product form edit page ui and functional regression", () => {
  test("functional: edit master data, warehouse settings and supplier relations", async ({ page, request }) => {
    const errors = collectClientErrors(page);
    const user = await createE2EUserWithRoles(request, ["admin"]);
    const token = await loginApi(request, user.username, user.password);
    const marker = `${Date.now()}${Math.floor(Math.random() * 10_000)
      .toString()
      .padStart(4, "0")}`;

    const groupName = `E2E-PF-EDIT-GROUP-${marker}`;
    const groupId = await ensureProductGroup(request, token, groupName);
    const createdProduct = await createProductForEdit(request, token, `E2E-PF-EDIT-${marker}`, groupId);
    const warehouse = await createWarehouseForEdit(request, token, marker);
    const supplier = await createSupplierForEdit(request, token, marker);

    await loginAndOpenProductEditPage(page, user.username, user.password, createdProduct.id);

    await expect(page.getByRole("link", { name: "Zur Liste" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Zur Detailseite" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Stammdaten" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Lagerdaten" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Lieferanten" })).toBeVisible();
    await expect(page.getByTestId("product-form-number")).toHaveValue(createdProduct.product_number);
    await expect(page.getByTestId("product-form-number")).toBeDisabled();

    const updatedName = `Updated Name ${marker}`;
    const updatedDescription = `Updated Description ${marker}`;

    await page.getByTestId("product-form-name").fill(updatedName);
    await page.getByTestId("product-form-description").fill(updatedDescription);
    await page.getByTestId("product-form-status").selectOption("blocked");
    await page.getByTestId("product-form-submit").click();

    await expect(page).toHaveURL(new RegExp(`/products/${createdProduct.id}$`));
    await expect(page.getByText(updatedName)).toBeVisible();
    await page.getByRole("link", { name: "Bearbeiten" }).click();
    await expect(page).toHaveURL(new RegExp(`/products/${createdProduct.id}/edit$`));

    await page.getByRole("button", { name: "Lagerdaten" }).click();
    await expect(page.getByTestId("product-form-warehouse-tab")).toBeVisible();

    const warehouseCard = page.getByTestId(`product-warehouse-setting-${warehouse.id}`);
    await expect(warehouseCard).toBeVisible();

    const ean = `4006381333${marker.slice(-3)}`;
    await warehouseCard.getByLabel("EAN").fill(ean);
    await warehouseCard.getByLabel("Lead Time (Tage)").fill("4");
    await warehouseCard.getByLabel("Mindestbestand").fill("7.500");
    await warehouseCard.getByLabel("Meldebestand").fill("9.000");
    await warehouseCard.getByLabel("Maximalbestand").fill("15.000");
    await warehouseCard.getByLabel("Sicherheitsbestand").fill("2.500");

    await page.getByTestId(`product-warehouse-save-${warehouse.id}`).click();

    await expect(warehouseCard.getByLabel("EAN")).toHaveValue(ean);
    await expect(warehouseCard.getByLabel("Lead Time (Tage)")).toHaveValue("4");
    await expect(warehouseCard.getByLabel("Mindestbestand")).toHaveValue("7.500");
    await expect(warehouseCard.getByLabel("Meldebestand")).toHaveValue("9.000");

    await page.getByTestId(`product-warehouse-clear-${warehouse.id}`).click();
    await expect(warehouseCard.getByLabel("EAN")).toHaveValue("");
    await expect(warehouseCard.getByLabel("Lead Time (Tage)")).toHaveValue("");

    await page.getByRole("button", { name: "Lieferanten" }).click();
    await expect(page.getByTestId("product-form-suppliers-tab")).toBeVisible();
    await expect(page.getByTestId("product-supplier-form")).toBeVisible();

    await page.getByTestId("product-supplier-select").selectOption(String(supplier.id));
    await page.getByTestId("product-supplier-product-number").fill(`SUP-PROD-${marker.slice(-5)}`);
    await page.getByTestId("product-supplier-price").fill("12.34");
    await page.getByTestId("product-supplier-lead-time").fill("5");
    await page.getByTestId("product-supplier-min-order").fill("3.250");
    await page.getByTestId("product-supplier-preferred").check();
    await page.getByTestId("product-supplier-add-btn").click();

    const relation = page.locator('[data-testid^="product-supplier-relation-"]').first();
    await expect(relation).toContainText(supplier.supplier_number);
    await expect(relation).toContainText("Preferred: ja");

    const togglePreferredButton = relation.locator('[data-testid^="product-supplier-toggle-preferred-"]');
    await togglePreferredButton.click();
    await expect(relation).toContainText("Preferred: nein");

    const removeButton = relation.locator('[data-testid^="product-supplier-delete-"]');
    await removeButton.click();
    await expect(page.getByText("Noch keine Lieferanten zugeordnet.")).toBeVisible();

    await page.getByRole("link", { name: "Zur Detailseite" }).click();
    await expect(page).toHaveURL(new RegExp(`/products/${createdProduct.id}$`));
    await page.getByRole("link", { name: "Bearbeiten" }).click();
    await expect(page).toHaveURL(new RegExp(`/products/${createdProduct.id}/edit$`));

    await assertNoClientErrors(errors);
  });

  test("ui-formatting: product edit layout is visible, aligned and responsive", async ({ page, request }, testInfo: TestInfo) => {
    const errors = collectClientErrors(page);
    const user = await createE2EUserWithRoles(request, ["admin"]);
    const token = await loginApi(request, user.username, user.password);
    const marker = `${Date.now()}${Math.floor(Math.random() * 10_000)
      .toString()
      .padStart(4, "0")}`;

    const groupId = await ensureProductGroup(request, token, `E2E-PF-EDIT-GROUP-${marker}`);
    const product = await createProductForEdit(request, token, `E2E-PF-EDIT-${marker}`, groupId);
    const warehouse = await createWarehouseForEdit(request, token, marker);
    await createSupplierForEdit(request, token, marker);

    await loginAndOpenProductEditPage(page, user.username, user.password, product.id);

    mkdirSync("output", { recursive: true });
    await page.screenshot({ path: `output/product-form-edit-page-master-${testInfo.project.name}.png` });

    const panel = page.getByTestId("product-form-page");
    const header = panel.locator(".panel-header");
    const tabStrip = panel.locator(".tab-strip");
    const form = panel.locator("form.form-grid").first();
    const toListLink = page.getByRole("link", { name: "Zur Liste" });
    const toDetailLink = page.getByRole("link", { name: "Zur Detailseite" });
    const masterTabButton = page.getByRole("button", { name: "Stammdaten" });
    const warehouseTabButton = page.getByRole("button", { name: "Lagerdaten" });
    const suppliersTabButton = page.getByRole("button", { name: "Lieferanten" });
    const productNumberInput = page.getByTestId("product-form-number");
    const nameInput = page.getByTestId("product-form-name");
    const descriptionInput = page.getByTestId("product-form-description");
    const groupSelect = page.getByTestId("product-form-group");
    const unitInput = page.getByTestId("product-form-unit");
    const statusSelect = page.getByTestId("product-form-status");
    const submitButton = page.getByTestId("product-form-submit");

    for (const locator of [
      panel,
      header,
      tabStrip,
      form,
      toListLink,
      toDetailLink,
      masterTabButton,
      warehouseTabButton,
      suppliersTabButton,
      productNumberInput,
      nameInput,
      descriptionInput,
      groupSelect,
      unitInput,
      statusSelect,
      submitButton,
    ]) {
      await expect(locator).toBeVisible();
    }

    const metrics = await captureBaseLayoutMetrics(page);
    expect(metrics.htmlScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);

    if (metrics.isNarrowLayout) {
      expect(metrics.splitGridColumns).toBe(1);
    } else {
      expect(metrics.splitGridColumns).toBeGreaterThanOrEqual(2);
    }

    const panelRect = await rectOf(panel, "panel");
    const headerRect = await rectOf(header, "header");
    const tabStripRect = await rectOf(tabStrip, "tabStrip");
    const formRect = await rectOf(form, "form");
    const toListLinkRect = await rectOf(toListLink, "toListLink");
    const toDetailLinkRect = await rectOf(toDetailLink, "toDetailLink");
    const masterTabButtonRect = await rectOf(masterTabButton, "masterTabButton");
    const warehouseTabButtonRect = await rectOf(warehouseTabButton, "warehouseTabButton");
    const suppliersTabButtonRect = await rectOf(suppliersTabButton, "suppliersTabButton");
    const unitInputRect = await rectOf(unitInput, "unitInput");
    const statusSelectRect = await rectOf(statusSelect, "statusSelect");

    for (const [name, rect] of [
      ["header", headerRect],
      ["tabStrip", tabStripRect],
      ["form", formRect],
      ["toListLink", toListLinkRect],
      ["toDetailLink", toDetailLinkRect],
      ["masterTabButton", masterTabButtonRect],
      ["warehouseTabButton", warehouseTabButtonRect],
      ["suppliersTabButton", suppliersTabButtonRect],
      ["unitInput", unitInputRect],
      ["statusSelect", statusSelectRect],
    ] as const) {
      expect(rect.width, `${name} width`).toBeGreaterThan(60);
      expect(rect.height, `${name} height`).toBeGreaterThan(20);
      expect(rect.left, `${name} left bound`).toBeGreaterThanOrEqual(panelRect.left - 1);
      expect(rect.right, `${name} right bound`).toBeLessThanOrEqual(panelRect.right + 1);
    }

    expect(intersects(toListLinkRect, toDetailLinkRect)).toBeFalsy();
    expect(intersects(masterTabButtonRect, warehouseTabButtonRect)).toBeFalsy();
    expect(intersects(warehouseTabButtonRect, suppliersTabButtonRect)).toBeFalsy();
    expect(intersects(unitInputRect, statusSelectRect)).toBeFalsy();

    await page.getByRole("button", { name: "Lagerdaten" }).click();
    await expect(page.getByTestId("product-form-warehouse-tab")).toBeVisible();
    const warehouseCard = page.getByTestId(`product-warehouse-setting-${warehouse.id}`);
    await expect(warehouseCard).toBeVisible();
    await page.screenshot({ path: `output/product-form-edit-page-warehouse-${testInfo.project.name}.png` });

    const warehouseTabRect = await rectOf(page.getByTestId("product-form-warehouse-tab"), "warehouseTab");
    const warehouseCardRect = await rectOf(warehouseCard, "warehouseCard");
    expect(warehouseTabRect.left).toBeGreaterThanOrEqual(panelRect.left - 1);
    expect(warehouseTabRect.right).toBeLessThanOrEqual(panelRect.right + 1);
    expect(warehouseCardRect.left).toBeGreaterThanOrEqual(warehouseTabRect.left - 1);
    expect(warehouseCardRect.right).toBeLessThanOrEqual(warehouseTabRect.right + 1);

    await page.getByRole("button", { name: "Lieferanten" }).click();
    await expect(page.getByTestId("product-form-suppliers-tab")).toBeVisible();
    await expect(page.getByTestId("product-supplier-form")).toBeVisible();
    await page.screenshot({ path: `output/product-form-edit-page-suppliers-${testInfo.project.name}.png` });

    const suppliersTabRect = await rectOf(page.getByTestId("product-form-suppliers-tab"), "suppliersTab");
    const supplierFormRect = await rectOf(page.getByTestId("product-supplier-form"), "supplierForm");
    expect(suppliersTabRect.left).toBeGreaterThanOrEqual(panelRect.left - 1);
    expect(suppliersTabRect.right).toBeLessThanOrEqual(panelRect.right + 1);
    expect(supplierFormRect.left).toBeGreaterThanOrEqual(suppliersTabRect.left - 1);
    expect(supplierFormRect.right).toBeLessThanOrEqual(suppliersTabRect.right + 1);

    await assertNoClientErrors(errors);
  });
});
