import type { OperationSignoffSummary } from "./domain-ops";

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
  mode: "po" | "free";
  source_type: "supplier" | "technician" | "other";
  status: string;
  received_at: string | null;
  completed_at: string | null;
  created_by: number | null;
  operation_signoff?: OperationSignoffSummary | null;
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
  input_method: "scan" | "manual";
  condition: string;
  product_number: string | null;
  product_name: string | null;
  target_bin_code: string | null;
  expected_open_quantity: string | null;
  variance_quantity: string | null;
  created_at: string;
  updated_at: string;
};

export type BinSuggestion = {
  bin_id: number;
  bin_code: string;
  zone_id: number;
  zone_code: string;
  warehouse_id: number;
  warehouse_code: string;
  priority: "default" | "existing";
  current_quantity: string;
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
  operation_signoff?: OperationSignoffSummary | null;
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
  carrier: "dhl" | "dhl_express" | "dpd" | "ups";
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
