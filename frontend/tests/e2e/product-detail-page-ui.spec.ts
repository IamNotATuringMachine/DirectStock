import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { createE2EUserWithRoles } from "./helpers/api";

type ClientErrors = {
  pageErrors: string[];
  consoleErrors: string[];
};

function collectClientErrors(page: Page): ClientErrors {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on("pageerror", (error) => {
    pageErrors.push(String(error));
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  return { pageErrors, consoleErrors };
}

async function assertNoClientErrors(errors: ClientErrors): Promise<void> {
  await expect(errors.pageErrors, `Unexpected page errors: ${errors.pageErrors.join(" | ")}`).toEqual([]);
  await expect(errors.consoleErrors, `Unexpected console errors: ${errors.consoleErrors.join(" | ")}`).toEqual([]);
}

async function loginApi(request: APIRequestContext, username: string, password: string): Promise<string> {
  const response = await request.post("/api/auth/login", {
    data: { username, password },
  });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as { access_token: string };
  return payload.access_token;
}

async function ensureProductGroup(request: APIRequestContext, token: string, groupName: string): Promise<number> {
  const headers = { Authorization: `Bearer ${token}` };
  const listResponse = await request.get("/api/product-groups", { headers });
  expect(listResponse.ok()).toBeTruthy();
  const groups = (await listResponse.json()) as Array<{ id: number; name: string }>;
  const existing = groups.find((group) => group.name === groupName);
  if (existing) {
    return existing.id;
  }

  const createResponse = await request.post("/api/product-groups", {
    headers,
    data: {
      name: groupName,
      description: `E2E product detail group ${groupName}`,
    },
  });
  if (createResponse.ok()) {
    const created = (await createResponse.json()) as { id: number };
    return created.id;
  }

  expect(createResponse.status()).toBe(409);
  const refreshed = await request.get("/api/product-groups", { headers });
  expect(refreshed.ok()).toBeTruthy();
  const refreshedGroups = (await refreshed.json()) as Array<{ id: number; name: string }>;
  const refreshedMatch = refreshedGroups.find((group) => group.name === groupName);
  expect(refreshedMatch).toBeTruthy();
  return refreshedMatch!.id;
}

async function createProduct(
  request: APIRequestContext,
  token: string,
  payload: {
    product_number: string;
    name: string;
    description: string;
    product_group_id: number;
  }
): Promise<number> {
  const response = await request.post("/api/products", {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      ...payload,
      unit: "piece",
      status: "active",
    },
  });
  expect(response.ok()).toBeTruthy();
  const created = (await response.json()) as { id: number };
  return created.id;
}

async function createBasePrice(request: APIRequestContext, token: string, productId: number, netPrice: string): Promise<void> {
  const response = await request.post(`/api/pricing/products/${productId}/base-prices`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      net_price: netPrice,
      vat_rate: "19",
      currency: "EUR",
      is_active: true,
    },
  });
  expect(response.ok()).toBeTruthy();
}

async function loginAndOpenProductDetail(page: Page, username: string, password: string, productId: number): Promise<void> {
  await page.goto("/login");
  await page.getByTestId("login-username").fill(username);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto(`/products/${productId}`);
  await expect(page).toHaveURL(new RegExp(`/products/${productId}$`));
  await expect(page.getByTestId("product-detail-page")).toBeVisible();
}

test.describe("product detail pricing summary", () => {
  test("shows resolved base price and fallback when no price exists", async ({ page, request }) => {
    const errors = collectClientErrors(page);
    const user = await createE2EUserWithRoles(request, ["admin"]);
    const token = await loginApi(request, user.username, user.password);
    const marker = `${Date.now()}${Math.floor(Math.random() * 10_000)
      .toString()
      .padStart(4, "0")}`;

    const groupId = await ensureProductGroup(request, token, `E2E-PD-GROUP-${marker}`);
    const pricedProductId = await createProduct(request, token, {
      product_number: `E2E-PD-${marker}-PRICE`,
      name: `E2E Product Detail Priced ${marker}`,
      description: `Seeded priced product ${marker}`,
      product_group_id: groupId,
    });
    const noPriceProductId = await createProduct(request, token, {
      product_number: `E2E-PD-${marker}-NOPRICE`,
      name: `E2E Product Detail NoPrice ${marker}`,
      description: `Seeded product without price ${marker}`,
      product_group_id: groupId,
    });

    await createBasePrice(request, token, pricedProductId, "12.00");

    await loginAndOpenProductDetail(page, user.username, user.password, pricedProductId);
    await expect(page.getByTestId("product-detail-price-summary")).toBeVisible();
    await expect(page.getByTestId("product-detail-price-summary")).toContainText("Netto:");
    await expect(page.getByTestId("product-detail-price-summary")).toContainText("12.00 EUR");
    await expect(page.getByTestId("product-detail-price-summary")).toContainText("USt:");
    await expect(page.getByTestId("product-detail-price-summary")).toContainText("19.00%");
    await expect(page.getByTestId("product-detail-price-summary")).toContainText("Brutto:");
    await expect(page.getByTestId("product-detail-price-summary")).toContainText("14.28 EUR");

    await page.goto(`/products/${noPriceProductId}`);
    await expect(page.getByTestId("product-detail-page")).toBeVisible();
    await expect(page.getByTestId("product-detail-price-summary")).toContainText("Kein Preis hinterlegt");

    await assertNoClientErrors(errors);
  });
});
