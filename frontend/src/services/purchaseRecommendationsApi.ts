import { api } from "./api";
import type {
  PurchaseRecommendation,
  PurchaseRecommendationListResponse,
} from "../types";

export async function generatePurchaseRecommendations(payload?: {
  warehouse_id?: number;
}): Promise<PurchaseRecommendationListResponse> {
  const response = await api.post<PurchaseRecommendationListResponse>("/purchase-recommendations/generate", payload ?? {});
  return response.data;
}

export async function fetchPurchaseRecommendations(params?: {
  status?: string;
  warehouse_id?: number;
  product_id?: number;
}): Promise<PurchaseRecommendationListResponse> {
  const response = await api.get<PurchaseRecommendationListResponse>("/purchase-recommendations", { params });
  return response.data;
}

export async function convertPurchaseRecommendation(recommendationId: number): Promise<{
  recommendation_id: number;
  purchase_order_id: number;
  purchase_order_number: string;
}> {
  const response = await api.post(`/purchase-recommendations/${recommendationId}/convert-to-po`);
  return response.data;
}

export async function dismissPurchaseRecommendation(recommendationId: number): Promise<PurchaseRecommendation> {
  const response = await api.post<PurchaseRecommendation>(`/purchase-recommendations/${recommendationId}/dismiss`);
  return response.data;
}
