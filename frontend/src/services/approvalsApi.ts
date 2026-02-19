import { api } from "./api";
import type { ApprovalRequest, ApprovalRule } from "../types";

export async function fetchApprovalRules(entityType?: "purchase_order" | "return_order"): Promise<ApprovalRule[]> {
  const response = await api.get<ApprovalRule[]>("/approval-rules", {
    params: { entity_type: entityType },
  });
  return response.data;
}

export async function createApprovalRule(payload: {
  name: string;
  entity_type: "purchase_order" | "return_order";
  min_amount?: string | null;
  required_role?: string;
  is_active?: boolean;
}): Promise<ApprovalRule> {
  const response = await api.post<ApprovalRule>("/approval-rules", payload);
  return response.data;
}

export async function fetchApprovals(params?: {
  status?: string;
  entity_type?: string;
  entity_id?: number;
}): Promise<ApprovalRequest[]> {
  const response = await api.get<ApprovalRequest[]>("/approvals", { params });
  return response.data;
}

async function createApprovalRequest(payload: {
  entity_type: "purchase_order" | "return_order";
  entity_id: number;
  amount?: string | null;
  reason?: string;
}): Promise<ApprovalRequest> {
  const response = await api.post<ApprovalRequest>("/approvals", payload);
  return response.data;
}

export async function approveRequest(requestId: number, comment?: string): Promise<ApprovalRequest> {
  const response = await api.post<ApprovalRequest>(`/approvals/${requestId}/approve`, { comment });
  return response.data;
}

export async function rejectRequest(requestId: number, comment?: string): Promise<ApprovalRequest> {
  const response = await api.post<ApprovalRequest>(`/approvals/${requestId}/reject`, { comment });
  return response.data;
}
