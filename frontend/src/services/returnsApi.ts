import { api } from "./api";
import type { ReturnOrder, ReturnOrderItem } from "../types";

export async function fetchReturnOrders(): Promise<ReturnOrder[]> {
  const response = await api.get<ReturnOrder[]>("/return-orders");
  return response.data;
}

export async function createReturnOrder(payload: {
  return_number?: string;
  customer_id?: number | null;
  goods_issue_id?: number | null;
  notes?: string;
}): Promise<ReturnOrder> {
  const response = await api.post<ReturnOrder>("/return-orders", payload);
  return response.data;
}

export async function updateReturnOrderStatus(
  orderId: number,
  status: "registered" | "received" | "inspected" | "resolved" | "cancelled"
): Promise<ReturnOrder> {
  const response = await api.post<ReturnOrder>(`/return-orders/${orderId}/status`, { status });
  return response.data;
}

export async function fetchReturnOrderItems(orderId: number): Promise<ReturnOrderItem[]> {
  const response = await api.get<ReturnOrderItem[]>(`/return-orders/${orderId}/items`);
  return response.data;
}

export async function createReturnOrderItem(
  orderId: number,
  payload: {
    product_id: number;
    quantity: string;
    unit?: string;
    decision?: "restock" | "repair" | "scrap" | "return_supplier";
    target_bin_id?: number | null;
    reason?: string;
  }
): Promise<ReturnOrderItem> {
  const response = await api.post<ReturnOrderItem>(`/return-orders/${orderId}/items`, payload);
  return response.data;
}
