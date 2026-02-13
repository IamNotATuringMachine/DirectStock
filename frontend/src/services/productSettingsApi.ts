import { api } from "./api";
import type { ProductWarehouseSetting } from "../types";

export async function fetchProductWarehouseSettings(productId: number): Promise<ProductWarehouseSetting[]> {
  const response = await api.get<ProductWarehouseSetting[]>(`/products/${productId}/warehouse-settings`);
  return response.data;
}

export async function upsertProductWarehouseSetting(
  productId: number,
  warehouseId: number,
  payload: {
    ean?: string | null;
    gtin?: string | null;
    net_weight?: string | null;
    gross_weight?: string | null;
    length_cm?: string | null;
    width_cm?: string | null;
    height_cm?: string | null;
    min_stock?: string | null;
    reorder_point?: string | null;
    max_stock?: string | null;
    safety_stock?: string | null;
    lead_time_days?: number | null;
    qr_code_data?: string | null;
  }
): Promise<ProductWarehouseSetting> {
  const response = await api.put<ProductWarehouseSetting>(
    `/products/${productId}/warehouse-settings/${warehouseId}`,
    payload
  );
  return response.data;
}

export async function deleteProductWarehouseSetting(productId: number, warehouseId: number): Promise<void> {
  await api.delete(`/products/${productId}/warehouse-settings/${warehouseId}`);
}
