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

export async function fetchAllProducts(params?: {
  search?: string;
  groupId?: number;
  status?: ProductStatus;
  maxPages?: number;
}): Promise<ProductListResponse> {
  const pageSize = 200;
  const maxPages = params?.maxPages ?? 100;
  let page = 1;
  let total = 0;
  const items: Product[] = [];

  while (page <= maxPages) {
    const response = await fetchProducts({
      page,
      pageSize,
      search: params?.search,
      groupId: params?.groupId,
      status: params?.status,
    });

    total = response.total;
    items.push(...response.items);

    if (items.length >= response.total || response.items.length === 0) {
      break;
    }
    page += 1;
  }

  return {
    items,
    total: total || items.length,
    page: 1,
    page_size: items.length || pageSize,
  };
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
