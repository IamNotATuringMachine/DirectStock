import { api } from "./api";
import type { CustomerProductPrice, ProductPrice, ResolvedPrice } from "../types";

export async function fetchProductBasePrices(productId: number): Promise<ProductPrice[]> {
  const response = await api.get<{ items: ProductPrice[] }>(`/pricing/products/${productId}/base-prices`);
  return response.data.items;
}

export async function createProductBasePrice(
  productId: number,
  payload: {
    net_price: string;
    vat_rate: string;
    currency?: string;
    valid_from?: string | null;
    valid_to?: string | null;
    is_active?: boolean;
  }
): Promise<ProductPrice> {
  const response = await api.post<ProductPrice>(`/pricing/products/${productId}/base-prices`, payload);
  return response.data;
}

export async function fetchCustomerProductPrices(
  customerId: number,
  productId?: number
): Promise<CustomerProductPrice[]> {
  const response = await api.get<{ items: CustomerProductPrice[] }>(
    `/pricing/customers/${customerId}/product-prices`,
    { params: productId ? { product_id: productId } : undefined }
  );
  return response.data.items;
}

export async function upsertCustomerProductPrice(
  customerId: number,
  productId: number,
  payload: {
    net_price: string;
    vat_rate: string;
    currency?: string;
    valid_from: string;
    valid_to?: string | null;
    is_active?: boolean;
  }
): Promise<CustomerProductPrice> {
  const response = await api.put<CustomerProductPrice>(
    `/pricing/customers/${customerId}/product-prices/${productId}`,
    payload
  );
  return response.data;
}

export async function resolveProductPrice(productId: number): Promise<ResolvedPrice> {
  const response = await api.get<ResolvedPrice>("/pricing/resolve", {
    params: { product_id: productId },
  });
  return response.data;
}
