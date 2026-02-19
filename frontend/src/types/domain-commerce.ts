export type Permission = {
  code: string;
  description: string | null;
};

export type Page = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
};

export type Role = {
  id: number;
  name: string;
  description: string | null;
  permissions: string[];
};

export type ThemePreference = {
  theme: "system" | "light" | "dark";
  compact_mode: boolean;
  show_help: boolean;
};

export type DashboardCardCatalogItem = {
  card_key: string;
  title: string;
  description: string | null;
  default_order: number;
  is_active: boolean;
};

export type DashboardConfigItem = {
  card_key: string;
  visible: boolean;
  display_order: number;
};

export type DashboardConfig = {
  cards: DashboardConfigItem[];
};

export type ProductPrice = {
  id: number;
  product_id: number;
  net_price: string;
  vat_rate: string;
  gross_price: string;
  currency: string;
  valid_from: string | null;
  valid_to: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CustomerProductPrice = {
  id: number;
  customer_id: number;
  product_id: number;
  net_price: string;
  vat_rate: string;
  gross_price: string;
  currency: string;
  valid_from: string;
  valid_to: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ResolvedPrice = {
  source: "customer" | "base" | "none";
  net_price: string | null;
  vat_rate: string | null;
  gross_price: string | null;
  currency: string | null;
};

export type SalesOrderItem = {
  id: number;
  sales_order_id: number;
  line_no: number;
  item_type: "product";
  product_id: number | null;
  description: string | null;
  quantity: string;
  delivered_quantity: string;
  invoiced_quantity: string;
  unit: string;
  net_unit_price: string;
  vat_rate: string;
  gross_unit_price: string;
  created_at: string;
  updated_at: string;
};

export type SalesOrder = {
  id: number;
  order_number: string;
  customer_id: number | null;
  customer_location_id: number | null;
  status: string;
  ordered_at: string | null;
  completed_at: string | null;
  created_by: number | null;
  currency: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type SalesOrderDetail = {
  order: SalesOrder;
  items: SalesOrderItem[];
};

export type SalesOrderListResponse = {
  items: SalesOrder[];
  total: number;
  page: number;
  page_size: number;
};

export type InvoiceItem = {
  id: number;
  invoice_id: number;
  sales_order_item_id: number | null;
  line_no: number;
  description: string | null;
  quantity: string;
  unit: string;
  net_unit_price: string;
  vat_rate: string;
  net_total: string;
  tax_total: string;
  gross_total: string;
  created_at: string;
  updated_at: string;
};

export type Invoice = {
  id: number;
  invoice_number: string;
  sales_order_id: number;
  status: string;
  issued_at: string | null;
  due_at: string | null;
  created_by: number | null;
  currency: string;
  total_net: string;
  total_tax: string;
  total_gross: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type InvoiceDetail = {
  invoice: Invoice;
  items: InvoiceItem[];
};

export type InvoiceListResponse = {
  items: Invoice[];
  total: number;
  page: number;
  page_size: number;
};

export type InvoiceExportResult = {
  export_id: number;
  invoice_id: number;
  export_type: string;
  status: string;
  document_id: number | null;
  error_message: string | null;
  validator_report: Record<string, unknown> | null;
};
