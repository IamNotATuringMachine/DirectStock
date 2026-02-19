export type OfflineQueueStatus = "queued" | "failed";

export type OfflineQueueItem = {
  id: string;
  operation_id: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  payload: unknown;
  status: OfflineQueueStatus;
  attempts: number;
  next_retry_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  entity_type: string | null;
  entity_id: number | null;
  parent_entity_id: number | null;
};

export type EnqueueInput = {
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  payload: unknown;
  entityType?: string | null;
  entityId?: number | null;
  parentEntityId?: number | null;
  operationId?: string;
};

export type SyncResult = { processed: number; failed: number; remaining: number };

export const OFFLINE_SCOPE_PREFIXES = [
  "/goods-receipts",
  "/goods-issues",
  "/stock-transfers",
  "/inventory-counts",
  "/pick-waves",
  "/pick-tasks",
  "/return-orders",
  "/inter-warehouse-transfers",
  "/shipments",
  "/sales-orders",
  "/invoices",
];
