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

import {
  createOperator,
  deleteOperator,
  fetchOperationSignoffSettings,
  fetchOperators,
  unlockOperator,
  updateOperationSignoffSettings,
  updateOperator,
} from "./operatorsApi";

describe("operatorsApi", () => {
  beforeEach(() => {
    mocks.apiGet.mockReset();
    mocks.apiPost.mockReset();
    mocks.apiPut.mockReset();
    mocks.apiDelete.mockReset();
  });

  it("loads operator list from operators endpoint", async () => {
    mocks.apiGet.mockResolvedValueOnce({ data: [] });

    await fetchOperators();

    expect(mocks.apiGet).toHaveBeenCalledWith("/operators");
  });

  it("creates and updates operators with expected payloads", async () => {
    const createPayload = { display_name: "Test Operator", pin: "1234", pin_enabled: true };
    const updatePayload = { is_active: false };
    mocks.apiPost.mockResolvedValueOnce({ data: { id: 1 } });
    mocks.apiPut.mockResolvedValueOnce({ data: { id: 1 } });

    await createOperator(createPayload);
    await updateOperator(1, updatePayload);

    expect(mocks.apiPost).toHaveBeenCalledWith("/operators", createPayload);
    expect(mocks.apiPut).toHaveBeenCalledWith("/operators/1", updatePayload);
  });

  it("unlocks operator and updates signoff settings", async () => {
    mocks.apiPost.mockResolvedValueOnce({ data: { session_token: "token" } });
    mocks.apiPut.mockResolvedValueOnce({ data: { require_pin: true } });
    mocks.apiGet.mockResolvedValueOnce({ data: { require_pin: false, require_operator_selection: true } });

    await unlockOperator("9876");
    await fetchOperationSignoffSettings();
    await updateOperationSignoffSettings({
      require_pin: true,
      require_operator_selection: false,
      pin_session_ttl_minutes: 60,
    });

    expect(mocks.apiPost).toHaveBeenCalledWith("/operators/unlock", { pin: "9876" });
    expect(mocks.apiGet).toHaveBeenCalledWith("/operators/signoff-settings");
    expect(mocks.apiPut).toHaveBeenCalledWith("/operators/signoff-settings", {
      require_pin: true,
      require_operator_selection: false,
      pin_session_ttl_minutes: 60,
    });
  });

  it("deletes operator via operator specific endpoint", async () => {
    mocks.apiDelete.mockResolvedValueOnce({ data: { message: "operator deleted" } });

    await deleteOperator(9);

    expect(mocks.apiDelete).toHaveBeenCalledWith("/operators/9");
  });
});
