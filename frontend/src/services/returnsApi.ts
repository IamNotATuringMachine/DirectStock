import { api } from "./api";
import type {
  ReturnOrder,
  ReturnOrderExternalDispatchResponse,
  ReturnOrderItem,
} from "../types";

export async function fetchReturnOrders(): Promise<ReturnOrder[]> {
  const response = await api.get<ReturnOrder[]>("/return-orders");
  return response.data;
}

export async function createReturnOrder(payload: {
  return_number?: string;
  customer_id?: number | null;
  goods_issue_id?: number | null;
  source_type?: "customer" | "technician" | null;
  source_reference?: string | null;
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
    repair_mode?: "internal" | "external" | null;
    external_status?: "waiting_external_provider" | "at_external_provider" | "ready_for_use" | null;
    external_partner?: string | null;
    target_bin_id?: number | null;
    reason?: string;
  }
): Promise<ReturnOrderItem> {
  const response = await api.post<ReturnOrderItem>(`/return-orders/${orderId}/items`, payload);
  return response.data;
}

export async function dispatchReturnOrderItemExternal(
  orderId: number,
  itemId: number,
  payload?: {
    external_partner?: string | null;
  }
): Promise<ReturnOrderExternalDispatchResponse> {
  const response = await api.post<ReturnOrderExternalDispatchResponse>(
    `/return-orders/${orderId}/items/${itemId}/dispatch-external`,
    payload ?? {}
  );
  return response.data;
}

export async function receiveReturnOrderItemExternal(
  orderId: number,
  itemId: number,
  payload: {
    target_bin_id: number;
  }
): Promise<ReturnOrderItem> {
  const response = await api.post<ReturnOrderItem>(
    `/return-orders/${orderId}/items/${itemId}/receive-external`,
    payload
  );
  return response.data;
}
