import { api } from "./api";
import type { CustomerListResponse } from "../types";

export async function fetchCustomers(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean;
}): Promise<CustomerListResponse> {
  const response = await api.get<CustomerListResponse>("/customers", {
    params: {
      page: params?.page ?? 1,
      page_size: params?.pageSize ?? 200,
      search: params?.search || undefined,
      is_active: params?.isActive,
    },
  });
  return response.data;
}
