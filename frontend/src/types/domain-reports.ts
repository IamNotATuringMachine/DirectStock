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
