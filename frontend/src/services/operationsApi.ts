import { api } from "./api";
import {
  allocateLocalEntityId,
  buildQueuedMessage,
  enqueueOfflineMutation,
  isOfflineNow,
  listOfflineQueueItemsByEntity,
  listOfflineQueuedEntities,
  shouldQueueOfflineMutation,
  type OfflineQueueItem,
} from "./offlineQueue";
import type {
  BinSuggestion,
  GoodsIssue,
  GoodsIssueItem,
  GoodsReceipt,
  GoodsReceiptItem,
  Product,
  ProductCreatePayload,
  StockTransfer,
  StockTransferItem,
} from "../types";

function toGoodsReceiptFromQueue(item: OfflineQueueItem): GoodsReceipt {
  const payload = (item.payload ?? {}) as {
    receipt_number?: string;
    supplier_id?: number;
    purchase_order_id?: number;
    notes?: string;
  };
  const localId = item.entity_id ?? -1;
  return {
    id: localId,
    receipt_number: payload.receipt_number ?? `OFFLINE-WE-${Math.abs(localId)}`,
    supplier_id: payload.supplier_id ?? null,
    purchase_order_id: payload.purchase_order_id ?? null,
    status: "draft",
    received_at: null,
    completed_at: null,
    created_by: null,
    notes: payload.notes ?? null,
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

function toGoodsIssueFromQueue(item: OfflineQueueItem): GoodsIssue {
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

function toStockTransferFromQueue(item: OfflineQueueItem): StockTransfer {
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

function toGoodsReceiptItemFromQueue(item: OfflineQueueItem): GoodsReceiptItem {
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
    condition: payload.condition ?? "new",
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

function toGoodsIssueItemFromQueue(item: OfflineQueueItem): GoodsIssueItem {
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

function toStockTransferItemFromQueue(item: OfflineQueueItem): StockTransferItem {
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

export async function fetchGoodsReceipts(status?: string): Promise<GoodsReceipt[]> {
  let serverItems: GoodsReceipt[] = [];
  if (!isOfflineNow()) {
    try {
      const response = await api.get<GoodsReceipt[]>("/goods-receipts", { params: { status } });
      serverItems = response.data;
    } catch {
      serverItems = [];
    }
  }

  const queued = await listOfflineQueuedEntities("goods_receipt");
  const queuedItems = queued.map(toGoodsReceiptFromQueue);
  return [...queuedItems, ...serverItems];
}

export async function createGoodsReceipt(payload: {
  receipt_number?: string;
  supplier_id?: number;
  purchase_order_id?: number;
  notes?: string;
}): Promise<GoodsReceipt> {
  if (shouldQueueOfflineMutation("POST", "/goods-receipts")) {
    const localId = await allocateLocalEntityId();
    const queued = await enqueueOfflineMutation({
      method: "POST",
      url: "/goods-receipts",
      payload,
      entityType: "goods_receipt",
      entityId: localId,
    });
    return toGoodsReceiptFromQueue(queued);
  }

  const response = await api.post<GoodsReceipt>("/goods-receipts", payload);
  return response.data;
}

export async function createGoodsReceiptAdHocProduct(
  receiptId: number,
  payload: ProductCreatePayload
): Promise<Product> {
  const response = await api.post<Product>(`/goods-receipts/${receiptId}/ad-hoc-product`, payload);
  return response.data;
}

export async function downloadGoodsReceiptItemSerialLabelsPdf(receiptId: number, itemId: number): Promise<Blob> {
  const response = await api.get<Blob>(`/goods-receipts/${receiptId}/items/${itemId}/serial-labels/pdf`, {
    responseType: "blob",
  });
  return response.data;
}

export async function fetchGoodsReceiptItems(receiptId: number): Promise<GoodsReceiptItem[]> {
  let serverItems: GoodsReceiptItem[] = [];
  if (receiptId > 0 && !isOfflineNow()) {
    try {
      const response = await api.get<GoodsReceiptItem[]>(`/goods-receipts/${receiptId}/items`);
      serverItems = response.data;
    } catch {
      serverItems = [];
    }
  }

  const queued = await listOfflineQueueItemsByEntity("goods_receipt_item", receiptId);
  const queuedItems = queued.map(toGoodsReceiptItemFromQueue);
  return [...serverItems, ...queuedItems];
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
    purchase_order_item_id?: number;
    condition?: string;
  }
): Promise<GoodsReceiptItem> {
  const url = `/goods-receipts/${receiptId}/items`;
  const body = { ...payload, condition: payload.condition ?? "new" };
  if (shouldQueueOfflineMutation("POST", url)) {
    const localId = await allocateLocalEntityId();
    const queued = await enqueueOfflineMutation({
      method: "POST",
      url,
      payload: body,
      entityType: "goods_receipt_item",
      entityId: localId,
      parentEntityId: receiptId,
    });
    return toGoodsReceiptItemFromQueue(queued);
  }

  const response = await api.post<GoodsReceiptItem>(url, body);
  return response.data;
}

export async function fetchBinSuggestions(productId: number): Promise<BinSuggestion[]> {
  const response = await api.get<BinSuggestion[]>(`/products/${productId}/bin-suggestions`);
  return response.data;
}

export async function createGoodsReceiptFromPo(poId: number): Promise<GoodsReceipt> {
  const response = await api.post<GoodsReceipt>(`/goods-receipts/from-po/${poId}`);
  return response.data;
}

export async function completeGoodsReceipt(receiptId: number): Promise<{ message: string }> {
  const url = `/goods-receipts/${receiptId}/complete`;
  if (shouldQueueOfflineMutation("POST", url)) {
    await enqueueOfflineMutation({
      method: "POST",
      url,
      payload: {},
      entityType: "goods_receipt_complete",
      parentEntityId: receiptId,
    });
    return buildQueuedMessage("Wareneingang") ;
  }

  const response = await api.post<{ message: string }>(url);
  return response.data;
}

export async function cancelGoodsReceipt(receiptId: number): Promise<{ message: string }> {
  const url = `/goods-receipts/${receiptId}/cancel`;
  if (shouldQueueOfflineMutation("POST", url)) {
    await enqueueOfflineMutation({
      method: "POST",
      url,
      payload: {},
      entityType: "goods_receipt_cancel",
      parentEntityId: receiptId,
    });
    return buildQueuedMessage("Wareneingang-Storno");
  }

  const response = await api.post<{ message: string }>(url);
  return response.data;
}

export async function deleteGoodsReceipt(receiptId: number): Promise<{ message: string }> {
  const url = `/goods-receipts/${receiptId}`;
  if (shouldQueueOfflineMutation("DELETE", url)) {
    await enqueueOfflineMutation({
      method: "DELETE",
      url,
      payload: {},
      entityType: "goods_receipt_delete",
      parentEntityId: receiptId,
    });
    return buildQueuedMessage("Wareneingang-Loeschung");
  }

  const response = await api.delete<{ message: string }>(url);
  return response.data;
}

export async function fetchGoodsIssues(status?: string): Promise<GoodsIssue[]> {
  let serverItems: GoodsIssue[] = [];
  if (!isOfflineNow()) {
    try {
      const response = await api.get<GoodsIssue[]>("/goods-issues", { params: { status } });
      serverItems = response.data;
    } catch {
      serverItems = [];
    }
  }

  const queued = await listOfflineQueuedEntities("goods_issue");
  const queuedItems = queued.map(toGoodsIssueFromQueue);
  return [...queuedItems, ...serverItems];
}

export async function createGoodsIssue(payload: {
  issue_number?: string;
  customer_id?: number;
  customer_location_id?: number;
  customer_reference?: string;
  notes?: string;
}): Promise<GoodsIssue> {
  if (shouldQueueOfflineMutation("POST", "/goods-issues")) {
    const localId = await allocateLocalEntityId();
    const queued = await enqueueOfflineMutation({
      method: "POST",
      url: "/goods-issues",
      payload,
      entityType: "goods_issue",
      entityId: localId,
    });
    return toGoodsIssueFromQueue(queued);
  }

  const response = await api.post<GoodsIssue>("/goods-issues", payload);
  return response.data;
}

export async function fetchGoodsIssueItems(issueId: number): Promise<GoodsIssueItem[]> {
  let serverItems: GoodsIssueItem[] = [];
  if (issueId > 0 && !isOfflineNow()) {
    try {
      const response = await api.get<GoodsIssueItem[]>(`/goods-issues/${issueId}/items`);
      serverItems = response.data;
    } catch {
      serverItems = [];
    }
  }

  const queued = await listOfflineQueueItemsByEntity("goods_issue_item", issueId);
  const queuedItems = queued.map(toGoodsIssueItemFromQueue);
  return [...serverItems, ...queuedItems];
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
  const url = `/goods-issues/${issueId}/items`;
  if (shouldQueueOfflineMutation("POST", url)) {
    const localId = await allocateLocalEntityId();
    const queued = await enqueueOfflineMutation({
      method: "POST",
      url,
      payload,
      entityType: "goods_issue_item",
      entityId: localId,
      parentEntityId: issueId,
    });
    return toGoodsIssueItemFromQueue(queued);
  }

  const response = await api.post<GoodsIssueItem>(url, payload);
  return response.data;
}

export async function completeGoodsIssue(issueId: number): Promise<{ message: string }> {
  const url = `/goods-issues/${issueId}/complete`;
  if (shouldQueueOfflineMutation("POST", url)) {
    await enqueueOfflineMutation({
      method: "POST",
      url,
      payload: {},
      entityType: "goods_issue_complete",
      parentEntityId: issueId,
    });
    return buildQueuedMessage("Warenausgang");
  }

  const response = await api.post<{ message: string }>(url);
  return response.data;
}

export async function cancelGoodsIssue(issueId: number): Promise<{ message: string }> {
  const url = `/goods-issues/${issueId}/cancel`;
  if (shouldQueueOfflineMutation("POST", url)) {
    await enqueueOfflineMutation({
      method: "POST",
      url,
      payload: {},
      entityType: "goods_issue_cancel",
      parentEntityId: issueId,
    });
    return buildQueuedMessage("Warenausgang-Storno");
  }

  const response = await api.post<{ message: string }>(url);
  return response.data;
}

export async function fetchStockTransfers(status?: string): Promise<StockTransfer[]> {
  let serverItems: StockTransfer[] = [];
  if (!isOfflineNow()) {
    try {
      const response = await api.get<StockTransfer[]>("/stock-transfers", { params: { status } });
      serverItems = response.data;
    } catch {
      serverItems = [];
    }
  }

  const queued = await listOfflineQueuedEntities("stock_transfer");
  const queuedItems = queued.map(toStockTransferFromQueue);
  return [...queuedItems, ...serverItems];
}

export async function createStockTransfer(payload: {
  transfer_number?: string;
  notes?: string;
}): Promise<StockTransfer> {
  if (shouldQueueOfflineMutation("POST", "/stock-transfers")) {
    const localId = await allocateLocalEntityId();
    const queued = await enqueueOfflineMutation({
      method: "POST",
      url: "/stock-transfers",
      payload,
      entityType: "stock_transfer",
      entityId: localId,
    });
    return toStockTransferFromQueue(queued);
  }

  const response = await api.post<StockTransfer>("/stock-transfers", payload);
  return response.data;
}

export async function fetchStockTransferItems(transferId: number): Promise<StockTransferItem[]> {
  let serverItems: StockTransferItem[] = [];
  if (transferId > 0 && !isOfflineNow()) {
    try {
      const response = await api.get<StockTransferItem[]>(`/stock-transfers/${transferId}/items`);
      serverItems = response.data;
    } catch {
      serverItems = [];
    }
  }

  const queued = await listOfflineQueueItemsByEntity("stock_transfer_item", transferId);
  const queuedItems = queued.map(toStockTransferItemFromQueue);
  return [...serverItems, ...queuedItems];
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
  const url = `/stock-transfers/${transferId}/items`;
  if (shouldQueueOfflineMutation("POST", url)) {
    const localId = await allocateLocalEntityId();
    const queued = await enqueueOfflineMutation({
      method: "POST",
      url,
      payload,
      entityType: "stock_transfer_item",
      entityId: localId,
      parentEntityId: transferId,
    });
    return toStockTransferItemFromQueue(queued);
  }

  const response = await api.post<StockTransferItem>(url, payload);
  return response.data;
}

export async function completeStockTransfer(transferId: number): Promise<{ message: string }> {
  const url = `/stock-transfers/${transferId}/complete`;
  if (shouldQueueOfflineMutation("POST", url)) {
    await enqueueOfflineMutation({
      method: "POST",
      url,
      payload: {},
      entityType: "stock_transfer_complete",
      parentEntityId: transferId,
    });
    return buildQueuedMessage("Umlagerung");
  }

  const response = await api.post<{ message: string }>(url);
  return response.data;
}

export async function cancelStockTransfer(transferId: number): Promise<{ message: string }> {
  const url = `/stock-transfers/${transferId}/cancel`;
  if (shouldQueueOfflineMutation("POST", url)) {
    await enqueueOfflineMutation({
      method: "POST",
      url,
      payload: {},
      entityType: "stock_transfer_cancel",
      parentEntityId: transferId,
    });
    return buildQueuedMessage("Umlagerungs-Storno");
  }

  const response = await api.post<{ message: string }>(url);
  return response.data;
}
