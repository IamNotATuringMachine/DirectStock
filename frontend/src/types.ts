export type RoleName = "admin" | "lagerleiter" | "lagermitarbeiter";

export type AuthUser = {
  id: number;
  username: string;
  email: string | null;
  roles: RoleName[];
  is_active: boolean;
};

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
};

export type ApiError = {
  code: string;
  message: string;
  request_id: string;
  details?: unknown;
};

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
  unit: string;
  status: ProductStatus;
};

export type ProductUpdatePayload = Partial<Omit<ProductCreatePayload, "product_number">>;

export type ProductGroupCreatePayload = {
  name: string;
  description?: string | null;
  parent_id?: number | null;
  is_active?: boolean;
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

export type LowStockItem = {
  product_id: number;
  product_number: string;
  product_name: string;
  warehouse_id: number;
  warehouse_code: string;
  on_hand: string;
  threshold: string;
};

export type MovementItem = {
  id: number;
  movement_type: string;
  reference_type: string | null;
  reference_number: string | null;
  product_id: number;
  product_number: string;
  product_name: string;
  from_bin_code: string | null;
  to_bin_code: string | null;
  quantity: string;
  performed_at: string;
};

export type GoodsReceipt = {
  id: number;
  receipt_number: string;
  supplier_id: number | null;
  status: string;
  received_at: string | null;
  completed_at: string | null;
  created_by: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type GoodsReceiptItem = {
  id: number;
  goods_receipt_id: number;
  product_id: number;
  expected_quantity: string | null;
  received_quantity: string;
  unit: string;
  target_bin_id: number | null;
  created_at: string;
  updated_at: string;
};

export type GoodsIssue = {
  id: number;
  issue_number: string;
  customer_reference: string | null;
  status: string;
  issued_at: string | null;
  completed_at: string | null;
  created_by: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type GoodsIssueItem = {
  id: number;
  goods_issue_id: number;
  product_id: number;
  requested_quantity: string;
  issued_quantity: string;
  unit: string;
  source_bin_id: number | null;
  created_at: string;
  updated_at: string;
};

export type StockTransfer = {
  id: number;
  transfer_number: string;
  status: string;
  transferred_at: string | null;
  completed_at: string | null;
  created_by: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type StockTransferItem = {
  id: number;
  stock_transfer_id: number;
  product_id: number;
  quantity: string;
  unit: string;
  from_bin_id: number;
  to_bin_id: number;
  created_at: string;
  updated_at: string;
};

export type DashboardSummary = {
  total_products: number;
  total_warehouses: number;
  total_bins: number;
  occupied_bins: number;
  utilization_percent: string;
  total_quantity: string;
  low_stock_count: number;
  open_goods_receipts: number;
  open_goods_issues: number;
  open_stock_transfers: number;
};

export type DashboardRecentMovements = {
  items: MovementItem[];
};

export type DashboardLowStock = {
  items: LowStockItem[];
};

export type DashboardActivityToday = {
  date: string;
  movements_today: number;
  completed_goods_receipts_today: number;
  completed_goods_issues_today: number;
  completed_stock_transfers_today: number;
};
