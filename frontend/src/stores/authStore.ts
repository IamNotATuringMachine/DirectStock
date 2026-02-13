import { create } from "zustand";
import { persist } from "zustand/middleware";

import { api, registerAuthBridge } from "../services/api";
import type { AuthUser, TokenResponse } from "../types";

type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  setTokens: (accessToken: string, refreshToken: string) => void;
  clearTokens: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: false,
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      clearTokens: () => set({ accessToken: null, refreshToken: null, user: null }),
      login: async (username: string, password: string) => {
        set({ isLoading: true });
        try {
          const response = await api.post<TokenResponse>("/auth/login", { username, password });
          set({
            accessToken: response.data.access_token,
            refreshToken: response.data.refresh_token,
          });
          await get().fetchMe();
        } finally {
          set({ isLoading: false });
        }
      },
      logout: async () => {
        try {
          await api.post("/auth/logout");
        } finally {
          get().clearTokens();
        }
      },
      fetchMe: async () => {
        const accessToken = get().accessToken;
        if (!accessToken) {
          set({ user: null });
          return;
        }
        const response = await api.get<AuthUser>("/auth/me");
        set({ user: response.data });
      },
    }),
    {
      name: "directstock-auth",
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.accessToken) {
          state.fetchMe().catch(() => state.clearTokens());
        }
      },
    }
  )
);

registerAuthBridge({
  getAccessToken: () => useAuthStore.getState().accessToken,
  getRefreshToken: () => useAuthStore.getState().refreshToken,
  setTokens: (accessToken, refreshToken) => useAuthStore.getState().setTokens(accessToken, refreshToken),
  clearTokens: () => useAuthStore.getState().clearTokens(),
});
