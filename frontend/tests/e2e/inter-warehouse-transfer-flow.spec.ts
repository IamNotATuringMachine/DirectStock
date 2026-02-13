import { expect, test } from "@playwright/test";

import { ensureE2EInventoryStock, loginAsAdminApi } from "./helpers/api";

test("inter-warehouse transfer flow supports draft dispatch and receive", async ({ page, request }) => {
  const token = await loginAsAdminApi(request);
  const seeded = await ensureE2EInventoryStock(request, token, `E2E-IWT-${Date.now()}`);
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

  const suffix = Date.now().toString().slice(-8);
  const targetWarehouseResponse = await request.post("/api/warehouses", {
    headers,
    data: {
      code: `E2EWT${suffix}`,
      name: `E2E Transfer Target ${suffix}`,
      is_active: true,
    },
  });
  expect(targetWarehouseResponse.ok()).toBeTruthy();
  const targetWarehouse = (await targetWarehouseResponse.json()) as { id: number };

  const targetZoneResponse = await request.post(`/api/warehouses/${targetWarehouse.id}/zones`, {
    headers,
    data: {
      code: `E2EWZ${suffix}`,
      name: `E2E Zone ${suffix}`,
      zone_type: "storage",
      is_active: true,
    },
  });
  expect(targetZoneResponse.ok()).toBeTruthy();
  const targetZone = (await targetZoneResponse.json()) as { id: number };

  const targetBinResponse = await request.post(`/api/zones/${targetZone.id}/bins`, {
    headers,
    data: {
      code: `E2EWB${suffix}`,
      bin_type: "storage",
      is_active: true,
    },
  });
  expect(targetBinResponse.ok()).toBeTruthy();
  const targetBin = (await targetBinResponse.json()) as { id: number };

  await page.goto("/login");
  await page.getByTestId("login-username").fill(process.env.E2E_ADMIN_USERNAME ?? "admin");
  await page.getByTestId("login-password").fill(process.env.E2E_ADMIN_PASSWORD ?? "DirectStock2026!");
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/inter-warehouse-transfer");
  await expect(page.getByTestId("inter-warehouse-transfer-page")).toBeVisible();

  await page.getByTestId("iwt-from-warehouse-select").selectOption(String(seeded.warehouseId));
  await page.getByTestId("iwt-to-warehouse-select").selectOption(String(targetWarehouse.id));
  await page.getByTestId("iwt-notes-input").fill(`E2E inter warehouse transfer ${Date.now()}`);
  await page.getByTestId("iwt-create-btn").click();

  await expect.poll(async () => await page.locator('[data-testid^="iwt-item-"]').count()).toBeGreaterThan(0);
  await expect(page.getByTestId("iwt-selected-status")).toContainText("draft");
  await expect
    .poll(async () => await page.getByTestId("iwt-product-select").locator("option").count())
    .toBeGreaterThan(0);

  await page.getByTestId("iwt-product-select").selectOption(String(product!.id));
  await page.getByTestId("iwt-from-bin-select").selectOption(String(seeded.binId));
  await page.getByTestId("iwt-to-bin-select").selectOption(String(targetBin.id));
  await page.getByTestId("iwt-qty-input").fill("1");
  await page.getByTestId("iwt-add-item-btn").click();

  await expect(page.getByTestId("iwt-items-table")).toContainText(String(product!.id));

  await page.getByTestId("iwt-dispatch-btn").click();
  await expect(page.getByTestId("iwt-selected-status")).toContainText("dispatched");

  await page.getByTestId("iwt-receive-btn").click();
  await expect(page.getByTestId("iwt-selected-status")).toContainText("received");

  await expect
    .poll(
      async () => {
        const inventoryResponse = await request.get(`/api/inventory/by-bin/${targetBin.id}`, { headers });
        if (!inventoryResponse.ok()) {
          return 0;
        }
        const payload = (await inventoryResponse.json()) as Array<{
          product_id: number;
          quantity: string;
        }>;
        const row = payload.find((item) => item.product_id === product!.id);
        return Number(row?.quantity ?? "0");
      },
      { timeout: 15_000 }
    )
    .toBeGreaterThanOrEqual(1);
});
