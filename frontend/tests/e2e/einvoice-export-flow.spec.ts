import { expect, test, type APIRequestContext } from "@playwright/test";

import { loginAsAdminApi } from "./helpers/api";

async function createInvoiceCandidate(request: APIRequestContext, token: string, marker: string): Promise<number> {
  const group = await request.post("/api/product-groups", {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: `E2E-EINV-${marker}-GROUP`, description: "E2E" },
  });
  expect(group.ok()).toBeTruthy();
  const groupId = (await group.json() as { id: number }).id;

  const product = await request.post("/api/products", {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      product_number: `E2E-EINV-${marker}-ART`,
      name: `E2E Einvoice ${marker}`,
      description: "E2E",
      product_group_id: groupId,
      unit: "piece",
      status: "active",
    },
  });
  expect(product.ok()).toBeTruthy();
  const productId = (await product.json() as { id: number }).id;

  const customer = await request.post("/api/customers", {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      customer_number: `E2E-EINV-${marker}-CUS`,
      company_name: `E2E Einvoice ${marker}`,
      contact_name: "E2E",
      is_active: true,
    },
  });
  expect(customer.ok()).toBeTruthy();
  const customerId = (await customer.json() as { id: number }).id;

  const price = await request.post(`/api/pricing/products/${productId}/base-prices`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      net_price: "60.00",
      vat_rate: "19",
      currency: "EUR",
      valid_from: new Date().toISOString(),
      is_active: true,
    },
  });
  expect(price.ok()).toBeTruthy();

  const order = await request.post("/api/sales-orders", {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      customer_id: customerId,
      currency: "EUR",
      items: [{ item_type: "product", product_id: productId, quantity: "1", unit: "piece" }],
    },
  });
  expect(order.ok()).toBeTruthy();
  const orderId = (await order.json() as { order: { id: number } }).order.id;

  const invoice = await request.post("/api/invoices", {
    headers: { Authorization: `Bearer ${token}` },
    data: { sales_order_id: orderId },
  });
  expect(invoice.ok()).toBeTruthy();
  return (await invoice.json() as { invoice: { id: number } }).invoice.id;
}

test("einvoice export flow returns generated or validation_error response", async ({ request }) => {
  const token = await loginAsAdminApi(request);
  const marker = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const invoiceId = await createInvoiceCandidate(request, token, marker);

  const xrechnung = await request.post(`/api/invoices/${invoiceId}/exports/xrechnung`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect([200, 422]).toContain(xrechnung.status());
  if (xrechnung.status() === 200) {
    const payload = await xrechnung.json() as { status: string; document_id: number | null; validator_report?: unknown };
    expect(payload.status).toBe("generated");
    expect(payload.document_id).not.toBeNull();
    expect(payload.validator_report).toBeTruthy();
  } else {
    const payload = await xrechnung.json() as Record<string, unknown>;
    const detail = payload.detail ?? payload.message;
    if (typeof detail === "string") {
      expect(detail.length).toBeGreaterThan(0);
    } else {
      expect(Object.keys(payload).length).toBeGreaterThan(0);
    }
  }

  const zugferd = await request.post(`/api/invoices/${invoiceId}/exports/zugferd`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect([200, 422]).toContain(zugferd.status());
  if (zugferd.status() === 200) {
    const payload = await zugferd.json() as { status: string; document_id: number | null; validator_report?: unknown };
    expect(payload.status).toBe("generated");
    expect(payload.document_id).not.toBeNull();
    expect(payload.validator_report).toBeTruthy();
  } else {
    const payload = await zugferd.json() as Record<string, unknown>;
    const detail = payload.detail ?? payload.message;
    if (typeof detail === "string") {
      expect(detail.length).toBeGreaterThan(0);
    } else {
      expect(Object.keys(payload).length).toBeGreaterThan(0);
    }
  }
});
