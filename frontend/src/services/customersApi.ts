import { api } from "./api";
import type {
  Customer,
  CustomerContact,
  CustomerContactListResponse,
  CustomerListResponse,
  CustomerLocation,
  CustomerLocationListResponse,
} from "../types";

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

export async function createCustomer(payload: {
  customer_number: string;
  company_name: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  billing_address?: string | null;
  shipping_address?: string | null;
  payment_terms?: string | null;
  delivery_terms?: string | null;
  credit_limit?: string | null;
  is_active?: boolean;
}): Promise<Customer> {
  const response = await api.post<Customer>("/customers", payload);
  return response.data;
}

async function updateCustomer(
  customerId: number,
  payload: {
    company_name?: string;
    contact_name?: string | null;
    email?: string | null;
    phone?: string | null;
    billing_address?: string | null;
    shipping_address?: string | null;
    payment_terms?: string | null;
    delivery_terms?: string | null;
    credit_limit?: string | null;
    is_active?: boolean;
  }
): Promise<Customer> {
  const response = await api.put<Customer>(`/customers/${customerId}`, payload);
  return response.data;
}

export async function deleteCustomer(customerId: number): Promise<void> {
  await api.delete(`/customers/${customerId}`);
}

export async function fetchCustomerLocations(
  customerId: number,
  params?: { isActive?: boolean }
): Promise<CustomerLocation[]> {
  const response = await api.get<CustomerLocationListResponse>(`/customers/${customerId}/locations`, {
    params: {
      is_active: params?.isActive,
    },
  });
  return response.data.items;
}

export async function createCustomerLocation(
  customerId: number,
  payload: {
    location_code: string;
    name: string;
    phone?: string | null;
    email?: string | null;
    street?: string | null;
    house_number?: string | null;
    address_line2?: string | null;
    postal_code?: string | null;
    city?: string | null;
    country_code?: string;
    is_primary?: boolean;
    is_active?: boolean;
  }
): Promise<CustomerLocation> {
  const response = await api.post<CustomerLocation>(`/customers/${customerId}/locations`, payload);
  return response.data;
}

export async function updateCustomerLocation(
  customerId: number,
  locationId: number,
  payload: {
    location_code?: string;
    name?: string;
    phone?: string | null;
    email?: string | null;
    street?: string | null;
    house_number?: string | null;
    address_line2?: string | null;
    postal_code?: string | null;
    city?: string | null;
    country_code?: string;
    is_primary?: boolean;
    is_active?: boolean;
  }
): Promise<CustomerLocation> {
  const response = await api.put<CustomerLocation>(`/customers/${customerId}/locations/${locationId}`, payload);
  return response.data;
}

export async function deleteCustomerLocation(customerId: number, locationId: number): Promise<void> {
  await api.delete(`/customers/${customerId}/locations/${locationId}`);
}

export async function fetchCustomerContacts(
  customerId: number,
  params?: { locationId?: number; isActive?: boolean }
): Promise<CustomerContact[]> {
  const response = await api.get<CustomerContactListResponse>(`/customers/${customerId}/contacts`, {
    params: {
      location_id: params?.locationId,
      is_active: params?.isActive,
    },
  });
  return response.data.items;
}

export async function createCustomerContact(
  customerId: number,
  payload: {
    customer_location_id?: number | null;
    job_title?: string | null;
    salutation?: string | null;
    first_name: string;
    last_name: string;
    phone?: string | null;
    email?: string | null;
    is_primary?: boolean;
    is_active?: boolean;
    notes?: string | null;
  }
): Promise<CustomerContact> {
  const response = await api.post<CustomerContact>(`/customers/${customerId}/contacts`, payload);
  return response.data;
}

async function updateCustomerContact(
  customerId: number,
  contactId: number,
  payload: {
    customer_location_id?: number | null;
    job_title?: string | null;
    salutation?: string | null;
    first_name?: string;
    last_name?: string;
    phone?: string | null;
    email?: string | null;
    is_primary?: boolean;
    is_active?: boolean;
    notes?: string | null;
  }
): Promise<CustomerContact> {
  const response = await api.put<CustomerContact>(`/customers/${customerId}/contacts/${contactId}`, payload);
  return response.data;
}

export async function deleteCustomerContact(customerId: number, contactId: number): Promise<void> {
  await api.delete(`/customers/${customerId}/contacts/${contactId}`);
}
