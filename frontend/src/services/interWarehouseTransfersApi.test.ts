import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

vi.mock("./api", () => ({
  api: {
    get: mocks.apiGet,
    post: mocks.apiPost,
  },
}));

import {
  createInterWarehouseTransferItem,
  dispatchInterWarehouseTransfer,
  fetchInterWarehouseTransfer,
} from "./interWarehouseTransfersApi";

describe("interWarehouseTransfersApi", () => {
  beforeEach(() => {
    mocks.apiGet.mockReset();
    mocks.apiPost.mockReset();
  });

  it("fetchInterWarehouseTransfer calls detail endpoint", async () => {
    mocks.apiGet.mockResolvedValueOnce({ data: { transfer: {}, items: [] } });

    await fetchInterWarehouseTransfer(12);

    expect(mocks.apiGet).toHaveBeenCalledWith("/inter-warehouse-transfers/12");
  });

  it("createInterWarehouseTransferItem posts payload to item endpoint", async () => {
    mocks.apiPost.mockResolvedValueOnce({ data: { id: 1 } });
    const payload = {
      product_id: 1,
      from_bin_id: 2,
      to_bin_id: 3,
      requested_quantity: "5",
      unit: "piece",
      batch_number: null,
      serial_numbers: null,
    };

    await createInterWarehouseTransferItem(7, payload);

    expect(mocks.apiPost).toHaveBeenCalledWith("/inter-warehouse-transfers/7/items", payload);
  });

  it("dispatchInterWarehouseTransfer calls dispatch endpoint", async () => {
    mocks.apiPost.mockResolvedValueOnce({ data: { message: "ok" } });

    await dispatchInterWarehouseTransfer(9);

    expect(mocks.apiPost).toHaveBeenCalledWith("/inter-warehouse-transfers/9/dispatch");
  });
});
