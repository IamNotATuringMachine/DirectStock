import { api } from "./api";
import type { AlertListResponse, AlertRuleListResponse, AlertEvent, AlertRule } from "../types";

export async function fetchAlerts(params: {
  page?: number;
  pageSize?: number;
  status?: string;
  severity?: string;
  alertType?: string;
  ruleId?: number;
  productId?: number;
  warehouseId?: number;
}): Promise<AlertListResponse> {
  const response = await api.get<AlertListResponse>("/alerts", {
    params: {
      page: params.page ?? 1,
      page_size: params.pageSize ?? 25,
      status: params.status || undefined,
      severity: params.severity || undefined,
      alert_type: params.alertType || undefined,
      rule_id: params.ruleId,
      product_id: params.productId,
      warehouse_id: params.warehouseId,
    },
  });
  return response.data;
}

export async function acknowledgeAlert(alertId: number): Promise<AlertEvent> {
  const response = await api.post<AlertEvent>(`/alerts/${alertId}/ack`);
  return response.data;
}

export async function fetchAlertRules(params: {
  page?: number;
  pageSize?: number;
  ruleType?: string;
  isActive?: boolean;
  search?: string;
}): Promise<AlertRuleListResponse> {
  const response = await api.get<AlertRuleListResponse>("/alert-rules", {
    params: {
      page: params.page ?? 1,
      page_size: params.pageSize ?? 25,
      rule_type: params.ruleType || undefined,
      is_active: params.isActive,
      search: params.search || undefined,
    },
  });
  return response.data;
}

export async function createAlertRule(payload: {
  name: string;
  rule_type: "low_stock" | "zero_stock" | "expiry_window";
  severity?: "low" | "medium" | "high" | "critical";
  is_active?: boolean;
  product_id?: number | null;
  warehouse_id?: number | null;
  threshold_quantity?: string | null;
  expiry_days?: number | null;
  dedupe_window_minutes?: number;
  metadata_json?: Record<string, unknown> | null;
}): Promise<AlertRule> {
  const response = await api.post<AlertRule>("/alert-rules", payload);
  return response.data;
}
