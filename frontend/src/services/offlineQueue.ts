import axios from "axios";

import { api } from "./api";
import {
  QUEUE_STORE,
  generateId,
  getIdMapping,
  getLocalCounter,
  hasOfflineQueueSupport,
  isOfflineScope,
  listQueueRows,
  notifyQueueChanged,
  nowIso,
  setIdMapping,
  setLocalCounter,
  subscribeOfflineQueueChanges,
  txDelete,
  txGet,
  txPut,
} from "./offlineQueueStore";
import type { EnqueueInput, OfflineQueueItem, SyncResult } from "./offlineQueueTypes";

export type { EnqueueInput, OfflineQueueItem, OfflineQueueStatus, SyncResult } from "./offlineQueueTypes";
export { subscribeOfflineQueueChanges };

export async function allocateLocalEntityId(): Promise<number> {
  if (!hasOfflineQueueSupport()) {
    return -Math.floor(Date.now() % 10_000_000);
  }

  const current = await getLocalCounter();
  const next = current <= 0 ? current - 1 : -1;
  await setLocalCounter(next);
  return next;
}

export function isOfflineNow(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  return !navigator.onLine;
}

export function shouldQueueOfflineMutation(method: string, url: string): boolean {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase())) {
    return false;
  }
  return isOfflineNow() && isOfflineScope(url);
}

export async function enqueueOfflineMutation(input: EnqueueInput): Promise<OfflineQueueItem> {
  const timestamp = nowIso();
  const item: OfflineQueueItem = {
    id: generateId(),
    operation_id: input.operationId ?? generateId(),
    method: input.method,
    url: input.url,
    payload: input.payload,
    status: "queued",
    attempts: 0,
    next_retry_at: null,
    last_error: null,
    created_at: timestamp,
    updated_at: timestamp,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    parent_entity_id: input.parentEntityId ?? null,
  };

  if (hasOfflineQueueSupport()) {
    await txPut<OfflineQueueItem>(QUEUE_STORE, item);
    notifyQueueChanged();
  }

  return item;
}

export async function listOfflineQueueItems(): Promise<OfflineQueueItem[]> {
  if (!hasOfflineQueueSupport()) {
    return [];
  }
  return listQueueRows();
}

export async function listOfflineQueueItemsByEntity(
  entityType: string,
  entityId: number
): Promise<OfflineQueueItem[]> {
  const rows = await listOfflineQueueItems();
  return rows.filter((row) => row.entity_type === entityType && row.parent_entity_id === entityId);
}

export async function listOfflineQueuedEntities(entityType: string): Promise<OfflineQueueItem[]> {
  const rows = await listOfflineQueueItems();
  return rows.filter(
    (row) => row.entity_type === entityType && row.entity_id !== null && row.parent_entity_id === null
  );
}

export async function retryOfflineMutation(itemId: string): Promise<void> {
  if (!hasOfflineQueueSupport()) {
    return;
  }
  const item = await txGet<OfflineQueueItem>(QUEUE_STORE, itemId);
  if (!item) {
    return;
  }
  item.status = "queued";
  item.last_error = null;
  item.next_retry_at = null;
  item.updated_at = nowIso();
  await txPut(QUEUE_STORE, item);
  notifyQueueChanged();
}

export async function discardOfflineMutation(itemId: string): Promise<void> {
  if (!hasOfflineQueueSupport()) {
    return;
  }
  await txDelete(QUEUE_STORE, itemId);
  notifyQueueChanged();
}

export async function getQueueStats(): Promise<{ queued: number; failed: number; total: number }> {
  const rows = await listOfflineQueueItems();
  const queued = rows.filter((row) => row.status === "queued").length;
  const failed = rows.filter((row) => row.status === "failed").length;
  return { queued, failed, total: rows.length };
}

function calculateBackoffMs(attempts: number): number {
  const base = 2000;
  const cap = 60000;
  const expo = Math.min(cap, base * Math.max(1, 2 ** Math.max(0, attempts - 1)));
  return expo;
}

export function applyBackoffForAttempt(attempts: number): string {
  return new Date(Date.now() + calculateBackoffMs(attempts)).toISOString();
}

async function resolveEntityId(id: number): Promise<number> {
  if (id >= 0) {
    return id;
  }
  const mapped = await getIdMapping(id);
  if (mapped === null) {
    throw new Error(`Unresolved dependency for local id ${id}`);
  }
  return mapped;
}

async function resolveUrlPath(rawUrl: string): Promise<string> {
  const parts = rawUrl.split("/");
  const resolvedParts: string[] = [];
  for (const part of parts) {
    if (/^-\d+$/.test(part)) {
      const resolved = await resolveEntityId(Number(part));
      resolvedParts.push(String(resolved));
    } else {
      resolvedParts.push(part);
    }
  }
  return resolvedParts.join("/");
}

async function resolvePayloadIds(value: unknown): Promise<unknown> {
  if (Array.isArray(value)) {
    const mapped: unknown[] = [];
    for (const item of value) {
      mapped.push(await resolvePayloadIds(item));
    }
    return mapped;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    const out: Record<string, unknown> = {};
    for (const [key, raw] of entries) {
      if (typeof raw === "number" && key.endsWith("_id") && raw < 0) {
        out[key] = await resolveEntityId(raw);
      } else {
        out[key] = await resolvePayloadIds(raw);
      }
    }
    return out;
  }

  return value;
}

async function markItemFailed(
  item: OfflineQueueItem,
  errorMessage: string,
  options: { conflict: boolean }
): Promise<void> {
  const attempts = item.attempts + 1;
  item.attempts = attempts;
  item.last_error = errorMessage;
  item.updated_at = nowIso();
  item.status = options.conflict ? "failed" : "queued";
  item.next_retry_at = options.conflict ? null : applyBackoffForAttempt(attempts);
  await txPut(QUEUE_STORE, item);
  notifyQueueChanged();
}

async function shouldSkipByBackoff(item: OfflineQueueItem): Promise<boolean> {
  if (!item.next_retry_at) {
    return false;
  }
  return new Date(item.next_retry_at).getTime() > Date.now();
}

let runningSync: Promise<SyncResult> | null = null;

async function runSyncOfflineQueue(): Promise<SyncResult> {
  if (!hasOfflineQueueSupport()) {
    return { processed: 0, failed: 0, remaining: 0 };
  }
  if (isOfflineNow()) {
    return { processed: 0, failed: 0, remaining: (await getQueueStats()).total };
  }

  const items = await listOfflineQueueItems();
  let processed = 0;
  let failed = 0;

  // @agent-invariant: process queued items deterministically and stop on first non-conflict failure.
  for (const item of items) {
    if (item.status !== "queued") {
      continue;
    }
    if (await shouldSkipByBackoff(item)) {
      continue;
    }

    try {
      const resolvedUrl = await resolveUrlPath(item.url);
      const resolvedPayload = await resolvePayloadIds(item.payload);

      const response = await api.request({
        url: resolvedUrl,
        method: item.method,
        data: resolvedPayload,
        headers: {
          "X-Client-Operation-Id": item.operation_id,
        },
      });

      if (item.entity_id !== null && item.entity_id < 0) {
        const serverId = Number((response.data as Record<string, unknown>)?.id ?? Number.NaN);
        if (Number.isFinite(serverId) && serverId > 0) {
          await setIdMapping(item.entity_id, serverId);
        }
      }

      await txDelete(QUEUE_STORE, item.id);
      processed += 1;
    } catch (error) {
      const conflict = axios.isAxiosError(error) && error.response?.status === 409;
      const errorMessage =
        axios.isAxiosError(error) && error.response?.data
          ? JSON.stringify(error.response.data)
          : error instanceof Error
            ? error.message
            : "Unknown sync error";

      await markItemFailed(item, errorMessage, { conflict });
      failed += 1;

      if (!conflict) {
        break;
      }
    }
  }

  const remaining = (await getQueueStats()).total;
  if (processed > 0 || failed > 0) {
    notifyQueueChanged();
  }
  return { processed, failed, remaining };
}

export async function syncOfflineQueue(): Promise<SyncResult> {
  if (runningSync) {
    return runningSync;
  }
  runningSync = runSyncOfflineQueue().finally(() => {
    runningSync = null;
  });
  return runningSync;
}

export function buildQueuedMessage(actionLabel: string): { message: string } {
  return {
    message: `${actionLabel} wurde offline erfasst und zur Synchronisation vorgemerkt.`,
  };
}
