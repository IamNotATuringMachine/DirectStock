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

type ProductFormLayoutMetrics = {
  viewportWidth: number;
  htmlScrollWidth: number;
  bodyScrollWidth: number;
  isNarrowLayout: boolean;
  panel: Rect;
  header: Rect | null;
  tabStrip: Rect | null;
  form: Rect | null;
  toListLink: Rect | null;
  masterTabButton: Rect | null;
  warehouseTabButton: Rect | null;
  suppliersTabButton: Rect | null;
  productNumberInput: Rect | null;
  nameInput: Rect | null;
  descriptionInput: Rect | null;
  groupSelect: Rect | null;
  unitInput: Rect | null;
  statusSelect: Rect | null;
  submitButton: Rect | null;
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

async function ensureProductGroup(request: APIRequestContext, token: string, groupName: string): Promise<void> {
  const headers = { Authorization: `Bearer ${token}` };

  const listResponse = await request.get("/api/product-groups", { headers });
  expect(listResponse.ok()).toBeTruthy();
  const groups = (await listResponse.json()) as Array<{ id: number; name: string }>;
  if (groups.some((group) => group.name === groupName)) {
    return;
  }

  const createResponse = await request.post("/api/product-groups", {
    headers,
    data: {
      name: groupName,
      description: `E2E product-form group ${groupName}`,
    },
  });
  if (!createResponse.ok()) {
    expect(createResponse.status()).toBe(409);
  }
}

async function loginAndOpenProductCreatePage(page: Page, username: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByTestId("login-username").fill(username);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/products/new");
  await expect(page).toHaveURL(/\/products\/new$/);
  await expect(page.getByTestId("product-form-page")).toBeVisible();
}

async function fillAndSubmitProductCreateForm(page: Page, params: {
  productNumber: string;
  productName: string;
  productDescription: string;
  groupName: string;
}): Promise<void> {
  await page.getByTestId("product-form-number").fill(params.productNumber);
  await page.getByTestId("product-form-name").fill(params.productName);
  await page.getByTestId("product-form-description").fill(params.productDescription);
  await page.getByTestId("product-form-group").selectOption({ label: params.groupName });
  await page.getByTestId("product-form-unit").fill("piece");
  await page.getByTestId("product-form-status").selectOption("blocked");
  await page.getByTestId("product-form-submit").click();
}

async function captureLayoutMetrics(page: Page): Promise<ProductFormLayoutMetrics> {
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

    const panel = document.querySelector('[data-testid="product-form-page"]');
    if (!panel) {
      throw new Error("Product form panel not found");
    }

    const header = panel.querySelector(".panel-header");
    const tabStrip = panel.querySelector(".tab-strip");
    const form = panel.querySelector("form.form-grid");
    const toListLink = Array.from(panel.querySelectorAll("a.btn")).find((link) =>
      link.textContent?.includes("Zur Liste")
    );
    const masterTabButton = Array.from(panel.querySelectorAll("button.btn")).find((button) =>
      button.textContent?.includes("Stammdaten")
    );
    const warehouseTabButton = Array.from(panel.querySelectorAll("button.btn")).find((button) =>
      button.textContent?.includes("Lagerdaten")
    );
    const suppliersTabButton = Array.from(panel.querySelectorAll("button.btn")).find((button) =>
      button.textContent?.includes("Lieferanten")
    );
    const productNumberInput = panel.querySelector('[data-testid="product-form-number"]');
    const nameInput = panel.querySelector('[data-testid="product-form-name"]');
    const descriptionInput = panel.querySelector('[data-testid="product-form-description"]');
    const groupSelect = panel.querySelector('[data-testid="product-form-group"]');
    const unitInput = panel.querySelector('[data-testid="product-form-unit"]');
    const statusSelect = panel.querySelector('[data-testid="product-form-status"]');
    const submitButton = panel.querySelector('[data-testid="product-form-submit"]');

    return {
      viewportWidth: window.innerWidth,
      htmlScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      isNarrowLayout: window.matchMedia("(max-width: 768px)").matches,
      panel: rect(panel),
      header: header ? rect(header) : null,
      tabStrip: tabStrip ? rect(tabStrip) : null,
      form: form ? rect(form) : null,
      toListLink: toListLink ? rect(toListLink) : null,
      masterTabButton: masterTabButton ? rect(masterTabButton) : null,
      warehouseTabButton: warehouseTabButton ? rect(warehouseTabButton) : null,
      suppliersTabButton: suppliersTabButton ? rect(suppliersTabButton) : null,
      productNumberInput: productNumberInput ? rect(productNumberInput) : null,
      nameInput: nameInput ? rect(nameInput) : null,
      descriptionInput: descriptionInput ? rect(descriptionInput) : null,
      groupSelect: groupSelect ? rect(groupSelect) : null,
      unitInput: unitInput ? rect(unitInput) : null,
      statusSelect: statusSelect ? rect(statusSelect) : null,
      submitButton: submitButton ? rect(submitButton) : null,
    };
  });
}

test.describe("product form create page ui and functional regression", () => {
  test("functional: create success dialog -> no navigates to products list", async ({ page, request }) => {
    const errors = collectClientErrors(page);
    const user = await createE2EUserWithRoles(request, ["admin"]);
    const token = await loginApi(request, user.username, user.password);
    const marker = `${Date.now()}${Math.floor(Math.random() * 10_000)
      .toString()
      .padStart(4, "0")}`;
    const groupName = `E2E-PF-GROUP-${marker}`;
    await ensureProductGroup(request, token, groupName);

    await loginAndOpenProductCreatePage(page, user.username, user.password);

    await expect(page.getByRole("heading", { name: "Neuer Artikel" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Zur Liste" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Stammdaten" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Lagerdaten" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Lieferanten" })).toBeVisible();
    await expect(page.getByTestId("product-form-number")).toBeVisible();
    await expect(page.getByTestId("product-form-name")).toBeVisible();
    await expect(page.getByTestId("product-form-description")).toBeVisible();
    await expect(page.getByTestId("product-form-group")).toBeVisible();
    await expect(page.getByTestId("product-form-unit")).toBeVisible();
    await expect(page.getByTestId("product-form-status")).toBeVisible();
    await expect(page.getByTestId("product-form-submit")).toBeVisible();

    await page.getByRole("button", { name: "Lagerdaten" }).click();
    await expect(page.getByTestId("product-form-warehouse-tab")).toBeVisible();
    await expect(page.getByText("Bitte zuerst den Artikel anlegen, um Lagerdaten je Standort zu pflegen.")).toBeVisible();

    await page.getByRole("button", { name: "Lieferanten" }).click();
    await expect(page.getByTestId("product-form-suppliers-tab")).toBeVisible();
    await expect(page.getByText("Bitte zuerst den Artikel anlegen, um Lieferanten zuzuordnen.")).toBeVisible();

    await page.getByRole("button", { name: "Stammdaten" }).click();
    await expect(page.getByTestId("product-form-number")).toBeVisible();

    const productNumber = `E2E-PF-${marker}`;
    const productName = `E2E Product Form ${marker}`;
    const productDescription = `Generated by playwright ${marker}`;

    await fillAndSubmitProductCreateForm(page, {
      productNumber,
      productName,
      productDescription,
      groupName,
    });

    await expect(page.getByTestId("product-create-success-dialog")).toBeVisible();
    await expect(page.getByTestId("product-create-success-dialog")).toContainText("Artikel erfolgreich angelegt");
    await expect(page.getByTestId("product-create-success-dialog")).toContainText("Möchten Sie einen weiteren Artikel hinzufügen?");
    await page.getByTestId("product-create-success-no-btn").click();
    await expect(page).toHaveURL(/\/products$/);
    await expect(page.getByRole("heading", { name: /Artikelstamm/i })).toBeVisible();

    await assertNoClientErrors(errors);
  });

  test("functional: create success dialog -> yes keeps user on new form and resets fields", async ({ page, request }) => {
    const errors = collectClientErrors(page);
    const user = await createE2EUserWithRoles(request, ["admin"]);
    const token = await loginApi(request, user.username, user.password);
    const marker = `${Date.now()}${Math.floor(Math.random() * 10_000)
      .toString()
      .padStart(4, "0")}`;
    const groupName = `E2E-PF-GROUP-${marker}`;
    await ensureProductGroup(request, token, groupName);

    await loginAndOpenProductCreatePage(page, user.username, user.password);

    const productNumber = `E2E-PF-${marker}`;
    const productName = `E2E Product Form ${marker}`;
    const productDescription = `Generated by playwright ${marker}`;

    await fillAndSubmitProductCreateForm(page, {
      productNumber,
      productName,
      productDescription,
      groupName,
    });

    await expect(page.getByTestId("product-create-success-dialog")).toBeVisible();
    await page.getByTestId("product-create-success-yes-btn").click();
    await expect(page).toHaveURL(/\/products\/new$/);
    await expect(page.getByRole("heading", { name: "Neuer Artikel" })).toBeVisible();
    await expect(page.getByTestId("product-form-number")).toHaveValue("");
    await expect(page.getByTestId("product-form-name")).toHaveValue("");
    await expect(page.getByTestId("product-form-description")).toHaveValue("");
    await expect(page.getByTestId("product-form-unit")).toHaveValue("Stück");
    await expect(page.getByTestId("product-form-status")).toHaveValue("active");
    await expect(page.getByTestId("product-form-group")).toHaveValue("");

    await assertNoClientErrors(errors);
  });

  test("ui-formatting: product form layout is visible, aligned and responsive", async ({ page, request }, testInfo: TestInfo) => {
    const errors = collectClientErrors(page);
    const user = await createE2EUserWithRoles(request, ["admin"]);

    await loginAndOpenProductCreatePage(page, user.username, user.password);

    await expect(page.getByTestId("product-form-page")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Neuer Artikel" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Zur Liste" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Stammdaten" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Lagerdaten" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Lieferanten" })).toBeVisible();

    mkdirSync("output", { recursive: true });
    await page.screenshot({ path: `output/product-form-page-${testInfo.project.name}.png`, fullPage: true });

    const metrics = await captureLayoutMetrics(page);

    expect(metrics.htmlScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);

    expect(metrics.panel.width).toBeGreaterThan(220);
    expect(metrics.panel.left).toBeGreaterThanOrEqual(-1);
    expect(metrics.panel.right).toBeLessThanOrEqual(metrics.viewportWidth + 1);

    for (const [name, section] of [
      ["header", metrics.header],
      ["tabStrip", metrics.tabStrip],
      ["form", metrics.form],
      ["toListLink", metrics.toListLink],
      ["masterTabButton", metrics.masterTabButton],
      ["warehouseTabButton", metrics.warehouseTabButton],
      ["suppliersTabButton", metrics.suppliersTabButton],
      ["productNumberInput", metrics.productNumberInput],
      ["nameInput", metrics.nameInput],
      ["descriptionInput", metrics.descriptionInput],
      ["groupSelect", metrics.groupSelect],
      ["unitInput", metrics.unitInput],
      ["statusSelect", metrics.statusSelect],
      ["submitButton", metrics.submitButton],
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

    if (metrics.toListLink && metrics.masterTabButton) {
      expect(intersects(metrics.toListLink, metrics.masterTabButton)).toBeFalsy();
    }
    if (metrics.masterTabButton && metrics.warehouseTabButton) {
      expect(intersects(metrics.masterTabButton, metrics.warehouseTabButton)).toBeFalsy();
    }
    if (metrics.warehouseTabButton && metrics.suppliersTabButton) {
      expect(intersects(metrics.warehouseTabButton, metrics.suppliersTabButton)).toBeFalsy();
    }
    if (metrics.unitInput && metrics.statusSelect) {
      expect(intersects(metrics.unitInput, metrics.statusSelect)).toBeFalsy();
      if (metrics.isNarrowLayout) {
        expect(metrics.statusSelect.top).toBeGreaterThanOrEqual(metrics.unitInput.bottom - 1);
      }
    }

    await assertNoClientErrors(errors);
  });
});
