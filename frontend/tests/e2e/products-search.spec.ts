import { expect, test } from "@playwright/test";

import { ensureE2EProduct, loginAsAdminApi } from "./helpers/api";

test("product search returns expected product", async ({ page, request }) => {
  const token = await loginAsAdminApi(request);
  const productNumber = await ensureE2EProduct(request, token);

  await page.goto("/login");
  await page.getByTestId("login-username").fill(process.env.E2E_ADMIN_USERNAME ?? "admin");
  await page.getByTestId("login-password").fill(process.env.E2E_ADMIN_PASSWORD ?? "DirectStock2026!");
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/products");

  await page.getByTestId("products-search-input").fill(productNumber);
  await page.getByTestId("products-search-btn").click();

  await expect(page.getByTestId("products-table")).toContainText(productNumber);

  await page.locator('[data-testid^="products-row-"] a', { hasText: "Details" }).first().click();
  await expect(page).toHaveURL(/\/products\/\d+$/);
  await expect(page.getByTestId("product-detail-page")).toBeVisible();
  await expect(page.getByTestId("product-detail-page")).toContainText(productNumber);
});
