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

export type PurchaseOrderResolveItem = {
  id: number;
  product_id: number;
  product_number: string | null;
  product_name: string | null;
  ordered_quantity: string;
  received_quantity: string;
  open_quantity: string;
  unit: string;
};

export type PurchaseOrderResolveResponse = {
  order: PurchaseOrder;
  items: PurchaseOrderResolveItem[];
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
