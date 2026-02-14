import { expect, test } from "@playwright/test";

import { ensureE2EProduct, loginAsAdminApi } from "./helpers/api";

test("returns flow supports item decision and status lifecycle", async ({ page, request }) => {
  const token = await loginAsAdminApi(request);
  const productNumber = await ensureE2EProduct(request, token, `000-E2E-RT-${Date.now()}`);

  await page.goto("/login");
  await page.getByTestId("login-username").fill(process.env.E2E_ADMIN_USERNAME ?? "admin");
  await page.getByTestId("login-password").fill(process.env.E2E_ADMIN_PASSWORD ?? "DirectStock2026!");
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/returns");
  await expect(page.getByTestId("returns-page")).toBeVisible();

  await page.getByTestId("return-order-notes-input").fill(`E2E return ${Date.now()}`);
  await page.getByTestId("return-order-create-btn").click();
  await expect.poll(async () => await page.locator('[data-testid^="return-order-item-"]').count()).toBeGreaterThan(0);

  const productOptionValue = await page
    .locator('[data-testid="return-order-item-product-select"] option', { hasText: productNumber })
    .first()
    .getAttribute("value");
  expect(productOptionValue).toBeTruthy();

  await page.getByTestId("return-order-item-product-select").selectOption(productOptionValue!);
  await page.getByTestId("return-order-item-quantity-input").fill("1");
  await page.getByTestId("return-order-item-decision-select").selectOption("scrap");
  await page.getByTestId("return-order-item-add-btn").click();
  await expect(page.getByTestId("return-order-items-list")).toContainText("scrap");

  await page.getByTestId("return-order-status-received").click();
  await page.getByTestId("return-order-status-inspected").click();
  await page.getByTestId("return-order-status-resolved").click();

  await expect(page.getByTestId("returns-page")).toContainText("Aktueller Status:");
  await expect(page.getByTestId("returns-page")).toContainText("resolved");
});
