import { expect, type APIRequestContext } from "@playwright/test";

const ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME ?? "admin";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "DirectStock2026!";
const E2E_GROUP_NAME = process.env.E2E_GROUP_NAME ?? "E2E Gruppe";
const E2E_PRODUCT_NUMBER = process.env.E2E_PRODUCT_NUMBER ?? "E2E-ART-9001";

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
