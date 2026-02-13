import { api } from "./api";
import type {
  InventoryByBinItem,
  InventoryByProductItem,
  InventoryListResponse,
  InventorySummary,
  LowStockItem,
  MovementItem,
} from "../types";

export async function fetchInventory(params: {
  page: number;
  pageSize: number;
  search?: string;
  warehouseId?: number;
}): Promise<InventoryListResponse> {
  const response = await api.get<InventoryListResponse>("/inventory", {
    params: {
      page: params.page,
      page_size: params.pageSize,
      search: params.search || undefined,
      warehouse_id: params.warehouseId,
    },
  });
  return response.data;
}

export async function fetchInventorySummary(): Promise<InventorySummary> {
  const response = await api.get<InventorySummary>("/inventory/summary");
  return response.data;
}

export async function fetchLowStock(): Promise<LowStockItem[]> {
  const response = await api.get<LowStockItem[]>("/inventory/low-stock");
  return response.data;
}

export async function fetchMovements(limit = 20): Promise<MovementItem[]> {
  const response = await api.get<MovementItem[]>("/inventory/movements", { params: { limit } });
  return response.data;
}

export async function fetchInventoryByProduct(productId: number): Promise<InventoryByProductItem[]> {
  const response = await api.get<InventoryByProductItem[]>(`/inventory/by-product/${productId}`);
  return response.data;
}

export async function fetchInventoryByBin(binId: number): Promise<InventoryByBinItem[]> {
  const response = await api.get<InventoryByBinItem[]>(`/inventory/by-bin/${binId}`);
  return response.data;
}
