import { api } from "./api";
import type {
  PurchaseOrder,
  PurchaseOrderCommunicationListResponse,
  PurchaseOrderEmailSendResponse,
  PurchaseOrderItem,
  PurchaseOrderMailSyncResponse,
  PurchaseOrderResolveResponse,
  SupplierCommStatus,
} from "../types";

export async function fetchPurchaseOrders(params?: {
  status?: PurchaseOrder["status"];
  supplier_comm_status?: SupplierCommStatus;
  receivable_only?: boolean;
}): Promise<PurchaseOrder[]> {
  const response = await api.get<PurchaseOrder[]>("/purchase-orders", { params });
  return response.data;
}

export async function resolvePurchaseOrder(orderNumber: string): Promise<PurchaseOrderResolveResponse> {
  const response = await api.get<PurchaseOrderResolveResponse>("/purchase-orders/resolve", {
    params: { order_number: orderNumber },
  });
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

export async function sendPurchaseOrderEmail(orderId: number): Promise<PurchaseOrderEmailSendResponse> {
  const response = await api.post<PurchaseOrderEmailSendResponse>(`/purchase-orders/${orderId}/send-email`);
  return response.data;
}

export async function updatePurchaseOrderSupplierConfirmation(
  orderId: number,
  payload: {
    supplier_comm_status: "confirmed_with_date" | "confirmed_undetermined";
    supplier_delivery_date?: string | null;
    supplier_last_reply_note?: string | null;
  }
): Promise<PurchaseOrder> {
  const response = await api.patch<PurchaseOrder>(`/purchase-orders/${orderId}/supplier-confirmation`, payload);
  return response.data;
}

export async function syncPurchaseOrderMailbox(): Promise<PurchaseOrderMailSyncResponse> {
  const response = await api.post<PurchaseOrderMailSyncResponse>("/purchase-orders/mail-sync");
  return response.data;
}

export async function fetchPurchaseOrderCommunications(
  orderId: number
): Promise<PurchaseOrderCommunicationListResponse> {
  const response = await api.get<PurchaseOrderCommunicationListResponse>(`/purchase-orders/${orderId}/communications`);
  return response.data;
}
