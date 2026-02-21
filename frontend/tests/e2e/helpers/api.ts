import { expect, type APIRequestContext, type APIResponse } from "@playwright/test";

const ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME ?? "admin";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "DirectStock2026!";
const E2E_GROUP_NAME = process.env.E2E_GROUP_NAME ?? "E2E Gruppe";
const E2E_PRODUCT_NUMBER = process.env.E2E_PRODUCT_NUMBER ?? "E2E-ART-9001";
const E2E_SUPPLIER_NUMBER = process.env.E2E_SUPPLIER_NUMBER ?? "E2E-SUP-9001";

type ProductListResponse = {
  items: Array<{
    id: number;
    product_number: string;
    name: string;
  }>;
};

type InventoryListResponse = {
  items: Array<{
    product_number: string;
    total_quantity: string;
  }>;
};

function has2xxStatus(response: APIResponse): boolean {
  return response.status() >= 200 && response.status() < 300;
}

export async function assertOkJson<T>(response: APIResponse, schemaHint: string): Promise<T> {
  const status = response.status();
  const bodyText = await response.text();

  expect(status, `${schemaHint}: expected HTTP 2xx but got ${status}. Body: ${bodyText}`).toBeGreaterThanOrEqual(200);
  expect(status, `${schemaHint}: expected HTTP 2xx but got ${status}. Body: ${bodyText}`).toBeLessThan(300);

  if (!bodyText.trim()) {
    return {} as T;
  }

  try {
    return JSON.parse(bodyText) as T;
  } catch (error) {
    throw new Error(`${schemaHint}: response was not valid JSON. Body: ${bodyText}. Error: ${String(error)}`);
  }
}

export async function loginAsAdminApi(request: APIRequestContext): Promise<string> {
  const response = await request.post("/api/auth/login", {
    data: {
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD,
    },
  });
  const payload = await assertOkJson<{ access_token: string }>(response, "login as admin");
  expect(payload.access_token, "login as admin: access_token is missing").toBeDefined();
  return payload.access_token;
}

export async function createE2EUserWithRoles(
  request: APIRequestContext,
  roles: string[],
): Promise<{ username: string; password: string }> {
  const adminToken = await loginAsAdminApi(request);
  const marker = `${Date.now()}${Math.floor(Math.random() * 10_000)
    .toString()
    .padStart(4, "0")}`;
  const username = `e2e_ui_${marker}`;
  const password = `E2eUiPass!${marker.slice(-6)}`;

  const createUser = await request.post("/api/users", {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      username,
      email: `${username}@example.com`,
      full_name: "E2E UI User",
      password,
      roles,
      is_active: true,
    },
  });
  await assertOkJson(createUser, "create e2e user with roles");

  return { username, password };
}

export async function ensureDashboardCardVisible(
  request: APIRequestContext,
  token: string,
  cardKey: string,
): Promise<void> {
  const current = await request.get("/api/dashboard/config/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await assertOkJson<{
    cards: Array<{ card_key: string; visible: boolean; display_order: number }>;
  }>(current, "get dashboard config");

  const cards = payload.cards.map((card) =>
    card.card_key === cardKey ? { ...card, visible: true } : card,
  );

  const update = await request.put("/api/dashboard/config/me", {
    headers: { Authorization: `Bearer ${token}` },
    data: { cards },
  });
  await assertOkJson(update, "update dashboard config");
}

export async function ensureE2EProduct(
  request: APIRequestContext,
  token: string,
  productNumber = E2E_PRODUCT_NUMBER,
  options?: { requiresItemTracking?: boolean },
): Promise<string> {
  const headers = { Authorization: `Bearer ${token}` };

  const existing = await request.get(`/api/products?search=${encodeURIComponent(productNumber)}&page_size=200`, {
    headers,
  });
  const existingPayload = await assertOkJson<ProductListResponse>(existing, "lookup e2e product");

  if (existingPayload.items.some((item) => item.product_number === productNumber)) {
    return productNumber;
  }

  const groupsResponse = await request.get("/api/product-groups", { headers });
  const groups = await assertOkJson<Array<{ id: number; name: string }>>(groupsResponse, "list product groups");

  let groupId = groups.find((group) => group.name === E2E_GROUP_NAME)?.id;
  if (!groupId) {
    const createGroup = await request.post("/api/product-groups", {
      headers,
      data: {
        name: E2E_GROUP_NAME,
        description: "Playwright E2E test group",
      },
    });

    if (has2xxStatus(createGroup)) {
      const createdGroup = await assertOkJson<{ id: number }>(createGroup, "create product group");
      groupId = createdGroup.id;
    } else if (createGroup.status() === 409) {
      const refreshGroups = await request.get("/api/product-groups", { headers });
      const refreshed = await assertOkJson<Array<{ id: number; name: string }>>(
        refreshGroups,
        "refresh product groups after conflict",
      );
      groupId = refreshed.find((group) => group.name === E2E_GROUP_NAME)?.id;
    } else {
      await assertOkJson(createGroup, "create product group unexpected status");
    }
  }

  expect(groupId, "ensure e2e product: group id is missing").toBeDefined();

  const createProduct = await request.post("/api/products", {
    headers,
    data: {
      product_number: productNumber,
      name: "Playwright E2E Produkt",
      description: "Für E2E Smoke-Flow",
      product_group_id: groupId,
      unit: "piece",
      status: "active",
      requires_item_tracking: options?.requiresItemTracking ?? false,
    },
  });

  if (!has2xxStatus(createProduct) && createProduct.status() !== 409) {
    await assertOkJson(createProduct, "create e2e product unexpected status");
  }

  return productNumber;
}

export async function getInventoryQuantityForProduct(
  request: APIRequestContext,
  token: string,
  productNumber: string,
): Promise<{ raw: string; numeric: number }> {
  const response = await request.get(
    `/api/inventory?search=${encodeURIComponent(productNumber)}&page_size=200`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  const payload = await assertOkJson<InventoryListResponse>(response, "get inventory quantity for product");
  const row = payload.items.find((item) => item.product_number === productNumber);

  if (!row) {
    return { raw: "0.000", numeric: 0 };
  }

  return {
    raw: row.total_quantity,
    numeric: Number(row.total_quantity),
  };
}

export async function ensureE2ESupplier(
  request: APIRequestContext,
  token: string,
  supplierNumber = E2E_SUPPLIER_NUMBER,
): Promise<{ id: number; supplier_number: string }> {
  const headers = { Authorization: `Bearer ${token}` };

  const existing = await request.get(`/api/suppliers?search=${encodeURIComponent(supplierNumber)}&page_size=200`, {
    headers,
  });
  const existingPayload = await assertOkJson<{
    items: Array<{ id: number; supplier_number: string }>;
  }>(existing, "lookup e2e supplier");
  const found = existingPayload.items.find((item) => item.supplier_number === supplierNumber);
  if (found) {
    return found;
  }

  const created = await request.post("/api/suppliers", {
    headers,
    data: {
      supplier_number: supplierNumber,
      company_name: "Playwright Supplier",
      contact_name: "E2E Contact",
      email: "e2e-supplier@example.com",
      is_active: true,
    },
  });
  return assertOkJson<{ id: number; supplier_number: string }>(created, "create e2e supplier");
}

export async function ensureE2EInventoryStock(
  request: APIRequestContext,
  token: string,
  productNumber = E2E_PRODUCT_NUMBER,
): Promise<{ productNumber: string; binId: number; warehouseId: number }> {
  const headers = { Authorization: `Bearer ${token}` };
  const ensuredProductNumber = await ensureE2EProduct(request, token, productNumber);

  const products = await request.get(`/api/products?search=${encodeURIComponent(ensuredProductNumber)}&page_size=200`, {
    headers,
  });
  const productPayload = await assertOkJson<ProductListResponse>(products, "lookup product for inventory stock");
  const product = productPayload.items.find((item) => item.product_number === ensuredProductNumber);
  expect(product, "ensure e2e inventory stock: seeded product not found").toBeDefined();

  let warehouse: { id: number; code: string } | null = null;
  let unique = "";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    unique = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 10_000)
      .toString()
      .padStart(4, "0")}`;
    const createWarehouse = await request.post("/api/warehouses", {
      headers,
      data: {
        code: `E2EIC${unique}`,
        name: `E2E Inventory Count ${unique}`,
        is_active: true,
      },
    });

    if (has2xxStatus(createWarehouse)) {
      warehouse = await assertOkJson<{ id: number; code: string }>(createWarehouse, "create e2e warehouse");
      break;
    }

    if (createWarehouse.status() !== 409) {
      await assertOkJson(createWarehouse, "create e2e warehouse unexpected status");
    }
  }

  expect(warehouse, "ensure e2e inventory stock: warehouse could not be created").not.toBeNull();

  const createZone = await request.post(`/api/warehouses/${warehouse!.id}/zones`, {
    headers,
    data: {
      code: `E2EZ${unique}`,
      name: `E2E Zone ${unique}`,
      zone_type: "storage",
      is_active: true,
    },
  });
  const zone = await assertOkJson<{ id: number; code: string }>(createZone, "create e2e zone");

  const createBin = await request.post(`/api/zones/${zone.id}/bins`, {
    headers,
    data: {
      code: `E2EB${unique}`,
      bin_type: "storage",
      is_active: true,
    },
  });
  const bin = await assertOkJson<{ id: number; code: string }>(createBin, "create e2e bin");

  const receipt = await request.post("/api/goods-receipts", {
    headers,
    data: {
      notes: `E2E inventory count seed ${Date.now()}`,
    },
  });
  const receiptPayload = await assertOkJson<{ id: number }>(receipt, "create goods receipt for e2e stock seed");

  const item = await request.post(`/api/goods-receipts/${receiptPayload.id}/items`, {
    headers,
    data: {
      product_id: product!.id,
      received_quantity: "2",
      unit: "piece",
      target_bin_id: bin.id,
    },
  });
  await assertOkJson(item, "create goods receipt item for e2e stock seed");

  const complete = await request.post(`/api/goods-receipts/${receiptPayload.id}/complete`, {
    headers,
  });
  await assertOkJson(complete, "complete goods receipt for e2e stock seed");

  return { productNumber: ensuredProductNumber, binId: bin.id, warehouseId: warehouse!.id };
}

export async function seedWarehouseZoneBin(
  request: APIRequestContext,
  token: string,
  markerPrefix = "E2E-LOC",
): Promise<{
  warehouseId: number;
  warehouseCode: string;
  zoneId: number;
  zoneCode: string;
  binId: number;
  binCode: string;
}> {
  const headers = { Authorization: `Bearer ${token}` };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const marker = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 10_000)
      .toString()
      .padStart(4, "0")}${attempt}`;
    const warehouseCode = `${markerPrefix.slice(0, 4).toUpperCase()}${marker}`.slice(0, 10);
    const zoneCode = `Z${marker}`.slice(0, 10);
    const binCode = `B${marker}`.slice(0, 10);

    const createWarehouse = await request.post("/api/warehouses", {
      headers,
      data: {
        code: warehouseCode,
        name: `${markerPrefix} Warehouse ${marker}`,
        is_active: true,
      },
    });
    if (!has2xxStatus(createWarehouse)) {
      if (createWarehouse.status() === 409) {
        continue;
      }
      await assertOkJson(createWarehouse, "create e2e warehouse location unexpected status");
    }
    const warehouse = await assertOkJson<{ id: number; code: string }>(
      createWarehouse,
      "create e2e warehouse location",
    );

    const createZone = await request.post(`/api/warehouses/${warehouse.id}/zones`, {
      headers,
      data: {
        code: zoneCode,
        name: `${markerPrefix} Zone ${marker}`,
        zone_type: "storage",
        is_active: true,
      },
    });
    const zone = await assertOkJson<{ id: number; code: string }>(createZone, "create e2e zone location");

    const createBin = await request.post(`/api/zones/${zone.id}/bins`, {
      headers,
      data: {
        code: binCode,
        bin_type: "storage",
        is_active: true,
      },
    });
    const bin = await assertOkJson<{ id: number; code: string }>(createBin, "create e2e bin location");

    return {
      warehouseId: warehouse.id,
      warehouseCode: warehouse.code,
      zoneId: zone.id,
      zoneCode: zone.code,
      binId: bin.id,
      binCode: bin.code,
    };
  }

  throw new Error("Could not seed warehouse/zone/bin after retries");
}

export async function createE2EPurchaseOrder(
  request: APIRequestContext,
  token: string,
  supplierId?: number,
): Promise<{ id: number; order_number: string }> {
  const response = await request.post("/api/purchase-orders", {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      supplier_id: supplierId,
      notes: `E2E purchase order ${Date.now()}`,
    },
  });
  return assertOkJson<{ id: number; order_number: string }>(response, "create e2e purchase order");
}
