import { api } from "./api";
import {
  allocateLocalEntityId,
  buildQueuedMessage,
  discardOfflineMutation,
  enqueueOfflineMutation,
  isOfflineNow,
  listOfflineQueueItemsByEntity,
  listOfflineQueuedEntities,
  shouldQueueOfflineMutation,
  type OfflineQueueItem,
} from "./offlineQueue";
import type { InventoryCountItem, InventoryCountSession } from "../types";

const sessionCache = new Map<number, InventoryCountSession>();
const sessionItemCache = new Map<number, InventoryCountItem[]>();

function nowIso(): string {
  return new Date().toISOString();
}

function toSessionFromQueue(item: OfflineQueueItem): InventoryCountSession {
  const payload = (item.payload ?? {}) as {
    session_number?: string;
    session_type?: "snapshot" | "cycle";
    warehouse_id?: number;
    tolerance_quantity?: string;
    notes?: string;
  };

  const localId = item.entity_id ?? -1;
  return {
    id: localId,
    session_number: payload.session_number ?? `INV-OFF-${Math.abs(localId)}`,
    session_type: payload.session_type ?? "snapshot",
    status: "draft",
    warehouse_id: payload.warehouse_id ?? null,
    tolerance_quantity: payload.tolerance_quantity ?? "0",
    generated_at: null,
    completed_at: null,
    created_by: null,
    notes: payload.notes ?? null,
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

function buildQueuedCountItem(
  sessionId: number,
  itemId: number,
  countedQuantity: string,
  base?: InventoryCountItem
): InventoryCountItem {
  const timestamp = nowIso();
  if (base) {
    const difference = Number(countedQuantity) - Number(base.snapshot_quantity);
    return {
      ...base,
      counted_quantity: countedQuantity,
      difference_quantity: Number.isFinite(difference) ? difference.toFixed(3) : null,
      count_attempts: base.count_attempts + 1,
      last_counted_at: timestamp,
      updated_at: timestamp,
    };
  }

  return {
    id: itemId,
    session_id: sessionId,
    inventory_id: null,
    product_id: 0,
    product_number: `OFFLINE-${itemId}`,
    product_name: "Offline-Zaehlung",
    bin_location_id: 0,
    bin_code: "-",
    snapshot_quantity: "0",
    counted_quantity: countedQuantity,
    difference_quantity: null,
    unit: "piece",
    count_attempts: 1,
    recount_required: false,
    last_counted_at: timestamp,
    counted_by: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function upsertSessionCache(items: InventoryCountSession[]) {
  for (const item of items) {
    sessionCache.set(item.id, item);
  }
}

function mergeQueuedCountUpdates(
  items: InventoryCountItem[],
  queuedUpdates: OfflineQueueItem[],
  sessionId: number
): InventoryCountItem[] {
  if (queuedUpdates.length === 0) {
    return items;
  }

  const latestByItem = new Map<number, OfflineQueueItem>();
  for (const queued of queuedUpdates.sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    if (queued.entity_id === null) {
      continue;
    }
    latestByItem.set(queued.entity_id, queued);
  }

  const merged = items.map((item) => {
    const queued = latestByItem.get(item.id);
    if (!queued) {
      return item;
    }

    const payload = (queued.payload ?? {}) as { counted_quantity?: string };
    if (!payload.counted_quantity) {
      return item;
    }
    return buildQueuedCountItem(sessionId, item.id, payload.counted_quantity, item);
  });

  const knownIds = new Set(merged.map((item) => item.id));
  for (const [itemId, queued] of latestByItem.entries()) {
    if (knownIds.has(itemId)) {
      continue;
    }
    const payload = (queued.payload ?? {}) as { counted_quantity?: string };
    if (!payload.counted_quantity) {
      continue;
    }
    merged.push(buildQueuedCountItem(sessionId, itemId, payload.counted_quantity));
  }

  return merged;
}

export async function fetchInventoryCountSessions(status?: string): Promise<InventoryCountSession[]> {
  let serverItems = Array.from(sessionCache.values()).sort((a, b) => b.id - a.id);

  if (!isOfflineNow()) {
    try {
      const response = await api.get<InventoryCountSession[]>("/inventory-counts", { params: { status } });
      serverItems = response.data;
      upsertSessionCache(serverItems);
    } catch {
      serverItems = Array.from(sessionCache.values()).sort((a, b) => b.id - a.id);
    }
  }

  const queued = await listOfflineQueuedEntities("inventory_count_session");
  const queuedSessions = queued.map(toSessionFromQueue);
  upsertSessionCache(queuedSessions);

  const merged = [...queuedSessions, ...serverItems];
  if (status) {
    return merged.filter((item) => item.status === status);
  }
  return merged;
}

export async function createInventoryCountSession(payload: {
  session_number?: string;
  session_type: "snapshot" | "cycle";
  warehouse_id?: number;
  tolerance_quantity?: string;
  notes?: string;
}): Promise<InventoryCountSession> {
  if (shouldQueueOfflineMutation("POST", "/inventory-counts")) {
    const localId = await allocateLocalEntityId();
    const queued = await enqueueOfflineMutation({
      method: "POST",
      url: "/inventory-counts",
      payload,
      entityType: "inventory_count_session",
      entityId: localId,
    });
    const session = toSessionFromQueue(queued);
    sessionCache.set(session.id, session);
    return session;
  }

  const response = await api.post<InventoryCountSession>("/inventory-counts", payload);
  sessionCache.set(response.data.id, response.data);
  return response.data;
}

export async function generateInventoryCountItems(
  sessionId: number,
  refreshExisting = false
): Promise<{ message: string }> {
  const url = `/inventory-counts/${sessionId}/generate-items`;
  const payload = { refresh_existing: refreshExisting };
  if (shouldQueueOfflineMutation("POST", url)) {
    await enqueueOfflineMutation({
      method: "POST",
      url,
      payload,
      entityType: "inventory_count_generate",
      parentEntityId: sessionId,
    });
    return buildQueuedMessage("Inventur-Zaehlliste");
  }

  const response = await api.post<{ message: string }>(url, payload);
  return response.data;
}

export async function fetchInventoryCountItems(sessionId: number): Promise<InventoryCountItem[]> {
  let serverItems = sessionItemCache.get(sessionId) ?? [];
  if (sessionId > 0 && !isOfflineNow()) {
    try {
      const response = await api.get<InventoryCountItem[]>(`/inventory-counts/${sessionId}/items`);
      serverItems = response.data;
      sessionItemCache.set(sessionId, serverItems);
    } catch {
      serverItems = sessionItemCache.get(sessionId) ?? [];
    }
  }

  const queuedUpdates = await listOfflineQueueItemsByEntity("inventory_count_item_update", sessionId);
  const merged = mergeQueuedCountUpdates(serverItems, queuedUpdates, sessionId);
  sessionItemCache.set(sessionId, merged);
  return merged;
}

export async function updateInventoryCountItem(
  sessionId: number,
  itemId: number,
  countedQuantity: string
): Promise<InventoryCountItem> {
  const url = `/inventory-counts/${sessionId}/items/${itemId}`;
  const payload = { counted_quantity: countedQuantity };
  if (shouldQueueOfflineMutation("PUT", url)) {
    const queuedForSession = await listOfflineQueueItemsByEntity("inventory_count_item_update", sessionId);
    for (const queuedItem of queuedForSession) {
      if (queuedItem.entity_id === itemId) {
        await discardOfflineMutation(queuedItem.id);
      }
    }

    await enqueueOfflineMutation({
      method: "PUT",
      url,
      payload,
      entityType: "inventory_count_item_update",
      entityId: itemId,
      parentEntityId: sessionId,
    });

    const base = (sessionItemCache.get(sessionId) ?? []).find((item) => item.id === itemId);
    const updated = buildQueuedCountItem(sessionId, itemId, countedQuantity, base);
    const current = sessionItemCache.get(sessionId) ?? [];
    sessionItemCache.set(
      sessionId,
      current.some((item) => item.id === itemId)
        ? current.map((item) => (item.id === itemId ? updated : item))
        : [...current, updated]
    );
    return updated;
  }

  const response = await api.put<InventoryCountItem>(`/inventory-counts/${sessionId}/items/${itemId}`, {
    counted_quantity: countedQuantity,
  });
  const current = sessionItemCache.get(sessionId) ?? [];
  sessionItemCache.set(
    sessionId,
    current.some((item) => item.id === response.data.id)
      ? current.map((item) => (item.id === response.data.id ? response.data : item))
      : [...current, response.data]
  );
  return response.data;
}

export async function completeInventoryCountSession(sessionId: number): Promise<{ message: string }> {
  const url = `/inventory-counts/${sessionId}/complete`;
  if (shouldQueueOfflineMutation("POST", url)) {
    await enqueueOfflineMutation({
      method: "POST",
      url,
      payload: {},
      entityType: "inventory_count_complete",
      parentEntityId: sessionId,
    });
    return buildQueuedMessage("Inventurabschluss");
  }

  const response = await api.post<{ message: string }>(url);
  return response.data;
}

export async function fetchInventoryCountSummary(sessionId: number): Promise<{
  total: number;
  counted: number;
  recount_required: number;
}> {
  if (isOfflineNow()) {
    const items = await fetchInventoryCountItems(sessionId);
    return {
      total: items.length,
      counted: items.filter((item) => item.counted_quantity !== null).length,
      recount_required: items.filter((item) => item.recount_required).length,
    };
  }

  const response = await api.get<{ total: number; counted: number; recount_required: number }>(
    `/inventory-counts/${sessionId}/summary`
  );
  return response.data;
}
