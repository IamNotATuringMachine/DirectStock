import { expect, test } from "@playwright/test";

import { ensureE2EInventoryStock, loginAsAdminApi } from "./helpers/api";
import { loginAndOpenRoute } from "./helpers/ui";

test("alerts page shows and acknowledges generated alerts", async ({ page, request }) => {
  const token = await loginAsAdminApi(request);
  const productNumber = `E2E-AL-${Date.now()}`;
  const seeded = await ensureE2EInventoryStock(request, token, productNumber);
  const headers = { Authorization: `Bearer ${token}` };

  const productResponse = await request.get(
    `/api/products?search=${encodeURIComponent(seeded.productNumber)}&page_size=200`,
    { headers }
  );
  expect(productResponse.ok()).toBeTruthy();
  const productPayload = (await productResponse.json()) as {
    items: Array<{ id: number; product_number: string }>;
  };
  const product = productPayload.items.find((item) => item.product_number === seeded.productNumber);
  expect(product).toBeTruthy();

  const setting = await request.put(
    `/api/products/${product!.id}/warehouse-settings/${seeded.warehouseId}`,
    {
      headers,
      data: {
        min_stock: "5",
        reorder_point: "5",
      },
    }
  );
  expect(setting.ok()).toBeTruthy();

  const rule = await request.post("/api/alert-rules", {
    headers,
    data: {
      name: `E2E low stock ${Date.now()}`,
      rule_type: "low_stock",
      severity: "critical",
      is_active: true,
      product_id: product!.id,
      warehouse_id: seeded.warehouseId,
      threshold_quantity: "5",
      dedupe_window_minutes: 1440,
    },
  });
  expect(rule.ok()).toBeTruthy();

  const issue = await request.post("/api/goods-issues", {
    headers,
    data: { notes: "E2E alerts issue" },
  });
  expect(issue.ok()).toBeTruthy();
  const issuePayload = (await issue.json()) as { id: number };

  const issueItem = await request.post(`/api/goods-issues/${issuePayload.id}/items`, {
    headers,
    data: {
      product_id: product!.id,
      requested_quantity: "1",
      unit: "piece",
      source_bin_id: seeded.binId,
    },
  });
  expect(issueItem.ok()).toBeTruthy();

  const completeIssue = await request.post(`/api/goods-issues/${issuePayload.id}/complete`, {
    headers,
  });
  expect(completeIssue.ok()).toBeTruthy();

  await loginAndOpenRoute(page, "/alerts", {
    rootTestId: "alerts-page",
  });

  const openRow = page.locator("#root tr", { hasText: seeded.productNumber }).first();
  await expect(openRow).toBeVisible();
  await openRow.getByRole("button", { name: /Ack|Quittieren/i }).click();

  await page.getByTestId("alerts-status-filter").selectOption("acknowledged");
  const acknowledgedRow = page.locator("#root tr", { hasText: seeded.productNumber }).first();
  await expect(acknowledgedRow).toBeVisible();
});
