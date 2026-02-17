export type RoleName = string;

export type AuthUser = {
  id: number;
  username: string;
  email: string | null;
  roles: RoleName[];
  permissions?: string[];
  is_active: boolean;
};

export type User = {
  id: number;
  username: string;
  email: string | null;
  full_name: string | null;
  is_active: boolean;
  roles: RoleName[];
  created_at: string;
  updated_at: string;
};

export type UserListResponse = {
  items: User[];
};

export type UserCreatePayload = {
  username: string;
  email?: string | null;
  full_name?: string | null;
  password: string;
  roles: RoleName[];
  is_active: boolean;
};

export type UserUpdatePayload = {
  email?: string | null;
  full_name?: string | null;
  is_active?: boolean;
  roles?: RoleName[];
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
  requires_item_tracking: boolean;
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
  requires_item_tracking?: boolean;
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

export type InventoryBatchItem = {
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
  purchase_order_id: number | null;
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
  batch_number: string | null;
  expiry_date: string | null;
  manufactured_at: string | null;
  serial_numbers: string[] | null;
  purchase_order_item_id: number | null;
  created_at: string;
  updated_at: string;
};

export type GoodsIssue = {
  id: number;
  issue_number: string;
  customer_id: number | null;
  customer_location_id: number | null;
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
  batch_number: string | null;
  use_fefo: boolean;
  serial_numbers: string[] | null;
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
  batch_number: string | null;
  serial_numbers: string[] | null;
  created_at: string;
  updated_at: string;
};

export type Shipment = {
  id: number;
  shipment_number: string;
  carrier: "dhl" | "dpd" | "ups";
  status: string;
  goods_issue_id: number | null;
  customer_id: number | null;
  customer_location_id: number | null;
  tracking_number: string | null;
  recipient_name: string | null;
  shipping_address: string | null;
  label_document_id: number | null;
  created_by: number | null;
  shipped_at: string | null;
  cancelled_at: string | null;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type ShipmentEvent = {
  id: number;
  shipment_id: number;
  event_type: string;
  status: string;
  description: string | null;
  event_at: string;
  source: string;
  payload_json: Record<string, unknown> | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
};

export type ShipmentTracking = {
  shipment: Shipment;
  events: ShipmentEvent[];
};

export type InterWarehouseTransfer = {
  id: number;
  transfer_number: string;
  from_warehouse_id: number;
  to_warehouse_id: number;
  status: "draft" | "dispatched" | "received" | "cancelled";
  requested_at: string | null;
  dispatched_at: string | null;
  received_at: string | null;
  cancelled_at: string | null;
  created_by: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type InterWarehouseTransferItem = {
  id: number;
  inter_warehouse_transfer_id: number;
  product_id: number;
  from_bin_id: number;
  to_bin_id: number;
  requested_quantity: string;
  dispatched_quantity: string;
  received_quantity: string;
  unit: string;
  batch_number: string | null;
  serial_numbers: string[] | null;
  created_at: string;
  updated_at: string;
};

export type InterWarehouseTransferDetail = {
  transfer: InterWarehouseTransfer;
  items: InterWarehouseTransferItem[];
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
  open_inter_warehouse_transfers: number;
  inter_warehouse_transit_quantity: string;
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

export type PurchaseOrder = {
  id: number;
  order_number: string;
  supplier_id: number | null;
  status: "draft" | "approved" | "ordered" | "partially_received" | "completed" | "cancelled";
  expected_delivery_at: string | null;
  ordered_at: string | null;
  completed_at: string | null;
  created_by: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PurchaseOrderItem = {
  id: number;
  purchase_order_id: number;
  product_id: number;
  ordered_quantity: string;
  received_quantity: string;
  unit: string;
  unit_price: string | null;
  expected_delivery_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AbcClassificationRun = {
  id: number;
  date_from: string;
  date_to: string;
  total_outbound_quantity: string;
  generated_by: number | null;
  generated_at: string;
  created_at: string;
  updated_at: string;
};

export type AbcClassification = {
  id: number;
  run_id: number;
  rank: number;
  product_id: number;
  product_number: string;
  product_name: string;
  outbound_quantity: string;
  share_percent: string;
  cumulative_share_percent: string;
  category: string;
  created_at: string;
  updated_at: string;
};

export type AbcClassificationListResponse = {
  run: AbcClassificationRun;
  items: AbcClassification[];
};

export type PurchaseRecommendation = {
  id: number;
  product_id: number;
  warehouse_id: number | null;
  supplier_id: number | null;
  status: string;
  target_stock: string;
  on_hand_quantity: string;
  open_po_quantity: string;
  deficit_quantity: string;
  recommended_quantity: string;
  min_order_quantity: string;
  converted_purchase_order_id: number | null;
  generated_by: number | null;
  generated_at: string;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type PurchaseRecommendationListResponse = {
  items: PurchaseRecommendation[];
  total: number;
};

export type PickWave = {
  id: number;
  wave_number: string;
  status: string;
  notes: string | null;
  released_at: string | null;
  completed_at: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
};

export type PickTask = {
  id: number;
  pick_wave_id: number;
  goods_issue_id: number | null;
  goods_issue_item_id: number | null;
  product_id: number;
  product_number: string;
  product_name: string;
  source_bin_id: number | null;
  source_bin_code: string | null;
  quantity: string;
  picked_quantity: string;
  unit: string;
  status: string;
  sequence_no: number;
  picked_at: string | null;
  picked_by: number | null;
  created_at: string;
  updated_at: string;
};

export type PickWaveDetail = {
  wave: PickWave;
  tasks: PickTask[];
};

export type ReturnOrder = {
  id: number;
  return_number: string;
  customer_id: number | null;
  goods_issue_id: number | null;
  status: string;
  source_type: "customer" | "technician" | null;
  source_reference: string | null;
  notes: string | null;
  registered_at: string | null;
  received_at: string | null;
  inspected_at: string | null;
  resolved_at: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
};

export type ReturnOrderItem = {
  id: number;
  return_order_id: number;
  product_id: number;
  quantity: string;
  unit: string;
  decision: string | null;
  repair_mode: "internal" | "external" | null;
  external_status:
    | "waiting_external_provider"
    | "at_external_provider"
    | "ready_for_use"
    | null;
  external_partner: string | null;
  external_dispatched_at: string | null;
  external_returned_at: string | null;
  target_bin_id: number | null;
  reason: string | null;
  created_at: string;
  updated_at: string;
};

export type ReturnOrderExternalDispatchResponse = {
  item: ReturnOrderItem;
  document_id: number;
};

export type ApprovalRule = {
  id: number;
  name: string;
  entity_type: "purchase_order" | "return_order";
  min_amount: string | null;
  required_role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ApprovalRequest = {
  id: number;
  entity_type: "purchase_order" | "return_order";
  entity_id: number;
  status: string;
  amount: string | null;
  reason: string | null;
  requested_by: number | null;
  requested_at: string;
  decided_by: number | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DocumentFile = {
  id: number;
  entity_type: string;
  entity_id: number;
  document_type: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  version: number;
  uploaded_by: number | null;
  created_at: string;
  updated_at: string;
};

export type DocumentFileListResponse = {
  items: DocumentFile[];
  total: number;
  page: number;
  page_size: number;
};

export type AuditLogEntry = {
  id: number;
  request_id: string;
  user_id: number | null;
  action: string;
  endpoint: string | null;
  method: string | null;
  entity: string;
  entity_id: string | null;
  changed_fields: string[] | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  entity_snapshot_before: Record<string, unknown> | null;
  entity_snapshot_after: Record<string, unknown> | null;
  status_code: number;
  ip_address: string | null;
  error_message: string | null;
  created_at: string;
};

export type AuditLogListResponse = {
  items: AuditLogEntry[];
  total: number;
  page: number;
  page_size: number;
};

export type InventoryCountSession = {
  id: number;
  session_number: string;
  session_type: "snapshot" | "cycle";
  status: "draft" | "in_progress" | "completed" | "cancelled";
  warehouse_id: number | null;
  tolerance_quantity: string;
  generated_at: string | null;
  completed_at: string | null;
  created_by: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type InventoryCountItem = {
  id: number;
  session_id: number;
  inventory_id: number | null;
  product_id: number;
  product_number: string;
  product_name: string;
  bin_location_id: number;
  bin_code: string;
  snapshot_quantity: string;
  counted_quantity: string | null;
  difference_quantity: string | null;
  unit: string;
  count_attempts: number;
  recount_required: boolean;
  last_counted_at: string | null;
  counted_by: number | null;
  created_at: string;
  updated_at: string;
};

export type AlertRule = {
  id: number;
  name: string;
  rule_type: "low_stock" | "zero_stock" | "expiry_window";
  severity: "low" | "medium" | "high" | "critical";
  is_active: boolean;
  product_id: number | null;
  warehouse_id: number | null;
  threshold_quantity: string | null;
  expiry_days: number | null;
  dedupe_window_minutes: number;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type AlertRuleListResponse = {
  items: AlertRule[];
  total: number;
  page: number;
  page_size: number;
};

export type AlertEvent = {
  id: number;
  rule_id: number | null;
  alert_type: "low_stock" | "zero_stock" | "expiry_window" | string;
  severity: "low" | "medium" | "high" | "critical" | string;
  status: "open" | "acknowledged";
  title: string;
  message: string;
  source_key: string;
  product_id: number | null;
  warehouse_id: number | null;
  bin_location_id: number | null;
  batch_id: number | null;
  triggered_at: string;
  acknowledged_at: string | null;
  acknowledged_by: number | null;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type AlertListResponse = {
  items: AlertEvent[];
  total: number;
  page: number;
  page_size: number;
};

export type ReportStockRow = {
  product_id: number;
  product_number: string;
  product_name: string;
  total_quantity: string;
  reserved_quantity: string;
  available_quantity: string;
  unit: string;
};

export type ReportStockResponse = {
  items: ReportStockRow[];
  total: number;
  page: number;
  page_size: number;
};

export type ReportMovementRow = {
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

export type ReportMovementResponse = {
  items: ReportMovementRow[];
  total: number;
  page: number;
  page_size: number;
};

export type ReportInboundOutboundRow = {
  day: string;
  inbound_quantity: string;
  outbound_quantity: string;
  transfer_quantity: string;
  adjustment_quantity: string;
  movement_count: number;
};

export type ReportInboundOutboundResponse = {
  items: ReportInboundOutboundRow[];
};

export type ReportInventoryAccuracySessionRow = {
  session_id: number;
  session_number: string;
  completed_at: string | null;
  total_items: number;
  counted_items: number;
  exact_match_items: number;
  recount_required_items: number;
  accuracy_percent: string;
};

export type ReportInventoryAccuracyResponse = {
  total_sessions: number;
  total_items: number;
  counted_items: number;
  exact_match_items: number;
  recount_required_items: number;
  overall_accuracy_percent: string;
  sessions: ReportInventoryAccuracySessionRow[];
};

export type ReportAbcRow = {
  rank: number;
  product_id: number;
  product_number: string;
  product_name: string;
  outbound_quantity: string;
  share_percent: string;
  cumulative_share_percent: string;
  category: "A" | "B" | "C";
};

export type ReportAbcResponse = {
  items: ReportAbcRow[];
};

export type ReportKpi = {
  date_from: string;
  date_to: string;
  turnover_rate: string;
  dock_to_stock_hours: string;
  inventory_accuracy_percent: string;
  alert_count: number;
  pick_accuracy_rate: string;
  returns_rate: string;
  approval_cycle_hours: string;
  inter_warehouse_transfers_in_transit: number;
  inter_warehouse_transit_quantity: string;
};

export type ReportReturnsRow = {
  return_order_id: number;
  return_number: string;
  status: string;
  total_items: number;
  total_quantity: string;
  restock_items: number;
  internal_repair_items: number;
  external_repair_items: number;
  scrap_items: number;
  return_supplier_items: number;
  created_at: string;
};

export type ReportReturnsResponse = {
  items: ReportReturnsRow[];
  total: number;
  page: number;
  page_size: number;
};

export type ReportPickingPerformanceRow = {
  wave_id: number;
  wave_number: string;
  status: string;
  total_tasks: number;
  picked_tasks: number;
  skipped_tasks: number;
  open_tasks: number;
  pick_accuracy_percent: string;
  created_at: string;
  completed_at: string | null;
};

export type ReportPickingPerformanceResponse = {
  items: ReportPickingPerformanceRow[];
  total: number;
  page: number;
  page_size: number;
};

export type ReportPurchaseRecommendationRow = {
  recommendation_id: number;
  product_id: number;
  status: string;
  target_stock: string;
  on_hand_quantity: string;
  open_po_quantity: string;
  deficit_quantity: string;
  recommended_quantity: string;
  generated_at: string;
};

export type ReportPurchaseRecommendationResponse = {
  items: ReportPurchaseRecommendationRow[];
  total: number;
  page: number;
  page_size: number;
};

export type TrendRow = {
  day: string;
  product_id: number;
  product_number: string;
  product_name: string;
  outbound_quantity: string;
};

export type TrendResponse = {
  items: TrendRow[];
};

export type ForecastRow = {
  run_id: number;
  product_id: number;
  product_number: string;
  product_name: string;
  warehouse_id: number | null;
  historical_mean: string;
  trend_slope: string;
  confidence_score: string;
  history_days_used: number;
  forecast_qty_7: string;
  forecast_qty_30: string;
  forecast_qty_90: string;
};

export type DemandForecastResponse = {
  items: ForecastRow[];
  total: number;
};

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

export type ServiceItem = {
  id: number;
  service_number: string;
  name: string;
  description: string | null;
  net_price: string;
  vat_rate: string;
  gross_price: string;
  currency: string;
  status: "active" | "blocked" | "archived";
  created_at: string;
  updated_at: string;
};

export type SalesOrderItem = {
  id: number;
  sales_order_id: number;
  line_no: number;
  item_type: "product" | "service";
  product_id: number | null;
  service_id: number | null;
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
