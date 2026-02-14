import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPut: vi.fn(),
}));

vi.mock("./api", () => ({
  api: {
    get: mocks.apiGet,
    put: mocks.apiPut,
  },
}));

import {
  fetchDashboardCardsCatalog,
  fetchMyDashboardConfig,
  fetchRoleDashboardConfig,
  updateMyDashboardConfig,
  updateRoleDashboardConfig,
} from "./dashboardConfigApi";

describe("dashboardConfigApi", () => {
  beforeEach(() => {
    mocks.apiGet.mockReset();
    mocks.apiPut.mockReset();
  });

  it("loads dashboard card catalog", async () => {
    mocks.apiGet.mockResolvedValueOnce({ data: [{ card_key: "summary", title: "Summary" }] });
    const result = await fetchDashboardCardsCatalog();
    expect(mocks.apiGet).toHaveBeenCalledWith("/dashboard/cards/catalog");
    expect(result).toEqual([{ card_key: "summary", title: "Summary" }]);
  });

  it("loads and updates own dashboard config", async () => {
    const payload = { cards: [{ card_key: "summary", visible: true, display_order: 10 }] };
    mocks.apiGet.mockResolvedValueOnce({ data: payload });
    mocks.apiPut.mockResolvedValueOnce({ data: payload });

    const loaded = await fetchMyDashboardConfig();
    expect(mocks.apiGet).toHaveBeenCalledWith("/dashboard/config/me");
    expect(loaded).toEqual(payload);

    const saved = await updateMyDashboardConfig(payload);
    expect(mocks.apiPut).toHaveBeenCalledWith("/dashboard/config/me", payload);
    expect(saved).toEqual(payload);
  });

  it("maps role dashboard config responses to dashboard config shape", async () => {
    const payload = { role_id: 12, cards: [{ card_key: "summary", visible: true, display_order: 10 }] };
    mocks.apiGet.mockResolvedValueOnce({ data: payload });
    mocks.apiPut.mockResolvedValueOnce({ data: payload });

    const loaded = await fetchRoleDashboardConfig(12);
    expect(mocks.apiGet).toHaveBeenCalledWith("/dashboard/config/roles/12");
    expect(loaded).toEqual({ cards: payload.cards });

    const updated = await updateRoleDashboardConfig(12, { cards: payload.cards });
    expect(mocks.apiPut).toHaveBeenCalledWith("/dashboard/config/roles/12", { cards: payload.cards });
    expect(updated).toEqual({ cards: payload.cards });
  });
});

