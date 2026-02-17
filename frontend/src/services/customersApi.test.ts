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

import { createCustomerLocation, fetchCustomerLocations } from "./customersApi";

describe("customersApi", () => {
  beforeEach(() => {
    mocks.apiGet.mockReset();
    mocks.apiPost.mockReset();
  });

  it("fetchCustomerLocations calls locations endpoint with active filter", async () => {
    mocks.apiGet.mockResolvedValueOnce({ data: { items: [] } });

    await fetchCustomerLocations(42, { isActive: true });

    expect(mocks.apiGet).toHaveBeenCalledWith("/customers/42/locations", {
      params: {
        is_active: true,
      },
    });
  });

  it("createCustomerLocation posts payload to scoped endpoint", async () => {
    const payload = {
      location_code: "LOC-1",
      name: "Koblenz",
      city: "Koblenz",
    };
    mocks.apiPost.mockResolvedValueOnce({ data: { id: 1, ...payload } });

    await createCustomerLocation(7, payload);

    expect(mocks.apiPost).toHaveBeenCalledWith("/customers/7/locations", payload);
  });
});
