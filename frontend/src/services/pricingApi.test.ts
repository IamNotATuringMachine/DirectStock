import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
}));

vi.mock("./api", () => ({
  api: {
    get: mocks.apiGet,
    post: mocks.apiPost,
    put: mocks.apiPut,
  },
}));

import {
  createProductBasePrice,
  fetchCustomerProductPrices,
  fetchProductBasePrices,
  upsertCustomerProductPrice,
} from "./pricingApi";

describe("pricingApi", () => {
  beforeEach(() => {
    mocks.apiGet.mockReset();
    mocks.apiPost.mockReset();
    mocks.apiPut.mockReset();
  });

  it("fetches product base prices", async () => {
    mocks.apiGet.mockResolvedValueOnce({ data: { items: [{ id: 1 }] } });
    const result = await fetchProductBasePrices(10);
    expect(mocks.apiGet).toHaveBeenCalledWith("/pricing/products/10/base-prices");
    expect(result).toEqual([{ id: 1 }]);
  });

  it("passes optional product filter when loading customer prices", async () => {
    mocks.apiGet.mockResolvedValueOnce({ data: { items: [] } });
    await fetchCustomerProductPrices(5, 9);
    expect(mocks.apiGet).toHaveBeenCalledWith("/pricing/customers/5/product-prices", {
      params: { product_id: 9 },
    });
  });

  it("creates and upserts prices through expected endpoints", async () => {
    const payload = { net_price: "10.00", vat_rate: "19", valid_from: "2026-01-01T00:00:00Z" };
    mocks.apiPost.mockResolvedValueOnce({ data: { id: 7 } });
    mocks.apiPut.mockResolvedValueOnce({ data: { id: 8 } });

    const created = await createProductBasePrice(2, payload);
    expect(mocks.apiPost).toHaveBeenCalledWith("/pricing/products/2/base-prices", payload);
    expect(created).toEqual({ id: 7 });

    const upserted = await upsertCustomerProductPrice(3, 2, payload);
    expect(mocks.apiPut).toHaveBeenCalledWith("/pricing/customers/3/product-prices/2", payload);
    expect(upserted).toEqual({ id: 8 });
  });
});

