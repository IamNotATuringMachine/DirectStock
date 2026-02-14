import { api } from "./api";
import type { ServiceItem } from "../types";

export async function fetchServices(params?: {
  page?: number;
  pageSize?: number;
  status?: string;
}): Promise<{ items: ServiceItem[]; total: number; page: number; page_size: number }> {
  const response = await api.get<{ items: ServiceItem[]; total: number; page: number; page_size: number }>("/services", {
    params: {
      page: params?.page ?? 1,
      page_size: params?.pageSize ?? 50,
      status: params?.status,
    },
  });
  return response.data;
}

export async function createService(payload: {
  service_number?: string;
  name: string;
  description?: string | null;
  net_price: string;
  vat_rate: string;
  currency?: string;
  status?: "active" | "blocked" | "archived";
}): Promise<ServiceItem> {
  const response = await api.post<ServiceItem>("/services", payload);
  return response.data;
}

export async function updateService(
  serviceId: number,
  payload: {
    name?: string;
    description?: string | null;
    net_price?: string;
    vat_rate?: string;
    currency?: string;
    status?: "active" | "blocked" | "archived";
  }
): Promise<ServiceItem> {
  const response = await api.put<ServiceItem>(`/services/${serviceId}`, payload);
  return response.data;
}

export async function deleteService(serviceId: number): Promise<{ message: string }> {
  const response = await api.delete<{ message: string }>(`/services/${serviceId}`);
  return response.data;
}
