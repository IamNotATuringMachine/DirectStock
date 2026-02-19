import type { GoodsIssue, GoodsIssueItem, GoodsReceipt, GoodsReceiptItem, StockTransfer, StockTransferItem } from "../../types";
import type { OfflineQueueItem } from "../offlineQueue";

export function toGoodsReceiptFromQueue(item: OfflineQueueItem): GoodsReceipt {
  const payload = (item.payload ?? {}) as {
    receipt_number?: string;
    supplier_id?: number;
    purchase_order_id?: number;
    mode?: "po" | "free";
    source_type?: "supplier" | "technician" | "other";
    notes?: string;
  };
  const localId = item.entity_id ?? -1;
  return {
    id: localId,
    receipt_number: payload.receipt_number ?? `OFFLINE-WE-${Math.abs(localId)}`,
    supplier_id: payload.supplier_id ?? null,
    purchase_order_id: payload.purchase_order_id ?? null,
    mode: payload.mode ?? (payload.purchase_order_id ? "po" : "free"),
    source_type: payload.source_type ?? "supplier",
    status: "draft",
    received_at: null,
    completed_at: null,
    created_by: null,
    notes: payload.notes ?? null,
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

export function toGoodsIssueFromQueue(item: OfflineQueueItem): GoodsIssue {
  const payload = (item.payload ?? {}) as {
    issue_number?: string;
    customer_id?: number;
    customer_location_id?: number;
    customer_reference?: string;
    notes?: string;
  };
  const localId = item.entity_id ?? -1;
  return {
    id: localId,
    issue_number: payload.issue_number ?? `OFFLINE-WA-${Math.abs(localId)}`,
    customer_id: payload.customer_id ?? null,
    customer_location_id: payload.customer_location_id ?? null,
    customer_reference: payload.customer_reference ?? null,
    status: "draft",
    issued_at: null,
    completed_at: null,
    created_by: null,
    notes: payload.notes ?? null,
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

export function toStockTransferFromQueue(item: OfflineQueueItem): StockTransfer {
  const payload = (item.payload ?? {}) as {
    transfer_number?: string;
    notes?: string;
  };
  const localId = item.entity_id ?? -1;
  return {
    id: localId,
    transfer_number: payload.transfer_number ?? `OFFLINE-ST-${Math.abs(localId)}`,
    status: "draft",
    transferred_at: null,
    completed_at: null,
    created_by: null,
    notes: payload.notes ?? null,
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

export function toGoodsReceiptItemFromQueue(item: OfflineQueueItem): GoodsReceiptItem {
  const payload = (item.payload ?? {}) as {
    product_id: number;
    expected_quantity?: string;
    received_quantity: string;
    unit?: string;
    target_bin_id: number;
    batch_number?: string;
    expiry_date?: string;
    manufactured_at?: string;
    serial_numbers?: string[];
    purchase_order_item_id?: number;
    input_method?: "scan" | "manual";
    condition?: string;
  };

  const localId = item.entity_id ?? -1;
  return {
    id: localId,
    goods_receipt_id: item.parent_entity_id ?? -1,
    product_id: payload.product_id,
    expected_quantity: payload.expected_quantity ?? null,
    received_quantity: payload.received_quantity,
    unit: payload.unit ?? "piece",
    target_bin_id: payload.target_bin_id,
    batch_number: payload.batch_number ?? null,
    expiry_date: payload.expiry_date ?? null,
    manufactured_at: payload.manufactured_at ?? null,
    serial_numbers: payload.serial_numbers ?? null,
    purchase_order_item_id: payload.purchase_order_item_id ?? null,
    input_method: payload.input_method ?? "manual",
    condition: payload.condition ?? "new",
    product_number: null,
    product_name: null,
    target_bin_code: null,
    expected_open_quantity: null,
    variance_quantity: null,
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

export function toGoodsIssueItemFromQueue(item: OfflineQueueItem): GoodsIssueItem {
  const payload = (item.payload ?? {}) as {
    product_id: number;
    requested_quantity: string;
    issued_quantity?: string;
    unit?: string;
    source_bin_id: number;
    batch_number?: string;
    use_fefo?: boolean;
    serial_numbers?: string[];
  };

  const localId = item.entity_id ?? -1;
  return {
    id: localId,
    goods_issue_id: item.parent_entity_id ?? -1,
    product_id: payload.product_id,
    requested_quantity: payload.requested_quantity,
    issued_quantity: payload.issued_quantity ?? payload.requested_quantity,
    unit: payload.unit ?? "piece",
    source_bin_id: payload.source_bin_id,
    batch_number: payload.batch_number ?? null,
    use_fefo: payload.use_fefo ?? false,
    serial_numbers: payload.serial_numbers ?? null,
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

export function toStockTransferItemFromQueue(item: OfflineQueueItem): StockTransferItem {
  const payload = (item.payload ?? {}) as {
    product_id: number;
    quantity: string;
    unit?: string;
    from_bin_id: number;
    to_bin_id: number;
    batch_number?: string;
    serial_numbers?: string[];
  };

  const localId = item.entity_id ?? -1;
  return {
    id: localId,
    stock_transfer_id: item.parent_entity_id ?? -1,
    product_id: payload.product_id,
    quantity: payload.quantity,
    unit: payload.unit ?? "piece",
    from_bin_id: payload.from_bin_id,
    to_bin_id: payload.to_bin_id,
    batch_number: payload.batch_number ?? null,
    serial_numbers: payload.serial_numbers ?? null,
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}
