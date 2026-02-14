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
  InterWarehouseTransfer,
  InterWarehouseTransferDetail,
  InterWarehouseTransferItem,
} from "../types";

function toTransferFromQueue(item: OfflineQueueItem): InterWarehouseTransfer {
  const payload = (item.payload ?? {}) as {
    transfer_number?: string;
    from_warehouse_id?: number;
    to_warehouse_id?: number;
    notes?: string;
  };
  const localId = item.entity_id ?? -1;
  return {
    id: localId,
    transfer_number: payload.transfer_number ?? `OFFLINE-IWT-${Math.abs(localId)}`,
    from_warehouse_id: payload.from_warehouse_id ?? 0,
    to_warehouse_id: payload.to_warehouse_id ?? 0,
    status: "draft",
    requested_at: item.created_at,
    dispatched_at: null,
    received_at: null,
    cancelled_at: null,
    created_by: null,
    notes: payload.notes ?? null,
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

function toTransferItemFromQueue(item: OfflineQueueItem): InterWarehouseTransferItem {
  const payload = (item.payload ?? {}) as {
    product_id: number;
    from_bin_id: number;
    to_bin_id: number;
    requested_quantity: string;
    unit?: string;
    batch_number?: string | null;
    serial_numbers?: string[] | null;
  };
  const localId = item.entity_id ?? -1;
  return {
    id: localId,
    inter_warehouse_transfer_id: item.parent_entity_id ?? -1,
    product_id: payload.product_id,
    from_bin_id: payload.from_bin_id,
    to_bin_id: payload.to_bin_id,
    requested_quantity: payload.requested_quantity,
    dispatched_quantity: "0",
    received_quantity: "0",
    unit: payload.unit ?? "piece",
    batch_number: payload.batch_number ?? null,
    serial_numbers: payload.serial_numbers ?? null,
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

async function deriveQueuedTransferStatus(
  transferId: number
): Promise<"draft" | "dispatched" | "received" | "cancelled"> {
  const cancelRows = await listOfflineQueueItemsByEntity("inter_warehouse_transfer_cancel", transferId);
  if (cancelRows.length > 0) {
    return "cancelled";
  }

  const receiveRows = await listOfflineQueueItemsByEntity("inter_warehouse_transfer_receive", transferId);
  if (receiveRows.length > 0) {
    return "received";
  }

  const dispatchRows = await listOfflineQueueItemsByEntity("inter_warehouse_transfer_dispatch", transferId);
  if (dispatchRows.length > 0) {
    return "dispatched";
  }

  return "draft";
}

export async function fetchInterWarehouseTransfers(): Promise<InterWarehouseTransfer[]> {
  let serverItems: InterWarehouseTransfer[] = [];
  if (!isOfflineNow()) {
    const response = await api.get<InterWarehouseTransfer[]>("/inter-warehouse-transfers");
    serverItems = response.data;
  }

  const queued = await listOfflineQueuedEntities("inter_warehouse_transfer");
  const queuedItems = queued.map(toTransferFromQueue);
  return [...queuedItems, ...serverItems];
}

export async function createInterWarehouseTransfer(payload: {
  transfer_number?: string;
  from_warehouse_id: number;
  to_warehouse_id: number;
  notes?: string;
}): Promise<InterWarehouseTransfer> {
  const url = "/inter-warehouse-transfers";
  if (shouldQueueOfflineMutation("POST", url)) {
    const localId = await allocateLocalEntityId();
    const queued = await enqueueOfflineMutation({
      method: "POST",
      url,
      payload,
      entityType: "inter_warehouse_transfer",
      entityId: localId,
    });
    return toTransferFromQueue(queued);
  }

  const response = await api.post<InterWarehouseTransfer>(url, payload);
  return response.data;
}

export async function fetchInterWarehouseTransfer(transferId: number): Promise<InterWarehouseTransferDetail> {
  if (transferId < 0) {
    const queuedTransfers = await listOfflineQueuedEntities("inter_warehouse_transfer");
    const transferQueueItem = queuedTransfers.find((item) => item.entity_id === transferId);
    if (!transferQueueItem) {
      throw new Error("Offline transfer not found");
    }

    const transfer = toTransferFromQueue(transferQueueItem);
    transfer.status = await deriveQueuedTransferStatus(transferId);
    const itemRows = await listOfflineQueueItemsByEntity("inter_warehouse_transfer_item", transferId);
    const items = itemRows.map(toTransferItemFromQueue);

    return { transfer, items };
  }

  const response = await api.get<InterWarehouseTransferDetail>(`/inter-warehouse-transfers/${transferId}`);
  return response.data;
}

export async function createInterWarehouseTransferItem(
  transferId: number,
  payload: {
    product_id: number;
    from_bin_id: number;
    to_bin_id: number;
    requested_quantity: string;
    unit?: string;
    batch_number?: string | null;
    serial_numbers?: string[] | null;
  }
): Promise<InterWarehouseTransferItem> {
  const url = `/inter-warehouse-transfers/${transferId}/items`;
  if (shouldQueueOfflineMutation("POST", url)) {
    const localId = await allocateLocalEntityId();
    const queued = await enqueueOfflineMutation({
      method: "POST",
      url,
      payload,
      entityType: "inter_warehouse_transfer_item",
      entityId: localId,
      parentEntityId: transferId,
    });
    return toTransferItemFromQueue(queued);
  }

  const response = await api.post<InterWarehouseTransferItem>(url, payload);
  return response.data;
}

export async function dispatchInterWarehouseTransfer(transferId: number): Promise<{ message: string }> {
  const url = `/inter-warehouse-transfers/${transferId}/dispatch`;
  if (shouldQueueOfflineMutation("POST", url)) {
    await enqueueOfflineMutation({
      method: "POST",
      url,
      payload: {},
      entityType: "inter_warehouse_transfer_dispatch",
      parentEntityId: transferId,
    });
    return buildQueuedMessage("Inter-Warehouse Dispatch");
  }

  const response = await api.post<{ message: string }>(url);
  return response.data;
}

export async function receiveInterWarehouseTransfer(transferId: number): Promise<{ message: string }> {
  const url = `/inter-warehouse-transfers/${transferId}/receive`;
  if (shouldQueueOfflineMutation("POST", url)) {
    await enqueueOfflineMutation({
      method: "POST",
      url,
      payload: {},
      entityType: "inter_warehouse_transfer_receive",
      parentEntityId: transferId,
    });
    return buildQueuedMessage("Inter-Warehouse Receive");
  }

  const response = await api.post<{ message: string }>(url);
  return response.data;
}

export async function cancelInterWarehouseTransfer(transferId: number): Promise<{ message: string }> {
  const url = `/inter-warehouse-transfers/${transferId}/cancel`;
  if (shouldQueueOfflineMutation("POST", url)) {
    await enqueueOfflineMutation({
      method: "POST",
      url,
      payload: {},
      entityType: "inter_warehouse_transfer_cancel",
      parentEntityId: transferId,
    });
    return buildQueuedMessage("Inter-Warehouse Storno");
  }

  const response = await api.post<{ message: string }>(url);
  return response.data;
}
