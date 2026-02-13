import { api } from "./api";
import type {
  DashboardActivityToday,
  DashboardLowStock,
  DashboardRecentMovements,
  DashboardSummary,
} from "../types";

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const response = await api.get<DashboardSummary>("/dashboard/summary");
  return response.data;
}

export async function fetchDashboardRecentMovements(limit = 15): Promise<DashboardRecentMovements> {
  const response = await api.get<DashboardRecentMovements>("/dashboard/recent-movements", {
    params: { limit },
  });
  return response.data;
}

export async function fetchDashboardLowStock(): Promise<DashboardLowStock> {
  const response = await api.get<DashboardLowStock>("/dashboard/low-stock");
  return response.data;
}

export async function fetchDashboardActivityToday(): Promise<DashboardActivityToday> {
  const response = await api.get<DashboardActivityToday>("/dashboard/activity-today");
  return response.data;
}
