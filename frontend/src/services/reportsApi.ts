import { api } from "./api";
import type {
  DemandForecastResponse,
  ReportAbcResponse,
  ReportInboundOutboundResponse,
  ReportInventoryAccuracyResponse,
  ReportKpi,
  ReportMovementResponse,
  ReportPickingPerformanceResponse,
  ReportPurchaseRecommendationResponse,
  ReportReturnsResponse,
  ReportStockResponse,
  TrendResponse,
} from "../types";

type DateRange = {
  dateFrom?: string;
  dateTo?: string;
  includeExtended?: boolean;
};

function toRangeParams(range: DateRange) {
  return {
    date_from: range.dateFrom,
    date_to: range.dateTo,
    include_extended: range.includeExtended,
  };
}

export async function fetchReportStock(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  warehouseId?: number;
}): Promise<ReportStockResponse> {
  const response = await api.get<ReportStockResponse>("/reports/stock", {
    params: {
      page: params.page ?? 1,
      page_size: params.pageSize ?? 25,
      search: params.search || undefined,
      warehouse_id: params.warehouseId,
    },
  });
  return response.data;
}

export async function fetchReportMovements(params: DateRange & { page?: number; pageSize?: number; movementType?: string }) {
  const response = await api.get<ReportMovementResponse>("/reports/movements", {
    params: {
      page: params.page ?? 1,
      page_size: params.pageSize ?? 25,
      movement_type: params.movementType || undefined,
      ...toRangeParams(params),
    },
  });
  return response.data;
}

export async function fetchReportInboundOutbound(params: DateRange): Promise<ReportInboundOutboundResponse> {
  const response = await api.get<ReportInboundOutboundResponse>("/reports/inbound-outbound", {
    params: toRangeParams(params),
  });
  return response.data;
}

export async function fetchReportInventoryAccuracy(params: DateRange): Promise<ReportInventoryAccuracyResponse> {
  const response = await api.get<ReportInventoryAccuracyResponse>("/reports/inventory-accuracy", {
    params: toRangeParams(params),
  });
  return response.data;
}

export async function fetchReportAbc(params: DateRange & { search?: string }): Promise<ReportAbcResponse> {
  const response = await api.get<ReportAbcResponse>("/reports/abc", {
    params: {
      search: params.search || undefined,
      ...toRangeParams(params),
    },
  });
  return response.data;
}

export async function fetchReportKpis(params: DateRange): Promise<ReportKpi> {
  const response = await api.get<ReportKpi>("/reports/kpis", {
    params: toRangeParams(params),
  });
  return response.data;
}

export async function fetchReportReturns(params: DateRange & { page?: number; pageSize?: number }): Promise<ReportReturnsResponse> {
  const response = await api.get<ReportReturnsResponse>("/reports/returns", {
    params: {
      page: params.page ?? 1,
      page_size: params.pageSize ?? 25,
      ...toRangeParams(params),
    },
  });
  return response.data;
}

export async function fetchReportPickingPerformance(
  params: DateRange & { page?: number; pageSize?: number }
): Promise<ReportPickingPerformanceResponse> {
  const response = await api.get<ReportPickingPerformanceResponse>("/reports/picking-performance", {
    params: {
      page: params.page ?? 1,
      page_size: params.pageSize ?? 25,
      ...toRangeParams(params),
    },
  });
  return response.data;
}

export async function fetchReportPurchaseRecommendations(params: {
  page?: number;
  pageSize?: number;
  status?: string;
}): Promise<ReportPurchaseRecommendationResponse> {
  const response = await api.get<ReportPurchaseRecommendationResponse>("/reports/purchase-recommendations", {
    params: {
      page: params.page ?? 1,
      page_size: params.pageSize ?? 25,
      status: params.status || undefined,
    },
  });
  return response.data;
}

export async function fetchReportTrends(params: DateRange & { productId?: number; warehouseId?: number }): Promise<TrendResponse> {
  const response = await api.get<TrendResponse>("/reports/trends", {
    params: {
      product_id: params.productId,
      warehouse_id: params.warehouseId,
      ...toRangeParams(params),
    },
  });
  return response.data;
}

export async function fetchDemandForecast(params: {
  runId?: number;
  productId?: number;
  warehouseId?: number;
  page?: number;
  pageSize?: number;
}): Promise<DemandForecastResponse> {
  const response = await api.get<DemandForecastResponse>("/reports/demand-forecast", {
    params: {
      run_id: params.runId,
      product_id: params.productId,
      warehouse_id: params.warehouseId,
      page: params.page ?? 1,
      page_size: params.pageSize ?? 25,
    },
  });
  return response.data;
}

export async function recomputeDemandForecast(payload: {
  date_from?: string;
  date_to?: string;
  warehouse_id?: number;
}): Promise<{ message: string }> {
  const response = await api.post<{ message: string }>("/reports/demand-forecast/recompute", payload);
  return response.data;
}

export async function downloadReportCsv(
  report:
    | "stock"
    | "movements"
    | "inbound-outbound"
    | "inventory-accuracy"
    | "abc"
    | "returns"
    | "picking-performance"
    | "purchase-recommendations"
    | "trends"
    | "demand-forecast",
  params: Record<string, string | number | undefined>
): Promise<Blob> {
  const response = await api.get<Blob>(`/reports/${report}`, {
    params: { ...params, format: "csv" },
    responseType: "blob",
  });
  return response.data;
}
