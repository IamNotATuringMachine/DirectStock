import { OFFLINE_SCOPE_PREFIXES, type OfflineQueueItem } from "./offlineQueueTypes";

type IdMapEntry = {
  local_id: number;
  server_id: number;
};

const DB_NAME = "directstock_offline_queue";
const DB_VERSION = 1;
export const QUEUE_STORE = "queue";
const IDMAP_STORE = "id_map";
const META_STORE = "meta";
const META_LOCAL_COUNTER_KEY = "local_counter";
const QUEUE_EVENT_NAME = "directstock-offline-queue-changed";

export function isOfflineScope(url: string): boolean {
  return OFFLINE_SCOPE_PREFIXES.some((prefix) => url.startsWith(prefix));
}

function isBrowser() {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

export function hasOfflineQueueSupport() {
  return isBrowser();
}

export function notifyQueueChanged() {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent(QUEUE_EVENT_NAME));
}

export function subscribeOfflineQueueChanges(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const handler = () => listener();
  window.addEventListener(QUEUE_EVENT_NAME, handler);
  return () => window.removeEventListener(QUEUE_EVENT_NAME, handler);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        const queue = db.createObjectStore(QUEUE_STORE, { keyPath: "id" });
        queue.createIndex("status", "status", { unique: false });
        queue.createIndex("created_at", "created_at", { unique: false });
        queue.createIndex("entity_type", "entity_type", { unique: false });
        queue.createIndex("parent_entity_id", "parent_entity_id", { unique: false });
      }
      if (!db.objectStoreNames.contains(IDMAP_STORE)) {
        db.createObjectStore(IDMAP_STORE, { keyPath: "local_id" });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open IndexedDB"));
  });
}

async function txReadAll<T>(storeName: string): Promise<T[]> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve((request.result ?? []) as T[]);
    request.onerror = () => reject(request.error ?? new Error("readAll failed"));
  });
}

export async function txGet<T>(storeName: string, key: IDBValidKey): Promise<T | null> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("get failed"));
  });
}

export async function txPut<T>(storeName: string, value: T): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    store.put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("put failed"));
  });
}

export async function txDelete(storeName: string, key: IDBValidKey): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    store.delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("delete failed"));
  });
}

export async function getLocalCounter(): Promise<number> {
  const row = await txGet<{ key: string; value: number }>(META_STORE, META_LOCAL_COUNTER_KEY);
  return row?.value ?? 0;
}

export async function setLocalCounter(value: number): Promise<void> {
  await txPut(META_STORE, { key: META_LOCAL_COUNTER_KEY, value });
}

export async function setIdMapping(localId: number, serverId: number): Promise<void> {
  if (!hasOfflineQueueSupport()) {
    return;
  }
  await txPut<IdMapEntry>(IDMAP_STORE, { local_id: localId, server_id: serverId });
}

export async function getIdMapping(localId: number): Promise<number | null> {
  if (!hasOfflineQueueSupport()) {
    return null;
  }
  const entry = await txGet<IdMapEntry>(IDMAP_STORE, localId);
  return entry?.server_id ?? null;
}

export async function listQueueRows(): Promise<OfflineQueueItem[]> {
  const rows = await txReadAll<OfflineQueueItem>(QUEUE_STORE);
  return rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
}
