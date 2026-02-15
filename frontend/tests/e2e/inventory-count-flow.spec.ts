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

  const activeSessionTestId = await page
    .locator('[data-testid^="inventory-count-session-"].active')
    .first()
    .getAttribute("data-testid");
  expect(activeSessionTestId).toBeTruthy();
  const activeSessionId = Number(activeSessionTestId!.replace("inventory-count-session-", ""));
  expect(Number.isFinite(activeSessionId)).toBeTruthy();

  const listItemsResponse = await request.get(`/api/inventory-counts/${activeSessionId}/items`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(listItemsResponse.ok()).toBeTruthy();
  const listItems = (await listItemsResponse.json()) as Array<{
    id: number;
    snapshot_quantity: string;
  }>;
  expect(listItems.length).toBeGreaterThan(0);

  for (const item of listItems) {
    const updateResponse = await request.put(`/api/inventory-counts/${activeSessionId}/items/${item.id}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        counted_quantity: item.snapshot_quantity,
      },
    });
    expect(updateResponse.ok()).toBeTruthy();
  }

  await page.reload();
  await page.waitForURL(/\/inventory-counts$/);
  await page.getByTestId(`inventory-count-session-${activeSessionId}`).click();

  await page.getByTestId("inventory-count-scan-product-input").fill(seeded.productNumber);
  const activeRow = page.locator('[data-testid^="inventory-count-item-row-"]').first();
  const snapshotValue = ((await activeRow.locator("td").nth(2).textContent()) ?? "0").trim();

  await page.getByTestId("inventory-count-quick-quantity-input").fill(snapshotValue);
  await page.getByTestId("inventory-count-quick-save-btn").click();

  const summaryTotalText = (await page.getByTestId("inventory-count-summary-total").textContent()) ?? "0";
  const expectedCounted = Number(summaryTotalText.trim()) || 1;
  await expect(page.getByTestId("inventory-count-summary-counted")).toContainText(String(expectedCounted));

  const completeResponse = await request.post(`/api/inventory-counts/${activeSessionId}/complete`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!completeResponse.ok()) {
    const errorBody = await completeResponse.text();
    throw new Error(`inventory-count complete failed (${completeResponse.status()}): ${errorBody}`);
  }

  await page.reload();
  await page.waitForURL(/\/inventory-counts$/);
  await page.getByTestId(`inventory-count-session-${activeSessionId}`).click();
  await expect(page.getByTestId("inventory-count-selected-session")).toContainText("(completed)");
});
