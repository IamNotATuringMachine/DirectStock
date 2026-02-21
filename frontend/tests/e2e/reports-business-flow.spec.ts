import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { assertOkJson, ensureE2EInventoryStock, loginAsAdminApi } from "./helpers/api";

type ReportsSeed = {
  token: string;
  productId: number;
  productNumber: string;
  warehouseId: number;
  dateFrom: string;
  dateTo: string;
};

function dateRange() {
  const now = new Date();
  const dateTo = now.toISOString().slice(0, 10);
  const fromDate = new Date(now);
  fromDate.setDate(fromDate.getDate() - 30);
  const dateFrom = fromDate.toISOString().slice(0, 10);
  return { dateFrom, dateTo };
}

async function loginUi(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByTestId("login-username").fill(process.env.E2E_ADMIN_USERNAME ?? "admin");
  await page.getByTestId("login-password").fill(process.env.E2E_ADMIN_PASSWORD ?? "DirectStock2026!");
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function seedReportsData(request: APIRequestContext): Promise<ReportsSeed> {
  const token = await loginAsAdminApi(request);
  const headers = { Authorization: `Bearer ${token}` };

  const seededStock = await ensureE2EInventoryStock(request, token, `E2E-RP-BIZ-${Date.now()}`);

  const productsResponse = await request.get(
    `/api/products?search=${encodeURIComponent(seededStock.productNumber)}&page_size=200`,
    { headers },
  );
  const productsPayload = await assertOkJson<{
    items: Array<{ id: number; product_number: string }>;
  }>(productsResponse, "reports seed products lookup");

  const product = productsPayload.items.find((item) => item.product_number === seededStock.productNumber);
  expect(product).toBeDefined();

  const issueResponse = await request.post("/api/goods-issues", {
    headers,
    data: {
      notes: `E2E reports business issue ${Date.now()}`,
    },
  });
  const issuePayload = await assertOkJson<{ id: number }>(issueResponse, "reports seed goods issue create");

  const issueItemResponse = await request.post(`/api/goods-issues/${issuePayload.id}/items`, {
    headers,
    data: {
      product_id: product!.id,
      requested_quantity: "1",
      unit: "piece",
      source_bin_id: seededStock.binId,
    },
  });
  await assertOkJson(issueItemResponse, "reports seed goods issue item create");

  const completeResponse = await request.post(`/api/goods-issues/${issuePayload.id}/complete`, { headers });
  await assertOkJson(completeResponse, "reports seed goods issue complete");

  const { dateFrom, dateTo } = dateRange();
  const recomputeResponse = await request.post("/api/reports/demand-forecast/recompute", {
    headers,
    data: {
      date_from: dateFrom,
      date_to: dateTo,
      warehouse_id: seededStock.warehouseId,
    },
  });
  await assertOkJson(recomputeResponse, "reports seed forecast recompute");

  return {
    token,
    productId: product!.id,
    productNumber: seededStock.productNumber,
    warehouseId: seededStock.warehouseId,
    dateFrom,
    dateTo,
  };
}

test("reports business flow: type switching, filters, recompute, csv contract", async ({ page, request }) => {
  test.slow();
  const seed = await seedReportsData(request);

  await loginUi(page);
  await page.goto("/reports");
  await expect(page.getByTestId("reports-page")).toBeVisible();

  await page.getByTestId("reports-date-from").fill(seed.dateFrom);
  await page.getByTestId("reports-date-to").fill(seed.dateTo);

  const reportTypes: Array<{ value: string; tableTestId: string }> = [
    { value: "stock", tableTestId: "reports-stock-table" },
    { value: "movements", tableTestId: "reports-movements-table" },
    { value: "inbound-outbound", tableTestId: "reports-inbound-outbound-table" },
    { value: "inventory-accuracy", tableTestId: "reports-accuracy-table" },
    { value: "abc", tableTestId: "reports-abc-table" },
    { value: "returns", tableTestId: "reports-returns-table" },
    { value: "picking-performance", tableTestId: "reports-picking-performance-table" },
    { value: "purchase-recommendations", tableTestId: "reports-purchase-recommendations-table" },
    { value: "trends", tableTestId: "reports-trends-table" },
    { value: "demand-forecast", tableTestId: "reports-demand-forecast-table" },
  ];

  for (const reportType of reportTypes) {
    await page.getByTestId("reports-type-select").selectOption(reportType.value);

    if (reportType.value === "trends") {
      await page.getByTestId("reports-trend-product-id").fill(String(seed.productId));
      await page.getByTestId("reports-trend-warehouse-id").fill(String(seed.warehouseId));
    }

    if (reportType.value === "demand-forecast") {
      await page.getByTestId("reports-forecast-product-id").fill(String(seed.productId));
      await page.getByTestId("reports-forecast-warehouse-id").fill(String(seed.warehouseId));
      await page.getByTestId("reports-forecast-recompute-btn").click();
      await expect(page.getByTestId("reports-forecast-recompute-btn")).toBeEnabled();
    }

    await expect(page.getByTestId(reportType.tableTestId)).toBeVisible();
  }

  await page.getByTestId("reports-type-select").selectOption("movements");
  await page.getByTestId("reports-movement-type-select").selectOption("goods_issue");

  await page.getByTestId("reports-date-from").fill(seed.dateFrom);
  await page.getByTestId("reports-date-to").fill(seed.dateTo);
  await expect
    .poll(async () => page.getByTestId("reports-movements-table").locator("tbody tr").count(), { timeout: 30_000 })
    .toBeGreaterThan(0);

  await page.getByTestId("reports-date-from").fill("2099-01-01");
  await page.getByTestId("reports-date-to").fill("2099-01-02");
  await expect
    .poll(async () => page.getByTestId("reports-movements-table").locator("tbody tr").count(), { timeout: 30_000 })
    .toBe(0);

  await page.getByTestId("reports-date-from").fill(seed.dateFrom);
  await page.getByTestId("reports-date-to").fill(seed.dateTo);
  await expect
    .poll(async () => page.getByTestId("reports-movements-table").locator("tbody tr").count(), { timeout: 30_000 })
    .toBeGreaterThan(0);

  const csvResponse = await request.get(
    `/api/reports/movements?format=csv&date_from=${seed.dateFrom}&date_to=${seed.dateTo}&movement_type=goods_issue&page=1&page_size=25`,
    {
      headers: { Authorization: `Bearer ${seed.token}` },
    },
  );

  expect(csvResponse.status()).toBe(200);
  expect(csvResponse.headers()["content-type"]).toContain("text/csv");
  expect(csvResponse.headers()["content-disposition"]).toContain("reports-movements.csv");

  const csvBody = await csvResponse.text();
  const [headerLine] = csvBody.split("\n");
  expect(headerLine).toContain("movement_type");
  expect(headerLine).toContain("product_number");
  expect(csvBody).toContain("goods_issue");
});
