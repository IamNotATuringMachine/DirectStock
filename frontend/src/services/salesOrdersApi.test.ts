import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  shouldQueueOfflineMutation: vi.fn(),
  enqueueOfflineMutation: vi.fn(),
  buildQueuedMessage: vi.fn(),
}));

vi.mock("./api", () => ({
  api: {
    post: mocks.apiPost,
    put: mocks.apiPut,
  },
}));

vi.mock("./offlineQueue", () => ({
  shouldQueueOfflineMutation: mocks.shouldQueueOfflineMutation,
  enqueueOfflineMutation: mocks.enqueueOfflineMutation,
  buildQueuedMessage: mocks.buildQueuedMessage,
}));

import { completeSalesOrder, createSalesOrder, updateSalesOrder } from "./salesOrdersApi";

describe("salesOrdersApi", () => {
  beforeEach(() => {
    mocks.apiPost.mockReset();
    mocks.apiPut.mockReset();
    mocks.shouldQueueOfflineMutation.mockReset();
    mocks.enqueueOfflineMutation.mockReset();
    mocks.buildQueuedMessage.mockReset();
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

  it("completeSalesOrder posts signoff payload when online", async () => {
    const payload = { operator_id: 7, signature_payload: { strokes: [], canvas_width: 10, canvas_height: 10, captured_at: "2026-02-21T10:00:00Z" } };
    mocks.shouldQueueOfflineMutation.mockReturnValue(false);
    mocks.apiPost.mockResolvedValueOnce({ data: { message: "ok" } });

    await completeSalesOrder(7, payload);

    expect(mocks.shouldQueueOfflineMutation).toHaveBeenCalledWith("POST", "/sales-orders/7/complete");
    expect(mocks.apiPost).toHaveBeenCalledWith("/sales-orders/7/complete", payload);
  });

  it("completeSalesOrder queues when offline", async () => {
    mocks.shouldQueueOfflineMutation.mockReturnValue(true);
    mocks.buildQueuedMessage.mockReturnValue({ message: "queued" });

    const result = await completeSalesOrder(8, { operator_id: 1, signature_payload: { strokes: [], canvas_width: 1, canvas_height: 1, captured_at: "2026-02-21T10:00:00Z" } });

    expect(mocks.enqueueOfflineMutation).toHaveBeenCalledWith({
      method: "POST",
      url: "/sales-orders/8/complete",
      payload: { operator_id: 1, signature_payload: { strokes: [], canvas_width: 1, canvas_height: 1, captured_at: "2026-02-21T10:00:00Z" } },
      entityType: "sales_order_complete",
      parentEntityId: 8,
    });
    expect(result).toEqual({ message: "queued" });
  });
});
