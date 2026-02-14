import { api } from "./api";
import type { DashboardCardCatalogItem, DashboardConfig } from "../types";

export async function fetchDashboardCardsCatalog(): Promise<DashboardCardCatalogItem[]> {
  const response = await api.get<DashboardCardCatalogItem[]>("/dashboard/cards/catalog");
  return response.data;
}

export async function fetchMyDashboardConfig(): Promise<DashboardConfig> {
  const response = await api.get<DashboardConfig>("/dashboard/config/me");
  return response.data;
}

export async function updateMyDashboardConfig(payload: DashboardConfig): Promise<DashboardConfig> {
  const response = await api.put<DashboardConfig>("/dashboard/config/me", payload);
  return response.data;
}

export async function fetchRoleDashboardConfig(roleId: number): Promise<DashboardConfig> {
  const response = await api.get<{ role_id: number; cards: DashboardConfig["cards"] }>(`/dashboard/config/roles/${roleId}`);
  return { cards: response.data.cards };
}

export async function updateRoleDashboardConfig(roleId: number, payload: DashboardConfig): Promise<DashboardConfig> {
  const response = await api.put<{ role_id: number; cards: DashboardConfig["cards"] }>(
    `/dashboard/config/roles/${roleId}`,
    payload
  );
  return { cards: response.data.cards };
}
