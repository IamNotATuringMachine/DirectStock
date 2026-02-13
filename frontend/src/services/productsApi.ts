import { api } from "./api";
import type {
  Product,
  ProductCreatePayload,
  ProductGroup,
  ProductGroupCreatePayload,
  ProductListResponse,
  ProductStatus,
  ProductUpdatePayload,
} from "../types";

export type ProductListParams = {
  page: number;
  pageSize: number;
  search?: string;
  groupId?: number;
  status?: ProductStatus;
};

export async function fetchProducts(params: ProductListParams): Promise<ProductListResponse> {
  const response = await api.get<ProductListResponse>("/products", {
    params: {
      page: params.page,
      page_size: params.pageSize,
      search: params.search || undefined,
      group_id: params.groupId,
      status: params.status,
    },
  });
  return response.data;
}

export async function fetchProductGroups(): Promise<ProductGroup[]> {
  const response = await api.get<ProductGroup[]>("/product-groups");
  return response.data;
}

export async function createProduct(payload: ProductCreatePayload): Promise<Product> {
  const response = await api.post<Product>("/products", payload);
  return response.data;
}

export async function updateProduct(productId: number, payload: ProductUpdatePayload): Promise<Product> {
  const response = await api.put<Product>(`/products/${productId}`, payload);
  return response.data;
}

export async function fetchProductById(productId: number): Promise<Product> {
  const response = await api.get<Product>(`/products/${productId}`);
  return response.data;
}

export async function deleteProduct(productId: number): Promise<void> {
  await api.delete(`/products/${productId}`);
}

export async function createProductGroup(payload: ProductGroupCreatePayload): Promise<ProductGroup> {
  const response = await api.post<ProductGroup>("/product-groups", payload);
  return response.data;
}

export async function fetchProductByQr(qrData: string): Promise<Product> {
  const response = await api.get<Product>(`/products/by-qr/${encodeURIComponent(qrData)}`);
  return response.data;
}

export async function fetchProductByEan(ean: string): Promise<Product> {
  const response = await api.get<Product>(`/products/by-ean/${encodeURIComponent(ean)}`);
  return response.data;
}
