import { api } from "./api";
import type { PurchaseOrder, PurchaseOrderItem } from "../types";

export async function fetchPurchaseOrders(status?: PurchaseOrder["status"]): Promise<PurchaseOrder[]> {
  const response = await api.get<PurchaseOrder[]>("/purchase-orders", { params: { status } });
  return response.data;
}

export async function createPurchaseOrder(payload: {
  order_number?: string;
  supplier_id?: number | null;
  expected_delivery_at?: string | null;
  notes?: string;
}): Promise<PurchaseOrder> {
  const response = await api.post<PurchaseOrder>("/purchase-orders", payload);
  return response.data;
}

export async function updatePurchaseOrder(
  orderId: number,
  payload: {
    supplier_id?: number | null;
    expected_delivery_at?: string | null;
    notes?: string;
  }
): Promise<PurchaseOrder> {
  const response = await api.put<PurchaseOrder>(`/purchase-orders/${orderId}`, payload);
  return response.data;
}

export async function updatePurchaseOrderStatus(
  orderId: number,
  status: PurchaseOrder["status"]
): Promise<PurchaseOrder> {
  const response = await api.post<PurchaseOrder>(`/purchase-orders/${orderId}/status`, { status });
  return response.data;
}

export async function fetchPurchaseOrderItems(orderId: number): Promise<PurchaseOrderItem[]> {
  const response = await api.get<PurchaseOrderItem[]>(`/purchase-orders/${orderId}/items`);
  return response.data;
}

export async function createPurchaseOrderItem(
  orderId: number,
  payload: {
    product_id: number;
    ordered_quantity: string;
    unit?: string;
    unit_price?: string | null;
    expected_delivery_at?: string | null;
  }
): Promise<PurchaseOrderItem> {
  const response = await api.post<PurchaseOrderItem>(`/purchase-orders/${orderId}/items`, payload);
  return response.data;
}

export async function deletePurchaseOrderItem(orderId: number, itemId: number): Promise<void> {
  await api.delete(`/purchase-orders/${orderId}/items/${itemId}`);
}
