import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiPost: vi.fn(),
  apiPut: vi.fn(),
}));

vi.mock("./api", () => ({
  api: {
    post: mocks.apiPost,
    put: mocks.apiPut,
  },
}));

import { createSalesOrder, updateSalesOrder } from "./salesOrdersApi";

describe("salesOrdersApi", () => {
  beforeEach(() => {
    mocks.apiPost.mockReset();
    mocks.apiPut.mockReset();
  });

  it("createSalesOrder forwards optional customer location", async () => {
    const payload = {
      customer_id: 3,
      customer_location_id: 9,
      items: [],
    };
    mocks.apiPost.mockResolvedValueOnce({ data: { order: { id: 1 }, items: [] } });

    await createSalesOrder(payload);

    expect(mocks.apiPost).toHaveBeenCalledWith("/sales-orders", payload);
  });

  it("updateSalesOrder forwards optional customer location", async () => {
    const payload = { customer_location_id: 11 };
    mocks.apiPut.mockResolvedValueOnce({ data: { id: 5 } });

    await updateSalesOrder(5, payload);

    expect(mocks.apiPut).toHaveBeenCalledWith("/sales-orders/5", payload);
  });
});
