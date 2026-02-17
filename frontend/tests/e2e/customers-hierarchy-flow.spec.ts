import { expect, test } from "@playwright/test";

import { loginAsAdminApi } from "./helpers/api";

test("customer hierarchy api flow with location linkage", async ({ request }) => {
  const token = await loginAsAdminApi(request);
  const marker = Date.now().toString();
  const headers = { Authorization: `Bearer ${token}` };

  const customer = await request.post("/api/customers", {
    headers,
    data: {
      customer_number: `E2E-CUS-${marker}`,
      company_name: `E2E Kunde ${marker}`,
      is_active: true,
    },
  });
  expect(customer.ok()).toBeTruthy();
  const customerId = (await customer.json() as { id: number }).id;

  const location = await request.post(`/api/customers/${customerId}/locations`, {
    headers,
    data: {
      location_code: `E2E-LOC-${marker}`,
      name: `Koblenz ${marker}`,
      city: "Koblenz",
      country_code: "DE",
      is_active: true,
    },
  });
  expect(location.ok()).toBeTruthy();
  const locationId = (await location.json() as { id: number }).id;

  const contact = await request.post(`/api/customers/${customerId}/contacts`, {
    headers,
    data: {
      customer_location_id: locationId,
      job_title: "Kassenleitung",
      salutation: "Frau",
      first_name: "Erika",
      last_name: "Mueller",
      phone: "+49-261-9876",
      is_active: true,
    },
  });
  expect(contact.ok()).toBeTruthy();

  const goodsIssue = await request.post("/api/goods-issues", {
    headers,
    data: {
      customer_location_id: locationId,
      customer_reference: `E2E-WA-${marker}`,
    },
  });
  expect(goodsIssue.ok()).toBeTruthy();
  const goodsIssuePayload = await goodsIssue.json() as { customer_id: number; customer_location_id: number };
  expect(goodsIssuePayload.customer_id).toBe(customerId);
  expect(goodsIssuePayload.customer_location_id).toBe(locationId);

  const salesOrder = await request.post("/api/sales-orders", {
    headers,
    data: {
      customer_location_id: locationId,
      items: [],
    },
  });
  expect(salesOrder.ok()).toBeTruthy();
  const salesOrderPayload = await salesOrder.json() as {
    order: { customer_id: number; customer_location_id: number };
  };
  expect(salesOrderPayload.order.customer_id).toBe(customerId);
  expect(salesOrderPayload.order.customer_location_id).toBe(locationId);

  const shipment = await request.post("/api/shipments", {
    headers,
    data: {
      carrier: "dhl",
      customer_location_id: locationId,
      recipient_name: "E2E Kunde",
      shipping_address: "Musterstrasse 1, 56068 Koblenz",
    },
  });
  expect(shipment.ok()).toBeTruthy();
  const shipmentPayload = await shipment.json() as { customer_id: number; customer_location_id: number };
  expect(shipmentPayload.customer_id).toBe(customerId);
  expect(shipmentPayload.customer_location_id).toBe(locationId);
});
