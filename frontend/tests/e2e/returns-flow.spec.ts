import { expect, test } from "@playwright/test";

import { ensureE2EProduct, loginAsAdminApi, seedWarehouseZoneBin } from "./helpers/api";
import { loginAndOpenRoute, waitForApiCondition, waitForApiResponseJson } from "./helpers/ui";

test("returns flow supports item decision and status lifecycle", async ({ page, request }) => {
  const token = await loginAsAdminApi(request);
  const productNumber = await ensureE2EProduct(request, token, `000-E2E-RT-${Date.now()}`);

  await loginAndOpenRoute(page, "/returns", { rootTestId: "returns-page" });

  await page.getByTestId("return-order-notes-input").fill(`E2E return ${Date.now()}`);
  await page.getByTestId("return-order-create-btn").click();
  await expect.poll(async () => await page.locator('[data-testid^="return-order-item-"]').count()).toBeGreaterThan(0);

  const productOptionValue = await page
    .locator('[data-testid="return-order-item-product-select"] option', { hasText: productNumber })
    .first()
    .getAttribute("value");
  expect(productOptionValue).toBeTruthy();

  await page.getByTestId("return-order-item-product-select").selectOption(productOptionValue!);
  await page.getByTestId("return-order-item-quantity-input").fill("1");
  await page.getByTestId("return-order-item-decision-select").selectOption("scrap");
  await page.getByTestId("return-order-item-add-btn").click();
  await expect(page.getByTestId("return-order-items-list")).toContainText("Verschrotten");

  await page.getByTestId("return-order-status-received").click();
  await page.getByTestId("return-order-status-inspected").click();
  await page.getByTestId("return-order-status-resolved").click();

  await expect(page.getByTestId("returns-page")).toContainText("Aktueller Status");
  await expect(page.getByTestId("returns-page")).toContainText("RESOLVED");
});

test("returns flow supports external repair dispatch and receive", async ({ page, request }) => {
  test.slow();
  const token = await loginAsAdminApi(request);
  const headers = { Authorization: `Bearer ${token}` };
  const productNumber = await ensureE2EProduct(request, token, `000-E2E-RT-EXT-${Date.now()}`);
  const location = await seedWarehouseZoneBin(request, token, "E2ERT");
  const sourceReference = `TECH-${Date.now()}`;

  await loginAndOpenRoute(page, "/returns", { rootTestId: "returns-page" });

  await page.getByTestId("return-order-source-type-select").selectOption("technician");
  await page.getByTestId("return-order-source-reference-input").fill(sourceReference);
  await page.getByTestId("return-order-create-btn").click();
  await expect.poll(async () => await page.locator('[data-testid^="return-order-item-"]').count()).toBeGreaterThan(0);

  const productOptionValue = await page
    .locator('[data-testid="return-order-item-product-select"] option', { hasText: productNumber })
    .first()
    .getAttribute("value");
  expect(productOptionValue).toBeTruthy();

  await page.getByTestId("return-order-item-product-select").selectOption(productOptionValue!);
  await page.getByTestId("return-order-item-quantity-input").fill("1");
  await page.getByTestId("return-order-item-decision-select").selectOption("repair");
  await page.getByTestId("return-order-item-repair-mode-select").selectOption("external");
  await page.getByTestId("return-order-item-external-partner-input").fill("Spain Provider");
  await page.getByTestId("return-order-target-warehouse-select").selectOption(String(location.warehouseId));
  await expect
    .poll(
      async () =>
        await page.getByTestId("return-order-target-zone-select").locator(`option[value="${location.zoneId}"]`).count(),
      { timeout: 20_000 },
    )
    .toBeGreaterThan(0);
  await page.getByTestId("return-order-target-zone-select").selectOption(String(location.zoneId));
  await expect
    .poll(
      async () =>
        await page.getByTestId("return-order-target-bin-select").locator(`option[value="${location.binId}"]`).count(),
      { timeout: 20_000 },
    )
    .toBeGreaterThan(0);
  await page.getByTestId("return-order-target-bin-select").selectOption(String(location.binId));
  await page.getByTestId("return-order-item-add-btn").click();

  const statusNode = page.locator('[data-testid^="return-order-item-external-status-"]').first();
  await expect
    .poll(async () => await statusNode.textContent(), { timeout: 20_000 })
    .toContain("waiting_external_provider");

  let orderId: number | null = null;
  await waitForApiCondition({
    description: "resolve return order id by source reference",
    timeoutMs: 30_000,
    fetchValue: async () =>
      await waitForApiResponseJson<Array<{ id: number; source_reference: string | null }>>({
        request,
        url: "/api/return-orders",
        headers,
        description: "poll return orders",
      }),
    predicate: (orders) => {
      const match = orders.find((order) => order.source_reference === sourceReference);
      if (match) {
        orderId = match.id;
        return true;
      }
      return false;
    },
  });
  expect(orderId).toBeTruthy();

  let itemId: number | null = null;
  await waitForApiCondition({
    description: "resolve external repair item id",
    timeoutMs: 30_000,
    fetchValue: async () =>
      await waitForApiResponseJson<Array<{ id: number; external_status: string | null }>>({
        request,
        url: `/api/return-orders/${orderId!}/items`,
        headers,
        description: "poll return order items",
      }),
    predicate: (items) => {
      const match = items.find((item) => item.external_status === "waiting_external_provider");
      if (match) {
        itemId = match.id;
        return true;
      }
      return false;
    },
  });
  expect(itemId).toBeTruthy();

  const dispatchResponse = await request.post(`/api/return-orders/${orderId!}/items/${itemId!}/dispatch-external`, {
    headers,
    data: { external_partner: "Spain Provider" },
  });
  expect(dispatchResponse.ok()).toBeTruthy();

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByTestId(`return-order-item-${orderId!}`).click();
  await expect
    .poll(async () => await statusNode.textContent(), { timeout: 20_000 })
    .toContain("at_external_provider");

  const receiveResponse = await request.post(`/api/return-orders/${orderId!}/items/${itemId!}/receive-external`, {
    headers,
    data: { target_bin_id: location.binId },
  });
  expect(receiveResponse.ok()).toBeTruthy();

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByTestId(`return-order-item-${orderId!}`).click();
  await expect
    .poll(async () => await statusNode.textContent(), { timeout: 20_000 })
    .toContain("ready_for_use");
});
