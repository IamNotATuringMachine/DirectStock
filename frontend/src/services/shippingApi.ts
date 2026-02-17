import { api } from "./api";
import {
  allocateLocalEntityId,
  buildQueuedMessage,
  enqueueOfflineMutation,
  isOfflineNow,
  listOfflineQueueItems,
  listOfflineQueueItemsByEntity,
  listOfflineQueuedEntities,
  shouldQueueOfflineMutation,
  type OfflineQueueItem,
} from "./offlineQueue";
import type { Shipment, ShipmentEvent, ShipmentTracking } from "../types";

function toShipmentFromQueue(item: OfflineQueueItem): Shipment {
  const payload = (item.payload ?? {}) as {
    shipment_number?: string;
    carrier?: "dhl" | "dpd" | "ups";
    goods_issue_id?: number | null;
    customer_id?: number | null;
    customer_location_id?: number | null;
    recipient_name?: string;
    shipping_address?: string;
    notes?: string;
  };
  const localId = item.entity_id ?? -1;
  return {
    id: localId,
    shipment_number: payload.shipment_number ?? `OFFLINE-SHP-${Math.abs(localId)}`,
    carrier: payload.carrier ?? "dhl",
    status: "draft",
    goods_issue_id: payload.goods_issue_id ?? null,
    customer_id: payload.customer_id ?? null,
    customer_location_id: payload.customer_location_id ?? null,
    tracking_number: null,
    recipient_name: payload.recipient_name ?? null,
    shipping_address: payload.shipping_address ?? null,
    label_document_id: null,
    created_by: null,
    shipped_at: null,
    cancelled_at: null,
    metadata_json: payload.notes ? { notes: payload.notes } : null,
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

function queuedEventFromAction(item: OfflineQueueItem, eventId: number): ShipmentEvent {
  const eventTypeByEntity: Record<string, { event_type: string; status: string; description: string }> = {
    shipment_label_create: {
      event_type: "label_requested_offline",
      status: "label_requested",
      description: "Label-Erzeugung offline vorgemerkt",
    },
    shipment_cancel: {
      event_type: "shipment_cancel_requested_offline",
      status: "cancel_requested",
      description: "Shipment-Storno offline vorgemerkt",
    },
  };

  const mapped = eventTypeByEntity[item.entity_type ?? ""];
  return {
    id: eventId,
    shipment_id: item.parent_entity_id ?? -1,
    event_type: mapped?.event_type ?? "offline_action",
    status: mapped?.status ?? "queued",
    description: mapped?.description ?? "Offline-Aktion vorgemerkt",
    event_at: item.created_at,
    source: "offline_queue",
    payload_json: null,
    created_by: null,
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

async function applyQueuedShipmentActions(shipment: Shipment): Promise<Shipment> {
  const [cancelRows, labelRows] = await Promise.all([
    listOfflineQueueItemsByEntity("shipment_cancel", shipment.id),
    listOfflineQueueItemsByEntity("shipment_label_create", shipment.id),
  ]);

  if (cancelRows.length > 0) {
    return {
      ...shipment,
      status: "cancelled",
      cancelled_at: cancelRows[cancelRows.length - 1]?.created_at ?? shipment.cancelled_at,
      updated_at: cancelRows[cancelRows.length - 1]?.updated_at ?? shipment.updated_at,
    };
  }

  if (labelRows.length > 0 && shipment.status === "draft") {
    return {
      ...shipment,
      status: "label_requested",
      updated_at: labelRows[labelRows.length - 1]?.updated_at ?? shipment.updated_at,
    };
  }

  return shipment;
}

export async function fetchShipments(params?: {
  status?: string;
  carrier?: "dhl" | "dpd" | "ups";
}): Promise<Shipment[]> {
  let serverItems: Shipment[] = [];
  if (!isOfflineNow()) {
    const response = await api.get<Shipment[]>("/shipments", {
      params: {
        status: params?.status || undefined,
        carrier: params?.carrier || undefined,
      },
    });
    serverItems = response.data;
  }

  const queuedCreates = await listOfflineQueuedEntities("shipment");
  const queuedItems = queuedCreates.map(toShipmentFromQueue);
  const merged = [...queuedItems, ...serverItems];

  const withQueuedActions: Shipment[] = [];
  for (const shipment of merged) {
    withQueuedActions.push(await applyQueuedShipmentActions(shipment));
  }

  withQueuedActions.sort((a, b) => {
    const byCreatedAt = b.created_at.localeCompare(a.created_at);
    if (byCreatedAt !== 0) {
      return byCreatedAt;
    }
    return b.id - a.id;
  });

  if (params?.status) {
    return withQueuedActions.filter((shipment) => shipment.status === params.status);
  }
  if (params?.carrier) {
    return withQueuedActions.filter((shipment) => shipment.carrier === params.carrier);
  }
  return withQueuedActions;
}

export async function createShipment(payload: {
  shipment_number?: string;
  carrier: "dhl" | "dpd" | "ups";
  goods_issue_id?: number | null;
  customer_id?: number | null;
  customer_location_id?: number | null;
  recipient_name?: string;
  shipping_address?: string;
  notes?: string;
}): Promise<Shipment> {
  const url = "/shipments";
  if (shouldQueueOfflineMutation("POST", url)) {
    const localId = await allocateLocalEntityId();
    const queued = await enqueueOfflineMutation({
      method: "POST",
      url,
      payload,
      entityType: "shipment",
      entityId: localId,
    });
    return toShipmentFromQueue(queued);
  }

  const response = await api.post<Shipment>(url, payload);
  return response.data;
}

export async function fetchShipment(shipmentId: number): Promise<Shipment> {
  if (shipmentId < 0 || isOfflineNow()) {
    const shipments = await fetchShipments();
    const found = shipments.find((item) => item.id === shipmentId);
    if (!found) {
      throw new Error("Shipment not available offline");
    }
    return found;
  }

  const response = await api.get<Shipment>(`/shipments/${shipmentId}`);
  return response.data;
}

export async function createShipmentLabel(shipmentId: number): Promise<Shipment> {
  const url = `/shipments/${shipmentId}/create-label`;
  if (shouldQueueOfflineMutation("POST", url)) {
    await enqueueOfflineMutation({
      method: "POST",
      url,
      payload: {},
      entityType: "shipment_label_create",
      parentEntityId: shipmentId,
    });
    const shipment = await fetchShipment(shipmentId);
    return {
      ...shipment,
      status: "label_requested",
      updated_at: new Date().toISOString(),
    };
  }

  const response = await api.post<Shipment>(url);
  return response.data;
}

export async function fetchShipmentTracking(shipmentId: number, refresh = false): Promise<ShipmentTracking> {
  if (shipmentId < 0 || isOfflineNow()) {
    const shipment = await fetchShipment(shipmentId);
    const rows = await listOfflineQueueItems();
    const shipmentRows = rows
      .filter(
        (item) =>
          item.parent_entity_id === shipmentId &&
          ["shipment_label_create", "shipment_cancel"].includes(item.entity_type ?? "")
      )
      .sort((a, b) => a.created_at.localeCompare(b.created_at));

    const events = shipmentRows.map((item, index) => queuedEventFromAction(item, -1000 - index));
    return { shipment, events };
  }

  const response = await api.get<ShipmentTracking>(`/shipments/${shipmentId}/tracking`, {
    params: { refresh: refresh ? "true" : undefined },
  });
  return response.data;
}

export async function cancelShipment(shipmentId: number): Promise<{ message: string }> {
  const url = `/shipments/${shipmentId}/cancel`;
  if (shouldQueueOfflineMutation("POST", url)) {
    await enqueueOfflineMutation({
      method: "POST",
      url,
      payload: {},
      entityType: "shipment_cancel",
      parentEntityId: shipmentId,
    });
    return buildQueuedMessage("Shipment-Storno");
  }

  const response = await api.post<{ message: string }>(url);
  return response.data;
}

export async function downloadDocument(documentId: number): Promise<Blob> {
  if (isOfflineNow()) {
    throw new Error("Dokumentdownload ist offline nicht verfuegbar");
  }
  const response = await api.get(`/documents/${documentId}/download`, {
    responseType: "blob",
  });
  return response.data as Blob;
}
