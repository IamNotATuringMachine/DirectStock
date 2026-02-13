import { api } from "./api";
import type { Shipment, ShipmentTracking } from "../types";

export async function fetchShipments(params?: {
  status?: string;
  carrier?: "dhl" | "dpd" | "ups";
}): Promise<Shipment[]> {
  const response = await api.get<Shipment[]>("/shipments", {
    params: {
      status: params?.status || undefined,
      carrier: params?.carrier || undefined,
    },
  });
  return response.data;
}

export async function createShipment(payload: {
  shipment_number?: string;
  carrier: "dhl" | "dpd" | "ups";
  goods_issue_id?: number | null;
  recipient_name?: string;
  shipping_address?: string;
  notes?: string;
}): Promise<Shipment> {
  const response = await api.post<Shipment>("/shipments", payload);
  return response.data;
}

export async function fetchShipment(shipmentId: number): Promise<Shipment> {
  const response = await api.get<Shipment>(`/shipments/${shipmentId}`);
  return response.data;
}

export async function createShipmentLabel(shipmentId: number): Promise<Shipment> {
  const response = await api.post<Shipment>(`/shipments/${shipmentId}/create-label`);
  return response.data;
}

export async function fetchShipmentTracking(shipmentId: number, refresh = false): Promise<ShipmentTracking> {
  const response = await api.get<ShipmentTracking>(`/shipments/${shipmentId}/tracking`, {
    params: { refresh: refresh ? "true" : undefined },
  });
  return response.data;
}

export async function cancelShipment(shipmentId: number): Promise<{ message: string }> {
  const response = await api.post<{ message: string }>(`/shipments/${shipmentId}/cancel`);
  return response.data;
}

export async function downloadDocument(documentId: number): Promise<Blob> {
  const response = await api.get(`/documents/${documentId}/download`, {
    responseType: "blob",
  });
  return response.data as Blob;
}
