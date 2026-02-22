import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
}));

vi.mock("./api", () => ({
  api: {
    get: mocks.apiGet,
    post: mocks.apiPost,
    put: mocks.apiPut,
    delete: mocks.apiDelete,
  },
}));

import { createSupplier, deleteSupplier, fetchSuppliers, updateSupplier } from "./suppliersApi";

describe("suppliersApi", () => {
  beforeEach(() => {
    mocks.apiGet.mockReset();
    mocks.apiPost.mockReset();
    mocks.apiPut.mockReset();
    mocks.apiDelete.mockReset();
  });

  it("fetchSuppliers maps params to backend contract", async () => {
    mocks.apiGet.mockResolvedValueOnce({ data: { items: [], total: 0, page: 1, page_size: 200 } });

    await fetchSuppliers({ page: 2, pageSize: 50, search: "acme", isActive: true });

    expect(mocks.apiGet).toHaveBeenCalledWith("/suppliers", {
      params: {
        page: 2,
        page_size: 50,
        search: "acme",
        is_active: true,
      },
    });
  });

  it("createSupplier posts payload to suppliers endpoint", async () => {
    const payload = {
      supplier_number: "SUP-1000",
      company_name: "Acme GmbH",
      email: "bestellung@acme.example",
      is_active: true,
    };
    mocks.apiPost.mockResolvedValueOnce({ data: { id: 1, ...payload } });

    await createSupplier(payload);

    expect(mocks.apiPost).toHaveBeenCalledWith("/suppliers", payload);
  });

  it("updateSupplier targets supplier-specific endpoint", async () => {
    const payload = {
      company_name: "Acme Updated GmbH",
      contact_name: "Einkauf Team",
    };
    mocks.apiPut.mockResolvedValueOnce({ data: { id: 9, supplier_number: "SUP-9", ...payload } });

    await updateSupplier(9, payload);

    expect(mocks.apiPut).toHaveBeenCalledWith("/suppliers/9", payload);
  });

  it("deleteSupplier calls supplier-specific delete endpoint", async () => {
    mocks.apiDelete.mockResolvedValueOnce({});

    await deleteSupplier(11);

    expect(mocks.apiDelete).toHaveBeenCalledWith("/suppliers/11");
  });
});
