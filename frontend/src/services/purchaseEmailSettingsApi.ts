import { api } from "./api";
import type { PurchaseEmailSettings, PurchaseEmailSettingsUpdatePayload } from "../types";

export async function fetchPurchaseEmailSettings(): Promise<PurchaseEmailSettings> {
  const response = await api.get<PurchaseEmailSettings>("/purchase-email-settings");
  return response.data;
}

export async function updatePurchaseEmailSettings(
  payload: PurchaseEmailSettingsUpdatePayload
): Promise<PurchaseEmailSettings> {
  const response = await api.put<PurchaseEmailSettings>("/purchase-email-settings", payload);
  return response.data;
}
