import { api } from "./api";
import type { SalesOrder, SalesOrderDetail, SalesOrderItem } from "../types";

export async function fetchSalesOrders(params?: {
  page?: number;
  pageSize?: number;
}): Promise<{ items: SalesOrder[]; total: number; page: number; page_size: number }> {
  const response = await api.get<{ items: SalesOrder[]; total: number; page: number; page_size: number }>(
    "/sales-orders",
    {
      params: {
        page: params?.page ?? 1,
        page_size: params?.pageSize ?? 50,
      },
    }
  );
  return response.data;
}

export async function fetchSalesOrder(orderId: number): Promise<SalesOrderDetail> {
  const response = await api.get<SalesOrderDetail>(`/sales-orders/${orderId}`);
  return response.data;
}

export async function createSalesOrder(payload: {
  order_number?: string;
  customer_id?: number | null;
  currency?: string;
  notes?: string | null;
  items: Array<{
    item_type: "product" | "service";
    product_id?: number;
    service_id?: number;
    description?: string | null;
    quantity: string;
    unit?: string;
    net_unit_price?: string;
    vat_rate?: string;
  }>;
}): Promise<SalesOrderDetail> {
  const response = await api.post<SalesOrderDetail>("/sales-orders", payload);
  return response.data;
}

export async function updateSalesOrder(
  orderId: number,
  payload: {
    customer_id?: number | null;
    status?: string;
    currency?: string;
    notes?: string | null;
  }
): Promise<SalesOrder> {
  const response = await api.put<SalesOrder>(`/sales-orders/${orderId}`, payload);
  return response.data;
}

export async function addSalesOrderItem(
  orderId: number,
  payload: {
    item_type: "product" | "service";
    product_id?: number;
    service_id?: number;
    description?: string | null;
    quantity: string;
    unit?: string;
    net_unit_price?: string;
    vat_rate?: string;
  }
): Promise<SalesOrderItem> {
  const response = await api.post<SalesOrderItem>(`/sales-orders/${orderId}/items`, payload);
  return response.data;
}

export async function createDeliveryNote(orderId: number, goodsIssueId?: number): Promise<{ document_id: number; message: string }> {
  const response = await api.post<{ document_id: number; message: string }>(
    `/sales-orders/${orderId}/delivery-note`,
    goodsIssueId ? { goods_issue_id: goodsIssueId } : undefined
  );
  return response.data;
}
