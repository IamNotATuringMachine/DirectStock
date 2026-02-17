import { expect, test } from "@playwright/test";

import { assertOkJson, ensureE2EProduct, loginAsAdminApi } from "./helpers/api";

test("reports returns table shows internal and external repair columns", async ({ page, request }) => {
  const token = await loginAsAdminApi(request);
  const headers = { Authorization: `Bearer ${token}` };
  const productNumber = await ensureE2EProduct(request, token, `E2E-RPT-RET-${Date.now()}`);

  const productsResponse = await request.get(`/api/products?search=${encodeURIComponent(productNumber)}&page_size=200`, {
    headers,
  });
  const productsPayload = await assertOkJson<{
    items: Array<{ id: number; product_number: string }>;
  }>(productsResponse, "reports returns product lookup");
  const product = productsPayload.items.find((item) => item.product_number === productNumber);
  expect(product).toBeDefined();

  const internalOrderResponse = await request.post("/api/return-orders", {
    headers,
    data: { source_type: "customer", source_reference: `RPT-CUST-${Date.now()}` },
  });
  const internalOrder = await assertOkJson<{ id: number; return_number: string }>(
    internalOrderResponse,
    "create internal return order",
  );

  const externalOrderResponse = await request.post("/api/return-orders", {
    headers,
    data: { source_type: "technician", source_reference: `RPT-TECH-${Date.now()}` },
  });
  const externalOrder = await assertOkJson<{ id: number; return_number: string }>(
    externalOrderResponse,
    "create external return order",
  );

  const internalItem = await request.post(`/api/return-orders/${internalOrder.id}/items`, {
    headers,
    data: {
      product_id: product!.id,
      quantity: "1",
      unit: "piece",
      decision: "repair",
      repair_mode: "internal",
    },
  });
  await assertOkJson(internalItem, "create internal repair return item");

  const externalItem = await request.post(`/api/return-orders/${externalOrder.id}/items`, {
    headers,
    data: {
      product_id: product!.id,
      quantity: "1",
      unit: "piece",
      decision: "repair",
      repair_mode: "external",
    },
  });
  await assertOkJson(externalItem, "create external repair return item");

  await page.goto("/login");
  await page.getByTestId("login-username").fill(process.env.E2E_ADMIN_USERNAME ?? "admin");
  await page.getByTestId("login-password").fill(process.env.E2E_ADMIN_PASSWORD ?? "DirectStock2026!");
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/reports");
  await expect(page.getByTestId("reports-page")).toBeVisible();
  await page.getByTestId("reports-type-select").selectOption("returns");
  await expect(page.getByTestId("reports-returns-table")).toBeVisible();
  await expect(page.getByTestId("reports-returns-table")).toContainText("Repair Intern");
  await expect(page.getByTestId("reports-returns-table")).toContainText("Repair Extern");
  await expect(page.getByTestId("reports-returns-table")).toContainText(internalOrder.return_number);
  await expect(page.getByTestId("reports-returns-table")).toContainText(externalOrder.return_number);
});
