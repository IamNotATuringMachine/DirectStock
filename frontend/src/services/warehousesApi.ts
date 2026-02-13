import { api } from "./api";
import type { BinLocation, Warehouse, WarehouseZone, WarehouseZoneType } from "../types";

export async function fetchWarehouses(): Promise<Warehouse[]> {
  const response = await api.get<Warehouse[]>("/warehouses");
  return response.data;
}

export async function createWarehouse(payload: {
  code: string;
  name: string;
  address?: string;
  is_active?: boolean;
}): Promise<Warehouse> {
  const response = await api.post<Warehouse>("/warehouses", payload);
  return response.data;
}

export async function fetchZones(warehouseId: number): Promise<WarehouseZone[]> {
  const response = await api.get<WarehouseZone[]>(`/warehouses/${warehouseId}/zones`);
  return response.data;
}

export async function createZone(
  warehouseId: number,
  payload: { code: string; name: string; zone_type: WarehouseZoneType; is_active?: boolean }
): Promise<WarehouseZone> {
  const response = await api.post<WarehouseZone>(`/warehouses/${warehouseId}/zones`, payload);
  return response.data;
}

export async function fetchBins(zoneId: number): Promise<BinLocation[]> {
  const response = await api.get<BinLocation[]>(`/zones/${zoneId}/bins`);
  return response.data;
}

export async function createBinBatch(
  zoneId: number,
  payload: {
    prefix: string;
    aisle_from: number;
    aisle_to: number;
    shelf_from: number;
    shelf_to: number;
    level_from: number;
    level_to: number;
    bin_type: WarehouseZoneType;
  }
): Promise<{ created_count: number; items: BinLocation[] }> {
  const response = await api.post<{ created_count: number; items: BinLocation[] }>(
    `/zones/${zoneId}/bins/batch`,
    payload
  );
  return response.data;
}

export async function fetchBinByQr(qrData: string): Promise<BinLocation> {
  const response = await api.get<BinLocation>(`/bins/by-qr/${encodeURIComponent(qrData)}`);
  return response.data;
}

export async function downloadBinQrCode(binId: number): Promise<Blob> {
  const response = await api.get(`/bins/${binId}/qr-code`, {
    responseType: "blob",
  });
  return response.data as Blob;
}

export async function downloadBinLabelsPdf(binIds: number[]): Promise<Blob> {
  const response = await api.post(
    "/bins/qr-codes/pdf",
    { bin_ids: binIds },
    { responseType: "blob" }
  );
  return response.data as Blob;
}
