import { api } from "./api";
import type {
  GoodsIssue,
  GoodsIssueItem,
  GoodsReceipt,
  GoodsReceiptItem,
  StockTransfer,
  StockTransferItem,
} from "../types";

export async function fetchGoodsReceipts(status?: string): Promise<GoodsReceipt[]> {
  const response = await api.get<GoodsReceipt[]>("/goods-receipts", { params: { status } });
  return response.data;
}

export async function createGoodsReceipt(payload: {
  receipt_number?: string;
  supplier_id?: number;
  notes?: string;
}): Promise<GoodsReceipt> {
  const response = await api.post<GoodsReceipt>("/goods-receipts", payload);
  return response.data;
}

export async function fetchGoodsReceiptItems(receiptId: number): Promise<GoodsReceiptItem[]> {
  const response = await api.get<GoodsReceiptItem[]>(`/goods-receipts/${receiptId}/items`);
  return response.data;
}

export async function createGoodsReceiptItem(
  receiptId: number,
  payload: {
    product_id: number;
    expected_quantity?: string;
    received_quantity: string;
    unit?: string;
    target_bin_id: number;
    batch_number?: string;
    expiry_date?: string;
    manufactured_at?: string;
    serial_numbers?: string[];
  }
): Promise<GoodsReceiptItem> {
  const response = await api.post<GoodsReceiptItem>(`/goods-receipts/${receiptId}/items`, payload);
  return response.data;
}

export async function completeGoodsReceipt(receiptId: number): Promise<{ message: string }> {
  const response = await api.post<{ message: string }>(`/goods-receipts/${receiptId}/complete`);
  return response.data;
}

export async function cancelGoodsReceipt(receiptId: number): Promise<{ message: string }> {
  const response = await api.post<{ message: string }>(`/goods-receipts/${receiptId}/cancel`);
  return response.data;
}

export async function fetchGoodsIssues(status?: string): Promise<GoodsIssue[]> {
  const response = await api.get<GoodsIssue[]>("/goods-issues", { params: { status } });
  return response.data;
}

export async function createGoodsIssue(payload: {
  issue_number?: string;
  customer_reference?: string;
  notes?: string;
}): Promise<GoodsIssue> {
  const response = await api.post<GoodsIssue>("/goods-issues", payload);
  return response.data;
}

export async function fetchGoodsIssueItems(issueId: number): Promise<GoodsIssueItem[]> {
  const response = await api.get<GoodsIssueItem[]>(`/goods-issues/${issueId}/items`);
  return response.data;
}

export async function createGoodsIssueItem(
  issueId: number,
  payload: {
    product_id: number;
    requested_quantity: string;
    issued_quantity?: string;
    unit?: string;
    source_bin_id: number;
    batch_number?: string;
    use_fefo?: boolean;
    serial_numbers?: string[];
  }
): Promise<GoodsIssueItem> {
  const response = await api.post<GoodsIssueItem>(`/goods-issues/${issueId}/items`, payload);
  return response.data;
}

export async function completeGoodsIssue(issueId: number): Promise<{ message: string }> {
  const response = await api.post<{ message: string }>(`/goods-issues/${issueId}/complete`);
  return response.data;
}

export async function cancelGoodsIssue(issueId: number): Promise<{ message: string }> {
  const response = await api.post<{ message: string }>(`/goods-issues/${issueId}/cancel`);
  return response.data;
}

export async function fetchStockTransfers(status?: string): Promise<StockTransfer[]> {
  const response = await api.get<StockTransfer[]>("/stock-transfers", { params: { status } });
  return response.data;
}

export async function createStockTransfer(payload: {
  transfer_number?: string;
  notes?: string;
}): Promise<StockTransfer> {
  const response = await api.post<StockTransfer>("/stock-transfers", payload);
  return response.data;
}

export async function fetchStockTransferItems(transferId: number): Promise<StockTransferItem[]> {
  const response = await api.get<StockTransferItem[]>(`/stock-transfers/${transferId}/items`);
  return response.data;
}

export async function createStockTransferItem(
  transferId: number,
  payload: {
    product_id: number;
    quantity: string;
    unit?: string;
    from_bin_id: number;
    to_bin_id: number;
    batch_number?: string;
    serial_numbers?: string[];
  }
): Promise<StockTransferItem> {
  const response = await api.post<StockTransferItem>(`/stock-transfers/${transferId}/items`, payload);
  return response.data;
}

export async function completeStockTransfer(transferId: number): Promise<{ message: string }> {
  const response = await api.post<{ message: string }>(`/stock-transfers/${transferId}/complete`);
  return response.data;
}

export async function cancelStockTransfer(transferId: number): Promise<{ message: string }> {
  const response = await api.post<{ message: string }>(`/stock-transfers/${transferId}/cancel`);
  return response.data;
}
