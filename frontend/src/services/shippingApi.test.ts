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

import { createShipment, createShipmentLabel, downloadDocument, fetchShipments } from "./shippingApi";

describe("shippingApi", () => {
  beforeEach(() => {
    mocks.apiGet.mockReset();
    mocks.apiPost.mockReset();
  });

  it("fetchShipments forwards optional status/carrier params", async () => {
    mocks.apiGet.mockResolvedValueOnce({ data: [] });

    await fetchShipments({ status: "draft", carrier: "dhl" });

    expect(mocks.apiGet).toHaveBeenCalledWith("/shipments", {
      params: { status: "draft", carrier: "dhl" },
    });
  });

  it("createShipmentLabel calls the shipment label endpoint", async () => {
    mocks.apiPost.mockResolvedValueOnce({ data: { id: 10 } });

    await createShipmentLabel(10);

    expect(mocks.apiPost).toHaveBeenCalledWith("/shipments/10/create-label");
  });

  it("createShipment forwards customer and location linkage fields", async () => {
    const payload = {
      carrier: "dhl" as const,
      customer_id: 12,
      customer_location_id: 44,
      recipient_name: "Musterkunde",
    };
    mocks.apiPost.mockResolvedValueOnce({ data: { id: 3 } });

    await createShipment(payload);

    expect(mocks.apiPost).toHaveBeenCalledWith("/shipments", payload);
  });

  it("downloadDocument requests blob response type", async () => {
    const blob = new Blob(["test"], { type: "application/pdf" });
    mocks.apiGet.mockResolvedValueOnce({ data: blob });

    const result = await downloadDocument(5);

    expect(mocks.apiGet).toHaveBeenCalledWith("/documents/5/download", {
      responseType: "blob",
    });
    expect(result).toBe(blob);
  });
});
