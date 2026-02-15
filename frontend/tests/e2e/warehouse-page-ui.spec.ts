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

type WarehouseLayoutMetrics = {
  viewportWidth: number;
  htmlScrollWidth: number;
  bodyScrollWidth: number;
  panel: Rect;
  panelHeader: Rect | null;
  warehouseGridColumns: number;
  batchGridColumns: number;
  warehousesCard: Rect | null;
  zonesCard: Rect | null;
  binsCard: Rect | null;
  batchDialog: Rect | null;
  qrDialog: Rect | null;
  binGrid: Rect | null;
  binCards: Rect[];
};

function intersects(a: Rect, b: Rect): boolean {
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

async function loginAndOpenWarehousePage(page: Page, username: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByTestId("login-username").fill(username);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/warehouse");
  await expect(page).toHaveURL(/\/warehouse$/);
  await expect(page.getByRole("heading", { name: "Lagerstruktur" })).toBeVisible();
}

async function createWarehouseForTest(
  request: APIRequestContext,
  token: string,
  marker: string,
): Promise<{ id: number; code: string; name: string }> {
  const headers = { Authorization: `Bearer ${token}` };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = `${marker.slice(-6)}${attempt}`;
    const code = `E2EWH${suffix}`;
    const response = await request.post("/api/warehouses", {
      headers,
      data: {
        code,
        name: `E2E Warehouse ${suffix}`,
        address: `Test Street ${suffix}`,
        is_active: true,
      },
    });
    if (response.ok()) {
      return (await response.json()) as { id: number; code: string; name: string };
    }
    expect(response.status()).toBe(409);
  }

  throw new Error("Failed to create unique warehouse for /warehouse UI test");
}

async function createZoneForTest(
  request: APIRequestContext,
  token: string,
  warehouseId: number,
  marker: string,
): Promise<{ id: number; code: string; name: string }> {
  const headers = { Authorization: `Bearer ${token}` };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = `${marker.slice(-5)}${attempt}`;
    const code = `E2EZ${suffix}`;
    const response = await request.post(`/api/warehouses/${warehouseId}/zones`, {
      headers,
      data: {
        code,
        name: `E2E Zone ${suffix}`,
        zone_type: "storage",
        is_active: true,
      },
    });
    if (response.ok()) {
      return (await response.json()) as { id: number; code: string; name: string };
    }
    expect(response.status()).toBe(409);
  }

  throw new Error("Failed to create unique zone for /warehouse UI test");
}

async function seedBinBatchForZone(
  request: APIRequestContext,
  token: string,
  zoneId: number,
  marker: string,
): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const prefix = `Q${marker.slice(-7)}${attempt}`.slice(0, 10);
    const response = await request.post(`/api/zones/${zoneId}/bins/batch`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        prefix,
        aisle_from: 1,
        aisle_to: 2,
        shelf_from: 1,
        shelf_to: 1,
        level_from: 1,
        level_to: 1,
        bin_type: "storage",
      },
    });
    if (response.ok()) {
      return;
    }
    expect(response.status()).toBe(409);
  }

  throw new Error("Failed to seed bin batch due repeated bin code conflicts");
}

async function captureWarehouseLayoutMetrics(page: Page): Promise<WarehouseLayoutMetrics> {
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

    const panel = document.querySelector('[data-testid="warehouse-page"]');
    if (!panel) {
      throw new Error("Warehouse page not found");
    }

    const panelHeader = panel.querySelector("header");
    // Find the 3 main sections (Warehouses, Zones, Bins)
    const sections = Array.from(panel.querySelectorAll("section"));
    const warehouseGrid = panel.querySelector(".grid.grid-cols-1"); // The main grid container

    // Check for the dialogs/grids inside the sections
    const batchDialog = panel.querySelector('[data-testid="warehouse-batch-create-dialog"]');
    const qrDialog = panel.querySelector('[data-testid="warehouse-qr-print-dialog"]');
    const binGrid = panel.querySelector('[data-testid="warehouse-bin-grid"]');
    const binCards = binGrid ? Array.from(binGrid.children) : [];

    const warehouseGridColumns = warehouseGrid
      ? getComputedStyle(warehouseGrid)
          .gridTemplateColumns.split(" ")
          .map((chunk) => chunk.trim())
          .filter(Boolean).length
      : 0;

    // The batch grid is now inside the dialog form
    const batchGrid = batchDialog?.querySelector("form");
    const batchGridColumns = batchGrid
      ? getComputedStyle(batchGrid)
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
      warehouseGridColumns,
      batchGridColumns,
      warehousesCard: sections[0] ? rect(sections[0]) : null,
      zonesCard: sections[1] ? rect(sections[1]) : null,
      binsCard: sections[2] ? rect(sections[2]) : null,
      batchDialog: batchDialog ? rect(batchDialog) : null,
      qrDialog: qrDialog ? rect(qrDialog) : null,
      binGrid: binGrid ? rect(binGrid) : null,
      binCards: binCards.map((card) => rect(card)),
    };
  });
}

function expectedWarehouseGridColumns(viewportWidth: number): number {
  if (viewportWidth < 1024) { // lg breakpoint in Tailwind is 1024px
    return 1;
  }
  return 3;
}

test.describe("/warehouse page ui and functional regression", () => {
  test("functional: all controls are operable and forms submit end-to-end", async ({ page, request }) => {
    const errors = collectClientErrors(page);
    const user = await createE2EUserWithRoles(request, ["admin"]);
    const marker = `${Date.now()}${Math.floor(Math.random() * 10_000)
      .toString()
      .padStart(4, "0")}`;

    await loginAndOpenWarehousePage(page, user.username, user.password);

    await expect(page.getByRole("heading", { name: "Lager", exact: true })).toBeVisible();
    
    // Open create warehouse form
    await page.getByTitle("Neues Lager").click();

    const warehouseCode = `E2E-WH-${marker.slice(-6)}`;
    const warehouseName = `E2E Warehouse ${marker.slice(-6)}`;
    const warehouseAddress = `E2E Address ${marker.slice(-4)}`;
    
    await page.getByPlaceholder("Code (z.B. WH-MAIN)").fill(warehouseCode);
    await page.getByPlaceholder("Name").fill(warehouseName);
    await page.getByPlaceholder("Adresse").fill(warehouseAddress);
    await page.getByRole("button", { name: "Anlegen" }).click();

    const createdWarehouseButton = page
      .getByRole("button", {
        name: new RegExp(`${escapeRegExp(warehouseCode)}\\s*${escapeRegExp(warehouseName)}`),
      })
      .first();
    await expect(createdWarehouseButton).toBeVisible();
    await createdWarehouseButton.click();
    // In the new UI, selected item has a blue/emerald highlight but not necessarily a class "active" on the button element itself, 
    // but we can check if it has the specific style or check for the indicator dot.
    // However, for simplicity let's just assume if we clicked it, it's selected. The UI update should reflect in the next column.

    await expect(page.getByRole("heading", { name: /^Zonen/ })).toBeVisible();
    
    // Open create zone form
    await page.getByTitle("Neue Zone").click();

    const zoneCode = `E2E-Z-${marker.slice(-5)}`;
    const zoneName = `E2E Zone ${marker.slice(-5)}`;
    await page.getByPlaceholder("Zone-Code (z.B. Z-01)").fill(zoneCode);
    await page.getByPlaceholder("Name").fill(zoneName);
    
    // Zone type select
    await page.locator('select').first().selectOption("returns");
    
    await page.getByRole("button", { name: "Anlegen" }).click();

    const createdZoneButton = page
      .getByRole("button", {
        name: new RegExp(`${escapeRegExp(zoneCode)}.*${escapeRegExp(zoneName)}`),
      })
      .first();
    await expect(createdZoneButton).toBeVisible();
    await createdZoneButton.click();

    await expect(page.getByRole("heading", { name: "Lagerplätze" })).toBeVisible();
    
    // Open batch create dialog
    await page.getByTitle("Batch erstellen").click();
    await expect(page.getByTestId("warehouse-batch-create-dialog")).toBeVisible();
    
    // QR Dialog should be hidden initially as there are no bins
    await expect(page.getByTestId("warehouse-qr-print-dialog")).toBeHidden();

    await page.getByLabel("Prefix").fill(`Q${marker.slice(-7)}`);
    await page.getByLabel("Aisle To").fill("2");
    await page.getByLabel("Shelf To").fill("1");
    await page.getByLabel("Level To").fill("1");
    await page.getByRole("button", { name: "Batch anlegen" }).click();

    const binGrid = page.getByTestId("warehouse-bin-grid");
    await expect(binGrid).toBeVisible();
    
    // Now QR print dialog should be visible
    await expect(page.getByTestId("warehouse-qr-print-dialog")).toBeVisible();
    await expect(page.getByTestId("warehouse-zone-qr-pdf")).toBeEnabled();

    const binQrButtons = page.locator('[data-testid^="warehouse-bin-qr-"]');
    await expect(binQrButtons).toHaveCount(2);

    const qrResponsePromise = page.waitForResponse((response) => {
      if (response.request().method() !== "GET") {
        return false;
      }
      return /\/api\/bins\/\d+\/qr-code$/.test(response.url()) && response.status() === 200;
    });
    await binQrButtons.first().click();
    await qrResponsePromise;

    const pdfResponsePromise = page.waitForResponse((response) => {
      return (
        response.request().method() === "POST" &&
        response.url().includes("/api/bins/qr-codes/pdf") &&
        response.status() === 200
      );
    });
    await page.getByTestId("warehouse-zone-qr-pdf").click();
    await pdfResponsePromise;

    await assertNoClientErrors(errors);
  });

  test("ui-formatting: cards are visible, aligned and responsive in all target viewports", async (
    { page, request },
    testInfo: TestInfo,
  ) => {
    const errors = collectClientErrors(page);
    const user = await createE2EUserWithRoles(request, ["admin"]);
    const token = await loginApi(request, user.username, user.password);
    const marker = `${Date.now()}${Math.floor(Math.random() * 10_000)
      .toString()
      .padStart(4, "0")}`;

    const warehouse = await createWarehouseForTest(request, token, marker);
    const zone = await createZoneForTest(request, token, warehouse.id, marker);
    await seedBinBatchForZone(request, token, zone.id, marker);

    await loginAndOpenWarehousePage(page, user.username, user.password);

    const warehouseButton = page
      .getByRole("button", {
        name: new RegExp(`${escapeRegExp(warehouse.code)}\\s*${escapeRegExp(warehouse.name)}`),
      })
      .first();
    await expect(warehouseButton).toBeVisible();
    await warehouseButton.click();

    const zoneButton = page
      .getByRole("button", {
        name: new RegExp(`${escapeRegExp(zone.code)}.*${escapeRegExp(zone.name)}`),
      })
      .first();
    await expect(zoneButton).toBeVisible();
    await zoneButton.click();

    // Open batch dialog for layout check
    await page.getByTitle("Batch erstellen").click();
    await expect(page.getByTestId("warehouse-batch-create-dialog")).toBeVisible();
    
    // QR print dialog is visible because we seeded bins
    await expect(page.getByTestId("warehouse-qr-print-dialog")).toBeVisible();
    await expect(page.getByTestId("warehouse-bin-grid")).toBeVisible();
    await expect(page.locator('[data-testid^="warehouse-bin-qr-"]').first()).toBeVisible();

    mkdirSync("output", { recursive: true });
    await page.screenshot({ path: `output/warehouse-page-${testInfo.project.name}.png` });

    const metrics = await captureWarehouseLayoutMetrics(page);

    expect(metrics.htmlScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.panel.width).toBeGreaterThan(240);
    expect(metrics.panel.left).toBeGreaterThanOrEqual(-1);
    expect(metrics.panel.right).toBeLessThanOrEqual(metrics.viewportWidth + 1);

    expect(metrics.panelHeader).not.toBeNull();
    expect(metrics.warehousesCard).not.toBeNull();
    expect(metrics.zonesCard).not.toBeNull();
    expect(metrics.binsCard).not.toBeNull();
    expect(metrics.batchDialog).not.toBeNull();
    expect(metrics.qrDialog).not.toBeNull();
    expect(metrics.binGrid).not.toBeNull();
    expect(metrics.binCards.length).toBeGreaterThan(0);

    for (const [name, section] of [
      ["panelHeader", metrics.panelHeader],
      ["warehousesCard", metrics.warehousesCard],
      ["zonesCard", metrics.zonesCard],
      ["binsCard", metrics.binsCard],
      ["batchDialog", metrics.batchDialog],
      ["qrDialog", metrics.qrDialog],
      ["binGrid", metrics.binGrid],
    ] as const) {
      expect(section, `Section ${name} not found`).not.toBeNull();
      if (!section) {
        continue;
      }
      expect(section.width, `${name} width`).toBeGreaterThan(80);
      expect(section.height, `${name} height`).toBeGreaterThan(32);
      expect(section.left, `${name} left`).toBeGreaterThanOrEqual(metrics.panel.left - 1);
      expect(section.right, `${name} right`).toBeLessThanOrEqual(metrics.panel.right + 1);
    }

    if (metrics.warehousesCard && metrics.zonesCard) {
      expect(intersects(metrics.warehousesCard, metrics.zonesCard)).toBeFalsy();
    }
    if (metrics.zonesCard && metrics.binsCard) {
      expect(intersects(metrics.zonesCard, metrics.binsCard)).toBeFalsy();
    }
    if (metrics.warehousesCard && metrics.binsCard) {
      expect(intersects(metrics.warehousesCard, metrics.binsCard)).toBeFalsy();
    }

    const expectedColumns = expectedWarehouseGridColumns(metrics.viewportWidth);
    expect(metrics.warehouseGridColumns).toBe(expectedColumns);

    if (expectedColumns === 1 && metrics.warehousesCard && metrics.zonesCard && metrics.binsCard) {
      expect(metrics.zonesCard.top).toBeGreaterThanOrEqual(metrics.warehousesCard.bottom - 1);
      expect(metrics.binsCard.top).toBeGreaterThanOrEqual(metrics.zonesCard.bottom - 1);
    }

    if (metrics.viewportWidth <= 900) {
      expect(metrics.batchGridColumns).toBeLessThanOrEqual(2);
    } else {
      expect(metrics.batchGridColumns).toBe(2);
    }

    await assertNoClientErrors(errors);
  });
});
