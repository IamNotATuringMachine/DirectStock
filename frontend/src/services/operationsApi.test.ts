import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiDelete: vi.fn(),
  shouldQueueOfflineMutation: vi.fn(),
  enqueueOfflineMutation: vi.fn(),
  buildQueuedMessage: vi.fn(),
}));

vi.mock("./api", () => ({
  api: {
    delete: mocks.apiDelete,
  },
}));

vi.mock("./offlineQueue", () => ({
  allocateLocalEntityId: vi.fn(),
  buildQueuedMessage: mocks.buildQueuedMessage,
  enqueueOfflineMutation: mocks.enqueueOfflineMutation,
  isOfflineNow: vi.fn(),
  listOfflineQueueItemsByEntity: vi.fn(),
  listOfflineQueuedEntities: vi.fn(),
  shouldQueueOfflineMutation: mocks.shouldQueueOfflineMutation,
}));

import { deleteGoodsReceipt } from "./operationsApi";

describe("operationsApi.deleteGoodsReceipt", () => {
  beforeEach(() => {
    mocks.apiDelete.mockReset();
    mocks.shouldQueueOfflineMutation.mockReset();
    mocks.enqueueOfflineMutation.mockReset();
    mocks.buildQueuedMessage.mockReset();
  });

  it("calls DELETE endpoint when not queued offline", async () => {
    mocks.shouldQueueOfflineMutation.mockReturnValue(false);
    mocks.apiDelete.mockResolvedValueOnce({ data: { message: "goods receipt deleted" } });

    const result = await deleteGoodsReceipt(42);

    expect(mocks.shouldQueueOfflineMutation).toHaveBeenCalledWith("DELETE", "/goods-receipts/42");
    expect(mocks.apiDelete).toHaveBeenCalledWith("/goods-receipts/42");
    expect(result).toEqual({ message: "goods receipt deleted" });
  });

  it("queues delete mutation when offline", async () => {
    mocks.shouldQueueOfflineMutation.mockReturnValue(true);
    mocks.buildQueuedMessage.mockReturnValue({ message: "queued" });

    const result = await deleteGoodsReceipt(7);

    expect(mocks.enqueueOfflineMutation).toHaveBeenCalledWith({
      method: "DELETE",
      url: "/goods-receipts/7",
      payload: {},
      entityType: "goods_receipt_delete",
      parentEntityId: 7,
    });
    expect(mocks.apiDelete).not.toHaveBeenCalled();
    expect(result).toEqual({ message: "queued" });
  });
});
