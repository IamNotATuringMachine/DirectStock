import type { BinSuggestion, GoodsReceipt, GoodsReceiptItem, Product, ProductCreatePayload } from "../../types";
import { api } from "../api";
import {
  allocateLocalEntityId,
  buildQueuedMessage,
  enqueueOfflineMutation,
  isOfflineNow,
  listOfflineQueueItemsByEntity,
  listOfflineQueuedEntities,
  shouldQueueOfflineMutation,
} from "../offlineQueue";
import { toGoodsReceiptFromQueue, toGoodsReceiptItemFromQueue } from "./offlineMappers";

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
  mode?: "po" | "free";
  source_type?: "supplier" | "technician" | "other";
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

export async function downloadGoodsReceiptItemLabelsPdf(
  receiptId: number,
  itemId: number,
  copies = 1
): Promise<Blob> {
  const response = await api.get<Blob>(`/goods-receipts/${receiptId}/items/${itemId}/item-labels/pdf`, {
    params: { copies },
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
    input_method?: "scan" | "manual";
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
    return buildQueuedMessage("Wareneingang");
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
