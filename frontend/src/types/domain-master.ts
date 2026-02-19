
export type ProductStatus = "active" | "blocked" | "deprecated" | "archived";

export type Product = {
  id: number;
  product_number: string;
  name: string;
  description: string | null;
  product_group_id: number | null;
  group_name: string | null;
  unit: string;
  status: ProductStatus;
  requires_item_tracking: boolean;
  default_bin_id: number | null;
  created_at: string;
  updated_at: string;
};

export type ProductGroup = {
  id: number;
  name: string;
  description: string | null;
  parent_id: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductListResponse = {
  items: Product[];
  total: number;
  page: number;
  page_size: number;
};

export type ProductCreatePayload = {
  product_number: string;
  name: string;
  description?: string | null;
  product_group_id?: number | null;
  product_group_name?: string;
  unit: string;
  status: ProductStatus;
  requires_item_tracking?: boolean;
  default_bin_id?: number | null;
};

export type ProductUpdatePayload = Partial<Omit<ProductCreatePayload, "product_number">>;

export type ProductGroupCreatePayload = {
  name: string;
  description?: string | null;
  parent_id?: number | null;
  is_active?: boolean;
};

export type Supplier = {
  id: number;
  supplier_number: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type SupplierListResponse = {
  items: Supplier[];
  total: number;
  page: number;
  page_size: number;
};

export type ProductSupplierRelation = {
  id: number;
  product_id: number;
  supplier_id: number;
  supplier_product_number: string | null;
  price: string | null;
  lead_time_days: number | null;
  min_order_quantity: string | null;
  is_preferred: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductWarehouseSetting = {
  id: number;
  product_id: number;
  warehouse_id: number;
  ean: string | null;
  gtin: string | null;
  net_weight: string | null;
  gross_weight: string | null;
  length_cm: string | null;
  width_cm: string | null;
  height_cm: string | null;
  min_stock: string | null;
  reorder_point: string | null;
  max_stock: string | null;
  safety_stock: string | null;
  lead_time_days: number | null;
  qr_code_data: string | null;
  created_at: string;
  updated_at: string;
};

export type Customer = {
  id: number;
  customer_number: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  billing_address: string | null;
  shipping_address: string | null;
  payment_terms: string | null;
  delivery_terms: string | null;
  credit_limit: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CustomerListResponse = {
  items: Customer[];
  total: number;
  page: number;
  page_size: number;
};

export type CustomerLocation = {
  id: number;
  customer_id: number;
  location_code: string;
  name: string;
  phone: string | null;
  email: string | null;
  street: string | null;
  house_number: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country_code: string;
  is_primary: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CustomerLocationListResponse = {
  items: CustomerLocation[];
};

export type CustomerContact = {
  id: number;
  customer_id: number;
  customer_location_id: number | null;
  job_title: string | null;
  salutation: string | null;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  is_primary: boolean;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomerContactListResponse = {
  items: CustomerContact[];
};

export type Warehouse = {
  id: number;
  code: string;
  name: string;
  address: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type WarehouseZoneType =
  | "inbound"
  | "storage"
  | "picking"
  | "outbound"
  | "returns"
  | "blocked"
  | "quality";

export type WarehouseZone = {
  id: number;
  warehouse_id: number;
  code: string;
  name: string;
  zone_type: WarehouseZoneType;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type BinLocation = {
  id: number;
  zone_id: number;
  code: string;
  bin_type: WarehouseZoneType;
  max_weight: string | null;
  max_volume: string | null;
  qr_code_data: string | null;
  is_active: boolean;
  is_occupied: boolean;
  occupied_quantity: string;
  created_at: string;
  updated_at: string;
};

export type InventoryItem = {
  product_id: number;
  product_number: string;
  product_name: string;
  total_quantity: string;
  reserved_quantity: string;
  available_quantity: string;
  unit: string;
};

export type InventoryListResponse = {
  items: InventoryItem[];
  total: number;
  page: number;
  page_size: number;
};

export type InventorySummary = {
  total_products_with_stock: number;
  total_quantity: string;
  reserved_quantity: string;
  available_quantity: string;
  low_stock_count: number;
};

export type InventoryByProductItem = {
  inventory_id: number;
  warehouse_id: number;
  warehouse_code: string;
  zone_id: number;
  zone_code: string;
  bin_id: number;
  bin_code: string;
  quantity: string;
  reserved_quantity: string;
  available_quantity: string;
  unit: string;
};

export type InventoryByBinItem = {
  inventory_id: number;
  product_id: number;
  product_number: string;
  product_name: string;
  quantity: string;
  reserved_quantity: string;
  available_quantity: string;
  unit: string;
};

type InventoryBatchItem = {
  id: number;
  product_id: number;
  product_number: string;
  product_name: string;
  warehouse_id: number;
  warehouse_code: string;
  zone_id: number;
  zone_code: string;
  bin_id: number;
  bin_code: string;
  batch_number: string;
  expiry_date: string | null;
  manufactured_at: string | null;
  quantity: string;
  unit: string;
};
