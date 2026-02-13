import { expect, test } from "@playwright/test";

import {
  ensureE2EProduct,
  getInventoryQuantityForProduct,
  loginAsAdminApi,
} from "./helpers/api";

test("goods receipt flow creates movement and updates inventory", async ({ page, request }) => {
  const token = await loginAsAdminApi(request);
  const productNumber = await ensureE2EProduct(request, token, `E2E-GR-${Date.now()}`);
  const beforeInventory = await getInventoryQuantityForProduct(request, token, productNumber);

  await page.goto("/login");
  await page.getByTestId("login-username").fill(process.env.E2E_ADMIN_USERNAME ?? "admin");
  await page.getByTestId("login-password").fill(process.env.E2E_ADMIN_PASSWORD ?? "DirectStock2026!");
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/goods-receipt");

  await page.getByTestId("goods-receipt-notes-input").fill(`Playwright receipt ${Date.now()}`);
  await page.getByTestId("goods-receipt-create-btn").click();

  await expect.poll(async () => await page.locator('[data-testid^="goods-receipt-item-"]').count()).toBeGreaterThan(0);

  const productOptionValue = await page
    .locator('[data-testid="goods-receipt-product-select"] option', { hasText: productNumber })
    .first()
    .getAttribute("value");
  expect(productOptionValue).toBeTruthy();

  await page.getByTestId("goods-receipt-product-select").selectOption(productOptionValue!);
  await page.getByTestId("goods-receipt-quantity-input").fill("3");
  await page.getByTestId("goods-receipt-add-item-btn").click();

  await expect(page.getByTestId("goods-receipt-items-list")).toContainText("Menge 3");

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
