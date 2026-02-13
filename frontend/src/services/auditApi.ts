import { api } from "./api";
import type { AuditLogListResponse } from "../types";

export async function fetchAuditLog(params?: {
  page?: number;
  page_size?: number;
  user_id?: number;
  entity?: string;
  action?: string;
  request_id?: string;
  date_from?: string;
  date_to?: string;
}): Promise<AuditLogListResponse> {
  const response = await api.get<AuditLogListResponse>("/audit-log", { params });
  return response.data;
}
