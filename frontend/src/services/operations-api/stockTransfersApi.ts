import type { StockTransfer, StockTransferItem } from "../../types";
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
import { toStockTransferFromQueue, toStockTransferItemFromQueue } from "./offlineMappers";

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
