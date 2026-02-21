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

type SeedData = {
  productNumber: string;
  warehouseId: number;
  token: string;
};

type InventoryCountLayoutMetrics = {
  viewportWidth: number;
  htmlScrollWidth: number;
  bodyScrollWidth: number;
  panel: Rect;
  panelHeader: Rect | null;
  warehouseGrid: Rect | null;
  warehouseGridColumns: number;
  createForm: Rect | null;
  typeSelect: Rect | null;
  warehouseSelect: Rect | null;
  toleranceInput: Rect | null;
  notesInput: Rect | null;
  createButton: Rect | null;
  sessionList: Rect | null;
  sessionListClientHeight: number;
  sessionListScrollHeight: number;
  sessionListOverflowY: string | null;
  selectedSession: Rect | null;
  sessionActions: Rect | null;
  generateButton: Rect | null;
  regenerateButton: Rect | null;
  completeButton: Rect | null;
  summaryGrid: Rect | null;
  summaryCards: Rect[];
  scanToolbar: Rect | null;
  scanBinInput: Rect | null;
  scanProductInput: Rect | null;
  quickCapture: Rect | null;
  quickQuantityInput: Rect | null;
  quickSaveButton: Rect | null;
  tableWrap: Rect | null;
  table: Rect | null;
  firstRow: Rect | null;
  firstRowDisplay: string | null;
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

async function loginAndOpenInventoryCounts(page: Page, username: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByTestId("login-username").fill(username);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/inventory-counts");
  await expect(page).toHaveURL(/\/inventory-counts$/);
  await expect(page.getByTestId("inventory-count-page")).toBeVisible();
}

async function seedInventoryCountData(
  request: APIRequestContext,
  username: string,
  password: string
): Promise<SeedData> {
  const token = await loginApi(request, username, password);
  const marker = `E2E-IC-UI-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
  const seeded = await ensureE2EInventoryStock(request, token, marker);
  return {
    productNumber: seeded.productNumber,
    warehouseId: seeded.warehouseId,
    token,
  };
}

async function countAllSessionItemsViaApi(
  request: APIRequestContext,
  token: string,
  sessionId: number
): Promise<void> {
  const headers = { Authorization: `Bearer ${token}` };
  const listItemsResponse = await request.get(`/api/inventory-counts/${sessionId}/items`, { headers });
  expect(listItemsResponse.ok()).toBeTruthy();
  const items = (await listItemsResponse.json()) as Array<{ id: number; snapshot_quantity: string }>;
  expect(items.length).toBeGreaterThan(0);

  for (const item of items) {
    const updateResponse = await request.put(`/api/inventory-counts/${sessionId}/items/${item.id}`, {
      headers,
      data: {
        counted_quantity: item.snapshot_quantity,
      },
    });
    expect(updateResponse.ok()).toBeTruthy();
  }
}

function parseSessionId(testId: string | null): number {
  const match = testId?.match(/^inventory-count-session-(\d+)$/);
  if (!match) {
    throw new Error(`Could not parse session id from test id "${testId ?? "null"}".`);
  }
  return Number(match[1]);
}

async function captureLayoutMetrics(page: Page): Promise<InventoryCountLayoutMetrics> {
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

    const panel = document.querySelector('[data-testid="inventory-count-page"]');
    if (!panel) {
      throw new Error("Inventory count page root not found.");
    }

    const panelHeader = panel.querySelector(".panel-header");
    const warehouseGrid = panel.querySelector(".warehouse-grid");
    const createForm = panel.querySelector('[data-testid="inventory-count-create-form"]');
    const typeSelect = panel.querySelector('[data-testid="inventory-count-type-select"]');
    const warehouseSelect = panel.querySelector('[data-testid="inventory-count-warehouse-select"]');
    const toleranceInput = panel.querySelector('[data-testid="inventory-count-tolerance-input"]');
    const notesInput = panel.querySelector('[data-testid="inventory-count-notes-input"]');
    const createButton = panel.querySelector('[data-testid="inventory-count-create-btn"]');
    const sessionList = panel.querySelector('[data-testid="inventory-count-session-list"]');
    const selectedSession = panel.querySelector('[data-testid="inventory-count-selected-session"]');
    const sessionActions = panel.querySelector('[data-testid="inventory-count-generate-btn"]')?.parentElement ?? null;
    const generateButton = panel.querySelector('[data-testid="inventory-count-generate-btn"]');
    const regenerateButton = panel.querySelector('[data-testid="inventory-count-regenerate-btn"]');
    const completeButton = panel.querySelector('[data-testid="inventory-count-complete-btn"]');
    const summaryGrid = panel.querySelector(".kpi-grid.compact");
    const summaryCards = Array.from(panel.querySelectorAll(".kpi-grid.compact .kpi-card"));
    const scanToolbar = panel.querySelector(".products-toolbar");
    const scanBinInput = panel.querySelector('[data-testid="inventory-count-scan-bin-input"]');
    const scanProductInput = panel.querySelector('[data-testid="inventory-count-scan-product-input"]');
    const quickCapture = panel.querySelector('[data-testid="inventory-count-quick-capture"]');
    const quickQuantityInput = panel.querySelector('[data-testid="inventory-count-quick-quantity-input"]');
    const quickSaveButton = panel.querySelector('[data-testid="inventory-count-quick-save-btn"]');
    const tableWrap = panel.querySelector(".table-wrap");
    const table = panel.querySelector('[data-testid="inventory-count-items-table"]');
    const firstRow = panel.querySelector('[data-testid^="inventory-count-item-row-"]');

    const warehouseGridColumns = warehouseGrid
      ? getComputedStyle(warehouseGrid)
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
      warehouseGrid: warehouseGrid ? rect(warehouseGrid) : null,
      warehouseGridColumns,
      createForm: createForm ? rect(createForm) : null,
      typeSelect: typeSelect ? rect(typeSelect) : null,
      warehouseSelect: warehouseSelect ? rect(warehouseSelect) : null,
      toleranceInput: toleranceInput ? rect(toleranceInput) : null,
      notesInput: notesInput ? rect(notesInput) : null,
      createButton: createButton ? rect(createButton) : null,
      sessionList: sessionList ? rect(sessionList) : null,
      sessionListClientHeight: sessionList ? (sessionList as HTMLElement).clientHeight : 0,
      sessionListScrollHeight: sessionList ? (sessionList as HTMLElement).scrollHeight : 0,
      sessionListOverflowY: sessionList ? getComputedStyle(sessionList).overflowY : null,
      selectedSession: selectedSession ? rect(selectedSession) : null,
      sessionActions: sessionActions ? rect(sessionActions) : null,
      generateButton: generateButton ? rect(generateButton) : null,
      regenerateButton: regenerateButton ? rect(regenerateButton) : null,
      completeButton: completeButton ? rect(completeButton) : null,
      summaryGrid: summaryGrid ? rect(summaryGrid) : null,
      summaryCards: summaryCards.map((card) => rect(card)),
      scanToolbar: scanToolbar ? rect(scanToolbar) : null,
      scanBinInput: scanBinInput ? rect(scanBinInput) : null,
      scanProductInput: scanProductInput ? rect(scanProductInput) : null,
      quickCapture: quickCapture ? rect(quickCapture) : null,
      quickQuantityInput: quickQuantityInput ? rect(quickQuantityInput) : null,
      quickSaveButton: quickSaveButton ? rect(quickSaveButton) : null,
      tableWrap: tableWrap ? rect(tableWrap) : null,
      table: table ? rect(table) : null,
      firstRow: firstRow ? rect(firstRow) : null,
      firstRowDisplay: firstRow ? getComputedStyle(firstRow).display : null,
    };
  });
}

test.describe("/inventory-counts page ui and functional regression", () => {
  test("functional controls, ui-formatting and responsiveness for inventory counts", async (
    { page, request },
    testInfo: TestInfo
  ) => {
    test.slow();
    const errors = collectClientErrors(page);
    const user = await createE2EUserWithRoles(request, ["admin"]);
    const seed = await seedInventoryCountData(request, user.username, user.password);

    await loginAndOpenInventoryCounts(page, user.username, user.password);

    await expect(page.getByRole("heading", { name: "Inventur" })).toBeVisible();
    await expect(page.getByTestId("inventory-count-create-form")).toBeVisible();
    await expect(page.getByTestId("inventory-count-type-select")).toBeVisible();
    await expect(page.getByTestId("inventory-count-warehouse-select")).toBeVisible();
    await expect(page.getByTestId("inventory-count-tolerance-input")).toBeVisible();
    await expect(page.getByTestId("inventory-count-notes-input")).toBeVisible();
    await expect(page.getByTestId("inventory-count-create-btn")).toBeVisible();
    await expect(page.getByTestId("inventory-count-session-list")).toBeVisible();
    await expect(page.getByTestId("inventory-count-scan-bin-input")).toBeVisible();
    await expect(page.getByTestId("inventory-count-scan-product-input")).toBeVisible();
    await expect(page.getByTestId("inventory-count-items-table")).toBeVisible();

    await page.getByTestId("inventory-count-type-select").selectOption("snapshot");
    await page.getByTestId("inventory-count-warehouse-select").selectOption(String(seed.warehouseId));
    await page.getByTestId("inventory-count-tolerance-input").fill("0");
    await page.getByTestId("inventory-count-notes-input").fill(`UI run ${Date.now()}`);
    await page.getByTestId("inventory-count-create-btn").click();

    await expect(page.getByTestId("inventory-count-selected-session")).toContainText("Aktive Session:");

    const activeSessionButton = page.locator('[data-testid^="inventory-count-session-"].active').first();
    await expect(activeSessionButton).toBeVisible();
    const activeSessionId = parseSessionId(await activeSessionButton.getAttribute("data-testid"));
    expect(activeSessionId).toBeGreaterThan(0);

    await page.getByTestId("inventory-count-generate-btn").click();
    await expect.poll(async () => await page.locator('[data-testid^="inventory-count-item-row-"]').count()).toBeGreaterThan(0);
    await expect(page.getByTestId("inventory-count-regenerate-btn")).toBeEnabled();
    await expect(page.getByTestId("inventory-count-complete-btn")).toBeEnabled();
    await expect(page.getByTestId("inventory-count-summary-total")).not.toHaveText("-");
    await page.getByTestId("inventory-count-regenerate-btn").click();
    await expect.poll(async () => await page.locator('[data-testid^="inventory-count-item-row-"]').count()).toBeGreaterThan(0);

    const firstRow = page.locator('[data-testid^="inventory-count-item-row-"]').first();
    await expect(firstRow).toBeVisible();
    await expect(page.locator('[data-testid^="inventory-count-item-qty-"]').first()).toBeVisible();
    const firstRowSaveButton = page.locator('[data-testid^="inventory-count-item-save-"]').first();
    await expect(firstRowSaveButton).toBeVisible();
    await expect(firstRowSaveButton).toBeEnabled();

    await page.getByTestId("inventory-count-scan-bin-input").fill("");
    await page.getByTestId("inventory-count-scan-product-input").fill(seed.productNumber);
    await expect(page.getByTestId("inventory-count-quick-capture")).toBeVisible();

    const quickQuantityInput = page.getByTestId("inventory-count-quick-quantity-input");
    const quickSaveButton = page.getByTestId("inventory-count-quick-save-btn");
    await quickQuantityInput.fill("2");
    await expect(quickSaveButton).toBeEnabled();
    await quickSaveButton.click();
    await expect.poll(async () => await quickSaveButton.isEnabled()).toBe(true);

    mkdirSync("output", { recursive: true });
    await page.waitForTimeout(250);
    await page.screenshot({ path: `output/inventory-count-page-${testInfo.project.name}.png` });

    const metrics = await captureLayoutMetrics(page);
    expect(metrics.htmlScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.panel.width).toBeGreaterThan(220);
    expect(metrics.panel.left).toBeGreaterThanOrEqual(-1);
    expect(metrics.panel.right).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.panelHeader).not.toBeNull();
    expect(metrics.warehouseGrid).not.toBeNull();
    expect(metrics.createForm).not.toBeNull();
    expect(metrics.typeSelect).not.toBeNull();
    expect(metrics.warehouseSelect).not.toBeNull();
    expect(metrics.toleranceInput).not.toBeNull();
    expect(metrics.notesInput).not.toBeNull();
    expect(metrics.createButton).not.toBeNull();
    expect(metrics.sessionList).not.toBeNull();
    expect(metrics.sessionListClientHeight).toBeGreaterThan(0);
    expect(metrics.sessionListScrollHeight).toBeGreaterThan(0);
    expect(metrics.sessionListOverflowY).not.toBeNull();
    expect(metrics.selectedSession).not.toBeNull();
    expect(metrics.sessionActions).not.toBeNull();
    expect(metrics.generateButton).not.toBeNull();
    expect(metrics.regenerateButton).not.toBeNull();
    expect(metrics.completeButton).not.toBeNull();
    expect(metrics.summaryGrid).not.toBeNull();
    expect(metrics.summaryCards.length).toBe(3);
    expect(metrics.scanToolbar).not.toBeNull();
    expect(metrics.scanBinInput).not.toBeNull();
    expect(metrics.scanProductInput).not.toBeNull();
    expect(metrics.quickCapture).not.toBeNull();
    expect(metrics.quickQuantityInput).not.toBeNull();
    expect(metrics.quickSaveButton).not.toBeNull();
    expect(metrics.tableWrap).not.toBeNull();
    expect(metrics.table).not.toBeNull();
    expect(metrics.firstRow).not.toBeNull();

    const insidePanelRightTolerance = metrics.viewportWidth <= 900 ? 24 : 1;
    for (const [name, area] of [
      ["panelHeader", metrics.panelHeader],
      ["warehouseGrid", metrics.warehouseGrid],
      ["createForm", metrics.createForm],
      ["typeSelect", metrics.typeSelect],
      ["warehouseSelect", metrics.warehouseSelect],
      ["toleranceInput", metrics.toleranceInput],
      ["notesInput", metrics.notesInput],
      ["createButton", metrics.createButton],
      ["sessionList", metrics.sessionList],
      ["selectedSession", metrics.selectedSession],
      ["sessionActions", metrics.sessionActions],
      ["generateButton", metrics.generateButton],
      ["regenerateButton", metrics.regenerateButton],
      ["completeButton", metrics.completeButton],
      ["summaryGrid", metrics.summaryGrid],
      ["scanToolbar", metrics.scanToolbar],
      ["scanBinInput", metrics.scanBinInput],
      ["scanProductInput", metrics.scanProductInput],
      ["quickCapture", metrics.quickCapture],
      ["quickQuantityInput", metrics.quickQuantityInput],
      ["quickSaveButton", metrics.quickSaveButton],
      ["tableWrap", metrics.tableWrap],
    ] as const) {
      expect(area, `Missing area: ${name}`).not.toBeNull();
      if (!area) {
        continue;
      }
      expect(area.width, `${name} width`).toBeGreaterThan(40);
      expect(area.height, `${name} height`).toBeGreaterThanOrEqual(20);
      expect(area.left, `${name} left`).toBeGreaterThanOrEqual(metrics.panel.left - 1);
      expect(area.right, `${name} right`).toBeLessThanOrEqual(metrics.panel.right + insidePanelRightTolerance);
    }
    if (metrics.firstRow) {
      expect(metrics.firstRow.width).toBeGreaterThan(100);
      expect(metrics.firstRow.height).toBeGreaterThan(20);
    }

    for (const [index, card] of metrics.summaryCards.entries()) {
      expect(card.width, `summary card ${index} width`).toBeGreaterThan(70);
      expect(card.height, `summary card ${index} height`).toBeGreaterThan(42);
      expect(card.left, `summary card ${index} left`).toBeGreaterThanOrEqual(metrics.panel.left - 1);
      expect(card.right, `summary card ${index} right`).toBeLessThanOrEqual(metrics.panel.right + insidePanelRightTolerance);
    }

    if (metrics.notesInput && metrics.createButton) {
      expect(intersects(metrics.notesInput, metrics.createButton)).toBeFalsy();
    }
    if (metrics.scanBinInput && metrics.scanProductInput) {
      expect(intersects(metrics.scanBinInput, metrics.scanProductInput)).toBeFalsy();
    }
    if (metrics.generateButton && metrics.regenerateButton) {
      expect(intersects(metrics.generateButton, metrics.regenerateButton)).toBeFalsy();
    }
    if (metrics.regenerateButton && metrics.completeButton) {
      expect(intersects(metrics.regenerateButton, metrics.completeButton)).toBeFalsy();
    }
    if (metrics.quickQuantityInput && metrics.quickSaveButton) {
      expect(intersects(metrics.quickQuantityInput, metrics.quickSaveButton)).toBeFalsy();
    }

    expect(metrics.warehouseGridColumns).toBeGreaterThanOrEqual(1);
    expect(metrics.firstRowDisplay).toBe("table-row");
    if (metrics.sessionListScrollHeight > metrics.sessionListClientHeight + 1) {
      expect(metrics.sessionListOverflowY).not.toBe("visible");
    }

    await countAllSessionItemsViaApi(request, seed.token, activeSessionId);
    const completeResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes(`/api/inventory-counts/${activeSessionId}/complete`)
    );
    await page.getByTestId("inventory-count-complete-btn").click();
    const completeResponse = await completeResponsePromise;
    const completePayload = await completeResponse.text();
    expect(completeResponse.ok(), `Complete session failed: ${completePayload}`).toBeTruthy();
    await expect.poll(async () => (await page.getByTestId("inventory-count-selected-session").textContent()) ?? "").toContain(
      "(completed)"
    );
    await expect.poll(async () => page.getByTestId("inventory-count-complete-btn").isDisabled()).toBe(true);
    await expect.poll(async () => page.getByTestId("inventory-count-generate-btn").isDisabled()).toBe(true);
    await expect.poll(async () => page.getByTestId("inventory-count-regenerate-btn").isDisabled()).toBe(true);

    await assertNoClientErrors(errors);
  });
});
