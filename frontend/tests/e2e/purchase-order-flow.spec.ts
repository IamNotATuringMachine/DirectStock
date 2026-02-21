import { expect, test } from "@playwright/test";

import { ensureE2EProduct, ensureE2ESupplier, loginAsAdminApi } from "./helpers/api";

test("purchase order flow creates order, item and status transition", async ({ page, request }) => {
  const token = await loginAsAdminApi(request);
  const productNumber = await ensureE2EProduct(request, token, `000-E2E-PO-${Date.now()}`);
  const supplier = await ensureE2ESupplier(request, token);

  await page.goto("/login");
  await page.getByTestId("login-username").fill(process.env.E2E_ADMIN_USERNAME ?? "admin");
  await page.getByTestId("login-password").fill(process.env.E2E_ADMIN_PASSWORD ?? "DirectStock2026!");
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/purchasing");

  await page.getByTestId("purchase-order-supplier-select").selectOption(String(supplier.id));
  await page.getByTestId("purchase-order-notes-input").fill(`E2E PO ${Date.now()}`);
  await page.getByTestId("purchase-order-create-btn").click();

  await expect.poll(async () => await page.locator('[data-testid^="purchase-order-item-"]').count()).toBeGreaterThan(0);
  await expect(page.getByTestId("purchase-order-selected-status")).toContainText("(draft)");

  const productOptionValue = await page
    .locator('[data-testid="purchase-order-item-product-select"] option', { hasText: productNumber })
    .first()
    .getAttribute("value");
  expect(productOptionValue).toBeTruthy();

  await page.getByTestId("purchase-order-item-product-select").selectOption(productOptionValue!);
  await page.getByTestId("purchase-order-item-quantity-input").fill("4");
  await page.getByTestId("purchase-order-item-add-btn").click();

  await expect(page.getByTestId("purchase-order-items-list")).toContainText("4.000");

  await page.getByTestId("purchase-order-status-approved").click();
  await expect(page.getByTestId("purchase-order-selected-status")).toContainText("(approved)");

  await page.getByTestId("purchase-order-status-ordered").click();
  await expect(page.getByTestId("purchase-order-selected-status")).toContainText("(ordered)");
});
