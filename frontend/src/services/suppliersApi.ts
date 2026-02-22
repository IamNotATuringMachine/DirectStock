import { api } from "./api";
import type {
  ProductSupplierRelation,
  Supplier,
  SupplierListResponse,
  SupplierPurchaseEmailTemplate,
} from "../types";

export async function fetchSuppliers(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean;
}): Promise<SupplierListResponse> {
  const response = await api.get<SupplierListResponse>("/suppliers", {
    params: {
      page: params?.page ?? 1,
      page_size: params?.pageSize ?? 200,
      search: params?.search || undefined,
      is_active: params?.isActive,
    },
  });
  return response.data;
}

export async function createSupplier(payload: {
  supplier_number: string;
  company_name: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  is_active?: boolean;
}): Promise<Supplier> {
  const response = await api.post<Supplier>("/suppliers", payload);
  return response.data;
}

export async function updateSupplier(
  supplierId: number,
  payload: {
    company_name?: string;
    contact_name?: string | null;
    email?: string | null;
    phone?: string | null;
    is_active?: boolean;
  }
): Promise<Supplier> {
  const response = await api.put<Supplier>(`/suppliers/${supplierId}`, payload);
  return response.data;
}

export async function deleteSupplier(supplierId: number): Promise<void> {
  await api.delete(`/suppliers/${supplierId}`);
}

export async function fetchProductSuppliers(productId: number): Promise<ProductSupplierRelation[]> {
  const response = await api.get<ProductSupplierRelation[]>(`/products/${productId}/suppliers`);
  return response.data;
}

export async function createProductSupplier(
  productId: number,
  payload: {
    supplier_id: number;
    supplier_product_number?: string | null;
    price?: string | null;
    lead_time_days?: number | null;
    min_order_quantity?: string | null;
    is_preferred?: boolean;
  }
): Promise<ProductSupplierRelation> {
  const response = await api.post<ProductSupplierRelation>(`/products/${productId}/suppliers`, payload);
  return response.data;
}

export async function updateProductSupplier(
  productId: number,
  relationId: number,
  payload: {
    supplier_product_number?: string | null;
    price?: string | null;
    lead_time_days?: number | null;
    min_order_quantity?: string | null;
    is_preferred?: boolean;
  }
): Promise<ProductSupplierRelation> {
  const response = await api.put<ProductSupplierRelation>(`/products/${productId}/suppliers/${relationId}`, payload);
  return response.data;
}

export async function deleteProductSupplier(productId: number, relationId: number): Promise<void> {
  await api.delete(`/products/${productId}/suppliers/${relationId}`);
}

export async function fetchSupplierPurchaseEmailTemplate(
  supplierId: number
): Promise<SupplierPurchaseEmailTemplate> {
  const response = await api.get<SupplierPurchaseEmailTemplate>(`/suppliers/${supplierId}/purchase-email-template`);
  return response.data;
}

export async function updateSupplierPurchaseEmailTemplate(
  supplierId: number,
  payload: {
    salutation?: string | null;
    subject_template?: string | null;
    body_template?: string | null;
    signature?: string | null;
  }
): Promise<SupplierPurchaseEmailTemplate> {
  const response = await api.put<SupplierPurchaseEmailTemplate>(
    `/suppliers/${supplierId}/purchase-email-template`,
    payload
  );
  return response.data;
}
