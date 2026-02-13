import { api } from "./api";
import type { InventoryCountItem, InventoryCountSession } from "../types";

export async function fetchInventoryCountSessions(status?: string): Promise<InventoryCountSession[]> {
  const response = await api.get<InventoryCountSession[]>("/inventory-counts", { params: { status } });
  return response.data;
}

export async function createInventoryCountSession(payload: {
  session_number?: string;
  session_type: "snapshot" | "cycle";
  warehouse_id?: number;
  tolerance_quantity?: string;
  notes?: string;
}): Promise<InventoryCountSession> {
  const response = await api.post<InventoryCountSession>("/inventory-counts", payload);
  return response.data;
}

export async function generateInventoryCountItems(
  sessionId: number,
  refreshExisting = false
): Promise<{ message: string }> {
  const response = await api.post<{ message: string }>(`/inventory-counts/${sessionId}/generate-items`, {
    refresh_existing: refreshExisting,
  });
  return response.data;
}

export async function fetchInventoryCountItems(sessionId: number): Promise<InventoryCountItem[]> {
  const response = await api.get<InventoryCountItem[]>(`/inventory-counts/${sessionId}/items`);
  return response.data;
}

export async function updateInventoryCountItem(
  sessionId: number,
  itemId: number,
  countedQuantity: string
): Promise<InventoryCountItem> {
  const response = await api.put<InventoryCountItem>(`/inventory-counts/${sessionId}/items/${itemId}`, {
    counted_quantity: countedQuantity,
  });
  return response.data;
}

export async function completeInventoryCountSession(sessionId: number): Promise<{ message: string }> {
  const response = await api.post<{ message: string }>(`/inventory-counts/${sessionId}/complete`);
  return response.data;
}

export async function fetchInventoryCountSummary(sessionId: number): Promise<{
  total: number;
  counted: number;
  recount_required: number;
}> {
  const response = await api.get<{ total: number; counted: number; recount_required: number }>(
    `/inventory-counts/${sessionId}/summary`
  );
  return response.data;
}
