import { expect, test } from "@playwright/test";

import { ensureE2EInventoryStock, loginAsAdminApi } from "./helpers/api";

test("inventory count flow creates session, counts item and completes", async ({ page, request }) => {
  const token = await loginAsAdminApi(request);
  const seeded = await ensureE2EInventoryStock(request, token, `E2E-IC-${Date.now()}`);

  await page.goto("/login");
  await page.getByTestId("login-username").fill(process.env.E2E_ADMIN_USERNAME ?? "admin");
  await page.getByTestId("login-password").fill(process.env.E2E_ADMIN_PASSWORD ?? "DirectStock2026!");
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/inventory-counts");

  await page.getByTestId("inventory-count-type-select").selectOption("snapshot");
  await page.getByTestId("inventory-count-warehouse-select").selectOption(String(seeded.warehouseId));
  await page.getByTestId("inventory-count-tolerance-input").fill("0");
  await page.getByTestId("inventory-count-create-btn").click();

  await expect.poll(async () => await page.locator('[data-testid^="inventory-count-session-"]').count()).toBeGreaterThan(0);

  await page.getByTestId("inventory-count-generate-btn").click();
  await expect.poll(async () => await page.locator('[data-testid^="inventory-count-item-row-"]').count()).toBeGreaterThan(0);

  await page.getByTestId("inventory-count-scan-product-input").fill(seeded.productNumber);
  const activeRow = page.locator('[data-testid^="inventory-count-item-row-"]').first();
  const snapshotValue = ((await activeRow.locator("td").nth(2).textContent()) ?? "0").trim();

  await page.getByTestId("inventory-count-quick-quantity-input").fill(snapshotValue);
  await page.getByTestId("inventory-count-quick-save-btn").click();

  await expect(page.getByTestId("inventory-count-summary-counted")).toContainText("1");

  await page.getByTestId("inventory-count-complete-btn").click();
  await expect(page.getByTestId("inventory-count-selected-session")).toContainText("(completed)");
});
