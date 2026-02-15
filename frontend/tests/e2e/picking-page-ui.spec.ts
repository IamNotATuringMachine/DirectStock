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

type PickTaskSeed = {
  id: number;
  product_number: string;
  source_bin_code: string | null;
  status: string;
};

type PickingSeed = {
  username: string;
  password: string;
  waveId: number;
  waveNumber: string;
  tasks: PickTaskSeed[];
};

type PickingLayoutMetrics = {
  viewportWidth: number;
  htmlScrollWidth: number;
  bodyScrollWidth: number;
  topbarScrollWidth: number;
  topbarClientWidth: number;
  contentScrollWidth: number;
  contentClientWidth: number;
  overflowingElements: Array<{ descriptor: string; width: number; right: number }>;
  panel: Rect;
  panelHeader: Rect | null;
  warehouseGrid: Rect | null;
  warehouseGridColumns: number;
  wavePanel: Rect | null;
  detailsPanel: Rect | null;
  createButton: Rect | null;
  waveList: Rect | null;
  statusLine: Rect | null;
  releaseButton: Rect | null;
  completeButton: Rect | null;
  scannerPanel: Rect | null;
  scanTaskSelect: Rect | null;
  scanInput: Rect | null;
  scanSubmit: Rect | null;
  scanStatus: Rect | null;
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

async function fetchProductIdByNumber(
  request: APIRequestContext,
  token: string,
  productNumber: string,
): Promise<number> {
  const response = await request.get(`/api/products?search=${encodeURIComponent(productNumber)}&page_size=200`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as {
    items: Array<{ id: number; product_number: string }>;
  };
  const found = payload.items.find((item) => item.product_number === productNumber);
  expect(found).toBeTruthy();
  return found!.id;
}

async function createGoodsIssue(
  request: APIRequestContext,
  token: string,
  productId: number,
  sourceBinId: number,
): Promise<number> {
  const headers = { Authorization: `Bearer ${token}` };
  const issueResponse = await request.post("/api/goods-issues", {
    headers,
    data: { notes: `E2E picking ui ${Date.now()}` },
  });
  expect(issueResponse.ok()).toBeTruthy();
  const issue = (await issueResponse.json()) as { id: number };

  const itemResponse = await request.post(`/api/goods-issues/${issue.id}/items`, {
    headers,
    data: {
      product_id: productId,
      requested_quantity: "1",
      unit: "piece",
      source_bin_id: sourceBinId,
    },
  });
  expect(itemResponse.ok()).toBeTruthy();

  return issue.id;
}

async function seedPickingPageData(request: APIRequestContext): Promise<PickingSeed> {
  const user = await createE2EUserWithRoles(request, ["admin"]);
  const token = await loginApi(request, user.username, user.password);
  const marker = `${Date.now()}${Math.floor(Math.random() * 10_000)
    .toString()
    .padStart(4, "0")}`;
  const seededInventory = await ensureE2EInventoryStock(request, token, `E2E-PK-UI-${marker.slice(-8)}`);
  const productId = await fetchProductIdByNumber(request, token, seededInventory.productNumber);

  const issueA = await createGoodsIssue(request, token, productId, seededInventory.binId);
  const issueB = await createGoodsIssue(request, token, productId, seededInventory.binId);
  const createWaveResponse = await request.post("/api/pick-waves", {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      notes: `E2E picking ui wave ${marker}`,
      goods_issue_ids: [issueA, issueB],
    },
  });
  expect(createWaveResponse.ok()).toBeTruthy();
  const wavePayload = (await createWaveResponse.json()) as {
    wave: { id: number; wave_number: string; status: string };
    tasks: PickTaskSeed[];
  };

  expect(wavePayload.tasks.length).toBeGreaterThanOrEqual(1);

  return {
    username: user.username,
    password: user.password,
    waveId: wavePayload.wave.id,
    waveNumber: wavePayload.wave.wave_number,
    tasks: wavePayload.tasks,
  };
}

async function collectPickingLayoutMetrics(page: Page): Promise<PickingLayoutMetrics> {
  return page.evaluate(() => {
    const getRect = (selector: string): Rect | null => {
      const element = document.querySelector(selector);
      if (!element) {
        return null;
      }
      const rect = element.getBoundingClientRect();
      return {
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    };

    const panelRect = getRect('[data-testid="picking-page"]');
    if (!panelRect) {
      throw new Error("Picking panel not found");
    }

    const firstTableRow = document.querySelector('[data-testid="pick-task-table"] tbody tr');

    return {
      viewportWidth: window.innerWidth,
      htmlScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      topbarScrollWidth: (document.querySelector(".topbar") as HTMLElement | null)?.scrollWidth ?? 0,
      topbarClientWidth: (document.querySelector(".topbar") as HTMLElement | null)?.clientWidth ?? 0,
      contentScrollWidth: (document.querySelector("main.content") as HTMLElement | null)?.scrollWidth ?? 0,
      contentClientWidth: (document.querySelector("main.content") as HTMLElement | null)?.clientWidth ?? 0,
      overflowingElements: Array.from(document.querySelectorAll<HTMLElement>("body *"))
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const width = Math.max(element.scrollWidth, rect.width);
          const descriptor =
            element.getAttribute("data-testid") ??
            element.id ??
            (element.className ? String(element.className).split(" ").filter(Boolean).slice(0, 2).join(".") : "") ??
            element.tagName.toLowerCase();
          return { descriptor, width, right: rect.right };
        })
        .filter((item) => item.width > window.innerWidth + 1 || item.right > window.innerWidth + 1)
        .sort((a, b) => Math.max(b.width, b.right) - Math.max(a.width, a.right))
        .slice(0, 8),
      panel: panelRect,
      panelHeader: getRect('[data-testid="picking-page"] .panel-header'),
      warehouseGrid: getRect('[data-testid="picking-page"] .warehouse-grid'),
      warehouseGridColumns: getComputedStyle(document.querySelector('[data-testid="picking-page"] .warehouse-grid')!)
        .gridTemplateColumns.split(" ")
        .filter(Boolean).length,
      wavePanel: getRect('[data-testid="picking-page"] .warehouse-grid > .subpanel:nth-of-type(1)'),
      detailsPanel: getRect('[data-testid="picking-page"] .warehouse-grid > .subpanel:nth-of-type(2)'),
      createButton: getRect('[data-testid="pick-wave-create-btn"]'),
      waveList: getRect('[data-testid="pick-wave-list"]'),
      statusLine: getRect('[data-testid="pick-wave-selected-status"]'),
      releaseButton: getRect('[data-testid="pick-wave-release-btn"]'),
      completeButton: getRect('[data-testid="pick-wave-complete-btn"]'),
      scannerPanel: getRect('[data-testid="picking-page"] .warehouse-grid > .subpanel:nth-of-type(2) .subpanel'),
      scanTaskSelect: getRect('[data-testid="pick-scan-task-select"]'),
      scanInput: getRect('[data-testid="pick-scan-input"]'),
      scanSubmit: getRect('[data-testid="pick-scan-submit"]'),
      scanStatus: getRect('[data-testid="pick-scan-status"]'),
      tableWrap: getRect('[data-testid="picking-page"] .table-wrap'),
      tableRect: getRect('[data-testid="pick-task-table"]'),
      firstRowDisplay: firstTableRow ? getComputedStyle(firstTableRow).display : null,
    };
  });
}

async function completeTaskThroughScanner(page: Page, task: PickTaskSeed): Promise<void> {
  const taskRow = page.getByTestId(`pick-task-picked-${task.id}`).locator("xpath=ancestor::tr");
  let lastScanStatus = "";
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const statusBefore = await page.getByTestId("pick-scan-status").innerText();
    lastScanStatus = statusBefore;

    if ((await taskRow.innerText()).includes("picked")) {
      return;
    }

    if (task.source_bin_code && statusBefore.includes("Bin")) {
      await page.getByTestId("pick-scan-input").fill(`DS:BIN:${task.source_bin_code}`);
      await page.getByTestId("pick-scan-submit").click();
      await expect(page.getByTestId("pick-scan-status")).toContainText("Produkt");
    }

    await page.getByTestId("pick-scan-input").fill(task.product_number);
    await page.getByTestId("pick-scan-submit").click();

    const statusText = await page.getByTestId("pick-scan-status").innerText();
    lastScanStatus = statusText;
    if ((await taskRow.innerText()).includes("picked")) {
      return;
    }

    await page.waitForTimeout(150);
  }

  throw new Error(`Scanner flow could not complete task ${task.id}. Last status: ${lastScanStatus}`);
}

test.describe("picking page ui", () => {
  test("supports interaction, layout stability and responsive behavior", async ({ page, request }, testInfo: TestInfo) => {
    const seed = await seedPickingPageData(request);
    const errors = collectClientErrors(page);
    const firstTask = seed.tasks[0];
    const secondTask = seed.tasks[1] ?? null;
    expect(firstTask).toBeTruthy();

    await loginUi(page, seed.username, seed.password);
    await page.goto("/picking");
    await expect(page.getByTestId("picking-page")).toBeVisible();
    await expect(page.getByTestId("pick-wave-create-btn")).toBeVisible();
    await expect(page.getByTestId(`pick-wave-item-${seed.waveId}`)).toBeVisible();

    await page.getByTestId(`pick-wave-item-${seed.waveId}`).click();
    await expect(page.getByTestId("pick-wave-selected-status")).toContainText(seed.waveNumber);
    await expect(page.getByTestId("pick-wave-selected-status")).toContainText("draft");

    await expect(page.getByTestId("pick-wave-release-btn")).toBeEnabled();
    await expect(page.getByTestId("pick-wave-complete-btn")).toBeDisabled();

    await page.getByTestId("pick-wave-release-btn").click();
    await expect(page.getByTestId("pick-wave-selected-status")).toContainText("released");
    await expect(page.getByTestId("pick-wave-complete-btn")).toBeEnabled();

    await page.getByTestId("pick-scan-task-select").selectOption(String(firstTask.id));

    if (firstTask.source_bin_code) {
      await page.getByTestId("pick-scan-input").fill("DS:BIN:WRONG");
      await page.getByTestId("pick-scan-submit").click();
      await expect(page.getByTestId("pick-scan-status")).toContainText("Falscher Bin");

      await page.getByTestId("pick-scan-input").fill(`DS:BIN:${firstTask.source_bin_code}`);
      await page.getByTestId("pick-scan-submit").click();
      await expect(page.getByTestId("pick-scan-status")).toContainText("Produkt");
    }

    await page.getByTestId("pick-scan-input").fill("DS:ART:FALSCHES-PRODUKT");
    await page.getByTestId("pick-scan-submit").click();
    await expect(page.getByTestId("pick-scan-status")).toContainText("Falsches Produkt");

    await completeTaskThroughScanner(page, firstTask);

    const firstTaskRow = page.getByTestId(`pick-task-picked-${firstTask.id}`).locator("xpath=ancestor::tr");
    await expect(firstTaskRow).toContainText("picked");

    if (secondTask) {
      await page.getByTestId(`pick-task-skipped-${secondTask.id}`).click();
      const secondTaskRow = page.getByTestId(`pick-task-picked-${secondTask.id}`).locator("xpath=ancestor::tr");
      await expect(secondTaskRow).toContainText("skipped");
    } else {
      await page.getByTestId(`pick-task-skipped-${firstTask.id}`).click();
      await expect(firstTaskRow).toContainText("skipped");
      await page.getByTestId(`pick-task-picked-${firstTask.id}`).click();
      await expect(firstTaskRow).toContainText("picked");
    }

    const metrics = await collectPickingLayoutMetrics(page);
    expect(
      metrics.htmlScrollWidth,
      `Overflow details: ${JSON.stringify(metrics.overflowingElements)} | topbar=${metrics.topbarScrollWidth}/${metrics.topbarClientWidth} content=${metrics.contentScrollWidth}/${metrics.contentClientWidth}`,
    ).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(
      metrics.bodyScrollWidth,
      `Overflow details: ${JSON.stringify(metrics.overflowingElements)} | topbar=${metrics.topbarScrollWidth}/${metrics.topbarClientWidth} content=${metrics.contentScrollWidth}/${metrics.contentClientWidth}`,
    ).toBeLessThanOrEqual(metrics.viewportWidth + 1);

    expect(metrics.panelHeader).not.toBeNull();
    expect(metrics.warehouseGrid).not.toBeNull();
    expect(metrics.wavePanel).not.toBeNull();
    expect(metrics.detailsPanel).not.toBeNull();
    expect(metrics.createButton).not.toBeNull();
    expect(metrics.waveList).not.toBeNull();
    expect(metrics.statusLine).not.toBeNull();
    expect(metrics.releaseButton).not.toBeNull();
    expect(metrics.completeButton).not.toBeNull();
    expect(metrics.scannerPanel).not.toBeNull();
    expect(metrics.scanTaskSelect).not.toBeNull();
    expect(metrics.scanInput).not.toBeNull();
    expect(metrics.scanSubmit).not.toBeNull();
    expect(metrics.scanStatus).not.toBeNull();
    expect(metrics.tableWrap).not.toBeNull();
    expect(metrics.tableRect).not.toBeNull();

    const panel = metrics.panel;
    const insidePanel = [
      metrics.panelHeader,
      metrics.warehouseGrid,
      metrics.wavePanel,
      metrics.detailsPanel,
      metrics.createButton,
      metrics.waveList,
      metrics.statusLine,
      metrics.releaseButton,
      metrics.completeButton,
      metrics.scannerPanel,
      metrics.scanTaskSelect,
      metrics.scanInput,
      metrics.scanSubmit,
      metrics.scanStatus,
      metrics.tableWrap,
      metrics.tableRect,
    ].filter((item): item is Rect => item !== null);

    for (const rect of insidePanel) {
      expect(rect.left).toBeGreaterThanOrEqual(panel.left - 1);
      expect(rect.right).toBeLessThanOrEqual(panel.right + 1);
    }

    expect(intersects(metrics.wavePanel!, metrics.detailsPanel!)).toBe(false);
    expect(intersects(metrics.scanInput!, metrics.scanSubmit!)).toBe(false);
    expect(intersects(metrics.releaseButton!, metrics.completeButton!)).toBe(false);

    expect(metrics.warehouseGridColumns).toBe(expectedWarehouseGridColumns(metrics.viewportWidth));
    expect(metrics.firstRowDisplay).toBe("table-row");

    await page.getByTestId("pick-wave-complete-btn").click();
    await expect(page.getByTestId("pick-wave-selected-status")).toContainText("completed");

    mkdirSync("output", { recursive: true });
    await page.screenshot({
      path: `output/picking-page-${testInfo.project.name}.png`,
      fullPage: true,
    });

    await assertNoClientErrors(errors);
  });
});
