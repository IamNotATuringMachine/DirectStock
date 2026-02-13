import { api } from "./api";
import type {
  InterWarehouseTransfer,
  InterWarehouseTransferDetail,
  InterWarehouseTransferItem,
} from "../types";

export async function fetchInterWarehouseTransfers(): Promise<InterWarehouseTransfer[]> {
  const response = await api.get<InterWarehouseTransfer[]>("/inter-warehouse-transfers");
  return response.data;
}

export async function createInterWarehouseTransfer(payload: {
  transfer_number?: string;
  from_warehouse_id: number;
  to_warehouse_id: number;
  notes?: string;
}): Promise<InterWarehouseTransfer> {
  const response = await api.post<InterWarehouseTransfer>("/inter-warehouse-transfers", payload);
  return response.data;
}

export async function fetchInterWarehouseTransfer(transferId: number): Promise<InterWarehouseTransferDetail> {
  const response = await api.get<InterWarehouseTransferDetail>(`/inter-warehouse-transfers/${transferId}`);
  return response.data;
}

export async function createInterWarehouseTransferItem(
  transferId: number,
  payload: {
    product_id: number;
    from_bin_id: number;
    to_bin_id: number;
    requested_quantity: string;
    unit?: string;
    batch_number?: string | null;
    serial_numbers?: string[] | null;
  }
): Promise<InterWarehouseTransferItem> {
  const response = await api.post<InterWarehouseTransferItem>(
    `/inter-warehouse-transfers/${transferId}/items`,
    payload
  );
  return response.data;
}

export async function dispatchInterWarehouseTransfer(transferId: number): Promise<{ message: string }> {
  const response = await api.post<{ message: string }>(`/inter-warehouse-transfers/${transferId}/dispatch`);
  return response.data;
}

export async function receiveInterWarehouseTransfer(transferId: number): Promise<{ message: string }> {
  const response = await api.post<{ message: string }>(`/inter-warehouse-transfers/${transferId}/receive`);
  return response.data;
}

export async function cancelInterWarehouseTransfer(transferId: number): Promise<{ message: string }> {
  const response = await api.post<{ message: string }>(`/inter-warehouse-transfers/${transferId}/cancel`);
  return response.data;
}
