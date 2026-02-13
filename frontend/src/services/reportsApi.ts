import { api } from "./api";
import type {
  ReportAbcResponse,
  ReportInboundOutboundResponse,
  ReportInventoryAccuracyResponse,
  ReportKpi,
  ReportMovementResponse,
  ReportStockResponse,
} from "../types";

type DateRange = {
  dateFrom?: string;
  dateTo?: string;
};

function toRangeParams(range: DateRange) {
  return {
    date_from: range.dateFrom,
    date_to: range.dateTo,
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

export async function downloadReportCsv(
  report:
    | "stock"
    | "movements"
    | "inbound-outbound"
    | "inventory-accuracy"
    | "abc",
  params: Record<string, string | number | undefined>
): Promise<Blob> {
  const response = await api.get<Blob>(`/reports/${report}`, {
    params: { ...params, format: "csv" },
    responseType: "blob",
  });
  return response.data;
}
