import { expect, test } from "@playwright/test";

import {
  createE2EUserWithRoles,
  ensureE2EProduct,
  getInventoryQuantityForProduct,
  loginAsAdminApi,
  seedWarehouseZoneBin,
} from "./helpers/api";
import { loginAndOpenRoute } from "./helpers/ui";

async function selectSeededLocation(
  page: import("@playwright/test").Page,
  location: { warehouseId: number; zoneId: number; binId: number },
): Promise<void> {
  await page.getByTestId("goods-receipt-warehouse-select").selectOption(String(location.warehouseId));
  await expect
    .poll(
      async () =>
        await page.getByTestId("goods-receipt-zone-select").locator(`option[value="${location.zoneId}"]`).count(),
      { timeout: 20_000 },
    )
    .toBeGreaterThan(0);
  await page.getByTestId("goods-receipt-zone-select").selectOption(String(location.zoneId));
  await expect
    .poll(
      async () => await page.getByTestId("goods-receipt-bin-select").locator(`option[value="${location.binId}"]`).count(),
      { timeout: 20_000 },
    )
    .toBeGreaterThan(0);
  await page.getByTestId("goods-receipt-bin-select").selectOption(String(location.binId));
}

test("goods receipt flow creates movement and updates inventory", async ({ page, request }) => {
  const token = await loginAsAdminApi(request);
  const productNumber = await ensureE2EProduct(request, token, `E2E-GR-${Date.now()}`);
  const location = await seedWarehouseZoneBin(request, token, "E2EGR");
  const beforeInventory = await getInventoryQuantityForProduct(request, token, productNumber);

  await loginAndOpenRoute(page, "/goods-receipt", { rootTestId: "goods-receipt-page" });

  await page.getByTestId("goods-receipt-notes-input").fill(`Playwright receipt ${Date.now()}`);
  await page.getByTestId("goods-receipt-create-btn").click();

  await expect.poll(async () => await page.locator('[data-testid^="goods-receipt-item-"]').count()).toBeGreaterThan(0);

  const productOptionValue = await page
    .locator('[data-testid="goods-receipt-product-select"] option', { hasText: productNumber })
    .first()
    .getAttribute("value");
  expect(productOptionValue).toBeTruthy();

  await page.getByTestId("goods-receipt-product-select").selectOption(productOptionValue!);
  await expect(page.getByTestId("goods-receipt-serial-input")).toHaveCount(0);
  await selectSeededLocation(page, location);
  await page.getByTestId("goods-receipt-quantity-input").fill("3");
  await page.getByTestId("goods-receipt-add-item-btn").click();

  await expect(page.getByTestId("goods-receipt-items-list")).toContainText("Menge: 3");

  await page.getByTestId("goods-receipt-complete-btn").click();
  await expect(page.getByTestId("goods-receipt-complete-btn")).toBeDisabled();

  let afterInventory = await getInventoryQuantityForProduct(request, token, productNumber);
  await expect
    .poll(
      async () => {
        afterInventory = await getInventoryQuantityForProduct(request, token, productNumber);
        return afterInventory.numeric;
      },
      { timeout: 15000 }
    )
    .toBeGreaterThanOrEqual(beforeInventory.numeric + 3);

  await page.goto("/inventory");
  await page.getByTestId("inventory-search-input").fill(productNumber);
  await page.getByTestId("inventory-search-btn").click();

  await expect(page.getByTestId("inventory-table")).toContainText(productNumber);
  await expect(page.getByTestId("inventory-table")).toContainText(afterInventory.raw);

  await page.locator('[data-testid^="inventory-row-"]').first().click();
  await expect(page.getByTestId("inventory-detail-sheet")).toBeVisible();
  await expect(page.getByTestId("inventory-detail-sheet")).toContainText(productNumber);
});

test("tracked goods receipt enforces serial numbers and shows label print action", async ({ page, request }) => {
  const token = await loginAsAdminApi(request);
  const productNumber = await ensureE2EProduct(request, token, `E2E-GR-SN-${Date.now()}`, {
    requiresItemTracking: true,
  });
  const location = await seedWarehouseZoneBin(request, token, "E2ESN");

  await loginAndOpenRoute(page, "/goods-receipt", { rootTestId: "goods-receipt-page" });
  await page.getByTestId("goods-receipt-create-btn").click();
  await expect.poll(async () => await page.locator('[data-testid^="goods-receipt-item-"]').count()).toBeGreaterThan(0);

  const productOptionValue = await page
    .locator('[data-testid="goods-receipt-product-select"] option', { hasText: productNumber })
    .first()
    .getAttribute("value");
  expect(productOptionValue).toBeTruthy();

  await page.getByTestId("goods-receipt-product-select").selectOption(productOptionValue!);
  await selectSeededLocation(page, location);
  await page.getByTestId("goods-receipt-quantity-input").fill("1");
  await expect(page.getByTestId("goods-receipt-page")).toContainText("Seriennummern");

  await page.getByTestId("goods-receipt-serial-input").fill(`E2E-SN-${Date.now()}`);
  await page.getByTestId("goods-receipt-add-item-btn").click();
  await expect(page.getByTestId("goods-receipt-items-list")).toContainText("Seriennummern: 1");
  await expect(page.locator('[data-testid^="goods-receipt-item-print-labels-btn-"]').first()).toBeVisible();
});

test("goods receipt hides ad-hoc product button without quick-create permission", async ({ page, request }) => {
  const credentials = await createE2EUserWithRoles(request, ["lagermitarbeiter"]);

  await loginAndOpenRoute(page, "/goods-receipt", {
    rootTestId: "goods-receipt-page",
    credentials,
  });
  await page.getByTestId("goods-receipt-create-btn").click();
  await expect.poll(async () => await page.locator('[data-testid^="goods-receipt-item-"]').count()).toBeGreaterThan(0);
  await expect(page.getByTestId("goods-receipt-adhoc-product-btn")).toHaveCount(0);
});
