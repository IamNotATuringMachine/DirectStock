import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: false,
});

let getAccessToken: (() => string | null) | null = null;
let getRefreshToken: (() => string | null) | null = null;
let setTokens: ((accessToken: string, refreshToken: string) => void) | null = null;
let clearTokens: (() => void) | null = null;

export function registerAuthBridge(bridge: {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  setTokens: (accessToken: string, refreshToken: string) => void;
  clearTokens: () => void;
}) {
  getAccessToken = bridge.getAccessToken;
  getRefreshToken = bridge.getRefreshToken;
  setTokens = bridge.setTokens;
  clearTokens = bridge.clearTokens;
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken?.();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (!original || original._retry || error.response?.status !== 401) {
      throw error;
    }

    const refreshToken = getRefreshToken?.();
    if (!refreshToken) {
      clearTokens?.();
      throw error;
    }

    try {
      original._retry = true;
      const response = await axios.post(`${API_BASE}/auth/refresh`, { refresh_token: refreshToken });
      const payload = response.data as { access_token: string; refresh_token: string };
      setTokens?.(payload.access_token, payload.refresh_token);
      original.headers = original.headers ?? {};
      original.headers.Authorization = `Bearer ${payload.access_token}`;
      return await api.request(original);
    } catch (refreshError) {
      clearTokens?.();
      throw refreshError;
    }
  }
);
