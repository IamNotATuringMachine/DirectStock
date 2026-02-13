import { expect, type APIRequestContext } from "@playwright/test";

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

export async function loginAsAdminApi(request: APIRequestContext): Promise<string> {
  const response = await request.post("/api/auth/login", {
    data: {
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD,
    },
  });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as { access_token: string };
  return payload.access_token;
}

export async function ensureE2EProduct(
  request: APIRequestContext,
  token: string,
  productNumber = E2E_PRODUCT_NUMBER
): Promise<string> {
  const headers = { Authorization: `Bearer ${token}` };

  const existing = await request.get(`/api/products?search=${encodeURIComponent(productNumber)}&page_size=200`, {
    headers,
  });
  expect(existing.ok()).toBeTruthy();
  const existingPayload = (await existing.json()) as ProductListResponse;
  if (existingPayload.items.some((item) => item.product_number === productNumber)) {
    return productNumber;
  }

  const groupsResponse = await request.get("/api/product-groups", { headers });
  expect(groupsResponse.ok()).toBeTruthy();
  const groups = (await groupsResponse.json()) as Array<{ id: number; name: string }>;

  let groupId = groups.find((group) => group.name === E2E_GROUP_NAME)?.id;
  if (!groupId) {
    const createGroup = await request.post("/api/product-groups", {
      headers,
      data: {
        name: E2E_GROUP_NAME,
        description: "Playwright E2E test group",
      },
    });
    if (createGroup.ok()) {
      groupId = ((await createGroup.json()) as { id: number }).id;
    } else if (createGroup.status() === 409) {
      const refreshGroups = await request.get("/api/product-groups", { headers });
      expect(refreshGroups.ok()).toBeTruthy();
      const refreshed = (await refreshGroups.json()) as Array<{ id: number; name: string }>;
      groupId = refreshed.find((group) => group.name === E2E_GROUP_NAME)?.id;
    } else {
      expect(createGroup.ok()).toBeTruthy();
    }
  }

  expect(groupId).toBeTruthy();

  const createProduct = await request.post("/api/products", {
    headers,
    data: {
      product_number: productNumber,
      name: "Playwright E2E Produkt",
      description: "Für E2E Smoke-Flow",
      product_group_id: groupId,
      unit: "piece",
      status: "active",
    },
  });
  if (!createProduct.ok() && createProduct.status() !== 409) {
    expect(createProduct.ok()).toBeTruthy();
  }

  return productNumber;
}

export async function getInventoryQuantityForProduct(
  request: APIRequestContext,
  token: string,
  productNumber: string
): Promise<{ raw: string; numeric: number }> {
  const response = await request.get(
    `/api/inventory?search=${encodeURIComponent(productNumber)}&page_size=200`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  expect(response.ok()).toBeTruthy();

  const payload = (await response.json()) as InventoryListResponse;
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
  supplierNumber = E2E_SUPPLIER_NUMBER
): Promise<{ id: number; supplier_number: string }> {
  const headers = { Authorization: `Bearer ${token}` };

  const existing = await request.get(`/api/suppliers?search=${encodeURIComponent(supplierNumber)}&page_size=200`, {
    headers,
  });
  expect(existing.ok()).toBeTruthy();
  const existingPayload = (await existing.json()) as {
    items: Array<{ id: number; supplier_number: string }>;
  };
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
  expect(created.ok()).toBeTruthy();
  const payload = (await created.json()) as { id: number; supplier_number: string };
  return payload;
}

export async function ensureE2EInventoryStock(
  request: APIRequestContext,
  token: string,
  productNumber = E2E_PRODUCT_NUMBER
): Promise<{ productNumber: string; binId: number; warehouseId: number }> {
  const headers = { Authorization: `Bearer ${token}` };
  const ensuredProductNumber = await ensureE2EProduct(request, token, productNumber);

  const products = await request.get(`/api/products?search=${encodeURIComponent(ensuredProductNumber)}&page_size=200`, {
    headers,
  });
  expect(products.ok()).toBeTruthy();
  const productPayload = (await products.json()) as ProductListResponse;
  const product = productPayload.items.find((item) => item.product_number === ensuredProductNumber);
  expect(product).toBeTruthy();

  const unique = Date.now().toString().slice(-8);
  const createWarehouse = await request.post("/api/warehouses", {
    headers,
    data: {
      code: `E2EIC${unique}`,
      name: `E2E Inventory Count ${unique}`,
      is_active: true,
    },
  });
  expect(createWarehouse.ok()).toBeTruthy();
  const warehouse = (await createWarehouse.json()) as { id: number; code: string };

  const createZone = await request.post(`/api/warehouses/${warehouse.id}/zones`, {
    headers,
    data: {
      code: `E2EZ${unique}`,
      name: `E2E Zone ${unique}`,
      zone_type: "storage",
      is_active: true,
    },
  });
  expect(createZone.ok()).toBeTruthy();
  const zone = (await createZone.json()) as { id: number; code: string };

  const createBin = await request.post(`/api/zones/${zone.id}/bins`, {
    headers,
    data: {
      code: `E2EB${unique}`,
      bin_type: "storage",
      is_active: true,
    },
  });
  expect(createBin.ok()).toBeTruthy();
  const bin = (await createBin.json()) as { id: number; code: string };

  const receipt = await request.post("/api/goods-receipts", {
    headers,
    data: {
      notes: `E2E inventory count seed ${Date.now()}`,
    },
  });
  expect(receipt.ok()).toBeTruthy();
  const receiptPayload = (await receipt.json()) as { id: number };

  const item = await request.post(`/api/goods-receipts/${receiptPayload.id}/items`, {
    headers,
    data: {
      product_id: product!.id,
      received_quantity: "2",
      unit: "piece",
      target_bin_id: bin.id,
    },
  });
  expect(item.ok()).toBeTruthy();

  const complete = await request.post(`/api/goods-receipts/${receiptPayload.id}/complete`, {
    headers,
  });
  expect(complete.ok()).toBeTruthy();

  return { productNumber: ensuredProductNumber, binId: bin.id, warehouseId: warehouse.id };
}
