import { api } from "./api";
import type { Invoice, InvoiceDetail, InvoiceExportResult } from "../types";

export async function fetchInvoices(params?: {
  page?: number;
  pageSize?: number;
}): Promise<{ items: Invoice[]; total: number; page: number; page_size: number }> {
  const response = await api.get<{ items: Invoice[]; total: number; page: number; page_size: number }>("/invoices", {
    params: {
      page: params?.page ?? 1,
      page_size: params?.pageSize ?? 50,
    },
  });
  return response.data;
}

export async function fetchInvoice(invoiceId: number): Promise<InvoiceDetail> {
  const response = await api.get<InvoiceDetail>(`/invoices/${invoiceId}`);
  return response.data;
}

export async function createInvoice(payload: {
  invoice_number?: string;
  sales_order_id: number;
  due_at?: string | null;
  notes?: string | null;
}): Promise<InvoiceDetail> {
  const response = await api.post<InvoiceDetail>("/invoices", payload);
  return response.data;
}

export async function createInvoicePartial(
  invoiceId: number,
  items: Array<{ sales_order_item_id: number; quantity: string }>
): Promise<InvoiceDetail> {
  const response = await api.post<InvoiceDetail>(`/invoices/${invoiceId}/partial`, { items });
  return response.data;
}

export async function exportXrechnung(invoiceId: number): Promise<InvoiceExportResult> {
  const response = await api.post<InvoiceExportResult>(`/invoices/${invoiceId}/exports/xrechnung`);
  return response.data;
}

export async function exportZugferd(invoiceId: number): Promise<InvoiceExportResult> {
  const response = await api.post<InvoiceExportResult>(`/invoices/${invoiceId}/exports/zugferd`);
  return response.data;
}
