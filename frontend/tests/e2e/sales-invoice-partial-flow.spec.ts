import { expect, test, type APIRequestContext } from "@playwright/test";

import { loginAsAdminApi } from "./helpers/api";

async function createProduct(request: APIRequestContext, token: string, marker: string): Promise<number> {
  const group = await request.post("/api/product-groups", {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: `E2E-P5-${marker}-GROUP`, description: "E2E Phase5" },
  });
  expect(group.ok()).toBeTruthy();

  const product = await request.post("/api/products", {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      product_number: `E2E-P5-${marker}-ART`,
      name: `E2E Product ${marker}`,
      description: "E2E Product",
      product_group_id: (await group.json() as { id: number }).id,
      unit: "piece",
      status: "active",
    },
  });
  expect(product.ok()).toBeTruthy();
  return (await product.json() as { id: number }).id;
}

async function createCustomer(request: APIRequestContext, token: string, marker: string): Promise<number> {
  const customer = await request.post("/api/customers", {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      customer_number: `E2E-P5-${marker}-CUS`,
      company_name: `E2E Customer ${marker}`,
      contact_name: "E2E",
      is_active: true,
    },
  });
  expect(customer.ok()).toBeTruthy();
  return (await customer.json() as { id: number }).id;
}

test("sales and invoice partial flow enforces over-invoicing guard", async ({ request }) => {
  const token = await loginAsAdminApi(request);
  const marker = Date.now().toString();
  const productId = await createProduct(request, token, marker);
  const customerId = await createCustomer(request, token, marker);

  const basePrice = await request.post(`/api/pricing/products/${productId}/base-prices`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      net_price: "25.00",
      vat_rate: "19",
      currency: "EUR",
      valid_from: new Date().toISOString(),
      is_active: true,
    },
  });
  expect(basePrice.ok()).toBeTruthy();

  const order = await request.post("/api/sales-orders", {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      customer_id: customerId,
      currency: "EUR",
      items: [{ item_type: "product", product_id: productId, quantity: "2", unit: "piece" }],
    },
  });
  expect(order.ok()).toBeTruthy();
  const orderPayload = await order.json() as { order: { id: number }; items: Array<{ id: number }> };

  const invoice = await request.post("/api/invoices", {
    headers: { Authorization: `Bearer ${token}` },
    data: { sales_order_id: orderPayload.order.id },
  });
  expect(invoice.ok()).toBeTruthy();
  const invoicePayload = await invoice.json() as { invoice: { id: number } };

  const partial = await request.post(`/api/invoices/${invoicePayload.invoice.id}/partial`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { items: [{ sales_order_item_id: orderPayload.items[0].id, quantity: "1" }] },
  });
  expect(partial.status()).toBe(409);
});
