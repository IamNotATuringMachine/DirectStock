import { expect, test } from "@playwright/test";

import { ensureE2EInventoryStock, loginAsAdminApi } from "./helpers/api";

function dateRange() {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const fromDate = new Date(now);
  fromDate.setDate(fromDate.getDate() - 30);
  const from = fromDate.toISOString().slice(0, 10);
  return { from, to };
}

test("reports page supports trends and demand forecast", async ({ page, request }) => {
  const token = await loginAsAdminApi(request);
  const seeded = await ensureE2EInventoryStock(request, token, `E2E-RP-${Date.now()}`);
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

  const goodsIssueResponse = await request.post("/api/goods-issues", {
    headers,
    data: { notes: `E2E reports goods issue ${Date.now()}` },
  });
  expect(goodsIssueResponse.ok()).toBeTruthy();
  const goodsIssue = (await goodsIssueResponse.json()) as { id: number };

  const goodsIssueItemResponse = await request.post(`/api/goods-issues/${goodsIssue.id}/items`, {
    headers,
    data: {
      product_id: product!.id,
      requested_quantity: "1",
      unit: "piece",
      source_bin_id: seeded.binId,
    },
  });
  expect(goodsIssueItemResponse.ok()).toBeTruthy();

  const completeIssueResponse = await request.post(`/api/goods-issues/${goodsIssue.id}/complete`, { headers });
  expect(completeIssueResponse.ok()).toBeTruthy();

  const recomputeResponse = await request.post("/api/reports/demand-forecast/recompute", {
    headers,
    data: {},
  });
  expect(recomputeResponse.ok()).toBeTruthy();

  const range = dateRange();
  await page.goto("/login");
  await page.getByTestId("login-username").fill(process.env.E2E_ADMIN_USERNAME ?? "admin");
  await page.getByTestId("login-password").fill(process.env.E2E_ADMIN_PASSWORD ?? "DirectStock2026!");
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/reports");
  await expect(page.getByTestId("reports-page")).toBeVisible();

  await page.getByTestId("reports-type-select").selectOption("trends");
  await page.getByTestId("reports-date-from").fill(range.from);
  await page.getByTestId("reports-date-to").fill(range.to);
  await page.getByTestId("reports-trend-product-id").fill(String(product!.id));
  await expect.poll(async () => await page.getByTestId("reports-trends-table").locator("tbody tr").count()).toBeGreaterThan(0);

  await page.getByTestId("reports-type-select").selectOption("demand-forecast");
  await page.getByTestId("reports-forecast-product-id").fill(String(product!.id));
  await expect
    .poll(async () => await page.getByTestId("reports-demand-forecast-table").locator("tbody tr").count())
    .toBeGreaterThan(0);

  await page.getByTestId("reports-forecast-recompute-btn").click();
  await expect(page.getByTestId("reports-forecast-recompute-btn")).toBeEnabled();

  await page.getByTestId("reports-download-csv-btn").click();
});
