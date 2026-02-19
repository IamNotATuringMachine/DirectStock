import type { GoodsIssue, GoodsIssueItem } from "../../types";
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
import { toGoodsIssueFromQueue, toGoodsIssueItemFromQueue } from "./offlineMappers";

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
