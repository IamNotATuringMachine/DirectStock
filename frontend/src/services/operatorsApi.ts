import { api } from "./api";
import type {
  OperationSignoffSettings,
  OperatorUnlockResponse,
  WarehouseOperator,
} from "../types";

export async function fetchOperators(): Promise<WarehouseOperator[]> {
  const response = await api.get<WarehouseOperator[]>("/operators");
  return response.data;
}

export async function createOperator(payload: {
  display_name: string;
  pin?: string;
  pin_enabled?: boolean;
}): Promise<WarehouseOperator> {
  const response = await api.post<WarehouseOperator>("/operators", payload);
  return response.data;
}

export async function updateOperator(
  operatorId: number,
  payload: {
    display_name?: string;
    is_active?: boolean;
    pin?: string;
    clear_pin?: boolean;
    pin_enabled?: boolean;
  }
): Promise<WarehouseOperator> {
  const response = await api.put<WarehouseOperator>(`/operators/${operatorId}`, payload);
  return response.data;
}

export async function deleteOperator(operatorId: number): Promise<{ message: string }> {
  const response = await api.delete<{ message: string }>(`/operators/${operatorId}`);
  return response.data;
}

export async function unlockOperator(pin: string): Promise<OperatorUnlockResponse> {
  const response = await api.post<OperatorUnlockResponse>("/operators/unlock", { pin });
  return response.data;
}

export async function fetchOperationSignoffSettings(): Promise<OperationSignoffSettings> {
  const response = await api.get<OperationSignoffSettings>("/operators/signoff-settings");
  return response.data;
}

export async function updateOperationSignoffSettings(payload: {
  require_pin: boolean;
  require_operator_selection: boolean;
  pin_session_ttl_minutes: number;
}): Promise<OperationSignoffSettings> {
  const response = await api.put<OperationSignoffSettings>("/operators/signoff-settings", payload);
  return response.data;
}
