import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiPost: vi.fn(),
  apiGet: vi.fn(),
  registerAuthBridge: vi.fn(),
}));

vi.mock("../services/api", () => ({
  api: {
    post: mocks.apiPost,
    get: mocks.apiGet,
  },
  registerAuthBridge: mocks.registerAuthBridge,
}));

import { useAuthStore } from "./authStore";

describe("authStore", () => {
  beforeEach(() => {
    mocks.apiPost.mockReset();
    mocks.apiGet.mockReset();

    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: false,
    });

    // Persist middleware helper available at runtime.
    (useAuthStore as unknown as { persist?: { clearStorage?: () => void } }).persist?.clearStorage?.();
    (window.localStorage as unknown as { clear?: () => void }).clear?.();
  });

  it("logs in and loads profile", async () => {
    mocks.apiPost.mockResolvedValueOnce({
      data: {
        access_token: "access-1",
        refresh_token: "refresh-1",
        token_type: "bearer",
        expires_in: 900,
      },
    });

    mocks.apiGet.mockResolvedValueOnce({
      data: {
        id: 1,
        username: "admin",
        email: "admin@example.com",
        roles: ["admin"],
        is_active: true,
      },
    });

    await useAuthStore.getState().login("admin", "DirectStock2026!");

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe("access-1");
    expect(state.refreshToken).toBe("refresh-1");
    expect(state.user?.username).toBe("admin");
  });

  it("clears state on logout", async () => {
    useAuthStore.setState({
      user: {
        id: 1,
        username: "admin",
        email: "admin@example.com",
        roles: ["admin"],
        is_active: true,
      },
      accessToken: "access-1",
      refreshToken: "refresh-1",
      isLoading: false,
    });

    mocks.apiPost.mockResolvedValueOnce({ data: { message: "logged out" } });

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.user).toBeNull();
  });

  it("fetchMe resets user when token is missing", async () => {
    useAuthStore.setState({
      user: {
        id: 1,
        username: "admin",
        email: "admin@example.com",
        roles: ["admin"],
        is_active: true,
      },
      accessToken: null,
      refreshToken: null,
      isLoading: false,
    });

    await useAuthStore.getState().fetchMe();

    expect(useAuthStore.getState().user).toBeNull();
    expect(mocks.apiGet).not.toHaveBeenCalled();
  });
});
