import { api } from "./api";
import type { ThemePreference } from "../types";

export async function fetchMyUiPreferences(): Promise<ThemePreference> {
  const response = await api.get<ThemePreference>("/ui-preferences/me");
  return response.data;
}

export async function updateMyUiPreferences(payload: ThemePreference): Promise<ThemePreference> {
  const response = await api.put<ThemePreference>("/ui-preferences/me", payload);
  return response.data;
}
