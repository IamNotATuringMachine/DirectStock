import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  downloadReportCsv,
  fetchDemandForecast,
  fetchReportAbc,
  fetchReportInboundOutbound,
  fetchReportInventoryAccuracy,
  fetchReportKpis,
  fetchReportMovements,
  fetchReportPickingPerformance,
  fetchReportPurchaseRecommendations,
  fetchReportReturns,
  fetchReportStock,
  fetchReportTrends,
  recomputeDemandForecast,
} from "../../../services/reportsApi";
import type { TrendRow } from "../../../types";
import { triggerDownload, type ReportType } from "../model";

type UseReportsDataParams = {
  reportType: ReportType;
  dateFrom: string;
  dateTo: string;
  search: string;
  movementType: string;
  page: number;
  pageSize: number;
  trendProductId: string;
  trendWarehouseId: string;
  forecastRunId: string;
  forecastProductId: string;
  forecastWarehouseId: string;
  setPage: (value: number | ((prev: number) => number)) => void;
};

type TrendSparklineRow = {
  product_id: number;
  product_number: string;
  product_name: string;
  values: number[];
  total: number;
};

export function useReportsData({
  reportType,
  dateFrom,
  dateTo,
  search,
  movementType,
  page,
  pageSize,
  trendProductId,
  trendWarehouseId,
  forecastRunId,
  forecastProductId,
  forecastWarehouseId,
  setPage,
}: UseReportsDataParams) {
  const queryClient = useQueryClient();
  const [isDownloading, setIsDownloading] = useState(false);

  const kpisQuery = useQuery({
    queryKey: ["reports-kpis", dateFrom, dateTo],
    queryFn: () => fetchReportKpis({ dateFrom, dateTo }),
  });

  const stockQuery = useQuery({
    queryKey: ["reports-stock", page, pageSize, search],
    queryFn: () => fetchReportStock({ page, pageSize, search }),
    enabled: reportType === "stock",
  });

  const movementsQuery = useQuery({
    queryKey: ["reports-movements", page, pageSize, dateFrom, dateTo, movementType],
    queryFn: () => fetchReportMovements({ page, pageSize, dateFrom, dateTo, movementType }),
    enabled: reportType === "movements",
  });

  const inboundOutboundQuery = useQuery({
    queryKey: ["reports-inbound-outbound", dateFrom, dateTo],
    queryFn: () => fetchReportInboundOutbound({ dateFrom, dateTo }),
    enabled: reportType === "inbound-outbound",
  });

  const accuracyQuery = useQuery({
    queryKey: ["reports-inventory-accuracy", dateFrom, dateTo],
    queryFn: () => fetchReportInventoryAccuracy({ dateFrom, dateTo }),
    enabled: reportType === "inventory-accuracy",
  });

  const abcQuery = useQuery({
    queryKey: ["reports-abc", dateFrom, dateTo, search],
    queryFn: () => fetchReportAbc({ dateFrom, dateTo, search }),
    enabled: reportType === "abc",
  });

  const returnsQuery = useQuery({
    queryKey: ["reports-returns", page, pageSize, dateFrom, dateTo],
    queryFn: () => fetchReportReturns({ page, pageSize, dateFrom, dateTo }),
    enabled: reportType === "returns",
  });

  const pickingPerformanceQuery = useQuery({
    queryKey: ["reports-picking-performance", page, pageSize, dateFrom, dateTo],
    queryFn: () => fetchReportPickingPerformance({ page, pageSize, dateFrom, dateTo }),
    enabled: reportType === "picking-performance",
  });

  const purchaseRecommendationQuery = useQuery({
    queryKey: ["reports-purchase-recommendations", page, pageSize],
    queryFn: () => fetchReportPurchaseRecommendations({ page, pageSize }),
    enabled: reportType === "purchase-recommendations",
  });

  const trendsQuery = useQuery({
    queryKey: ["reports-trends", dateFrom, dateTo, trendProductId, trendWarehouseId],
    queryFn: () =>
      fetchReportTrends({
        dateFrom,
        dateTo,
        productId: trendProductId ? Number(trendProductId) : undefined,
        warehouseId: trendWarehouseId ? Number(trendWarehouseId) : undefined,
      }),
    enabled: reportType === "trends",
  });

  const forecastQuery = useQuery({
    queryKey: ["reports-demand-forecast", forecastRunId, forecastProductId, forecastWarehouseId, page, pageSize],
    queryFn: () =>
      fetchDemandForecast({
        runId: forecastRunId ? Number(forecastRunId) : undefined,
        productId: forecastProductId ? Number(forecastProductId) : undefined,
        warehouseId: forecastWarehouseId ? Number(forecastWarehouseId) : undefined,
        page,
        pageSize,
      }),
    enabled: reportType === "demand-forecast",
  });

  const recomputeForecastMutation = useMutation({
    mutationFn: recomputeDemandForecast,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["reports-demand-forecast"] });
      setPage(1);
    },
  });

  const pagination = useMemo(() => {
    if (reportType === "stock" && stockQuery.data) {
      const totalPages = Math.max(1, Math.ceil(stockQuery.data.total / stockQuery.data.page_size));
      return { total: stockQuery.data.total, totalPages };
    }
    if (reportType === "movements" && movementsQuery.data) {
      const totalPages = Math.max(1, Math.ceil(movementsQuery.data.total / movementsQuery.data.page_size));
      return { total: movementsQuery.data.total, totalPages };
    }
    if (reportType === "returns" && returnsQuery.data) {
      const totalPages = Math.max(1, Math.ceil(returnsQuery.data.total / returnsQuery.data.page_size));
      return { total: returnsQuery.data.total, totalPages };
    }
    if (reportType === "picking-performance" && pickingPerformanceQuery.data) {
      const totalPages = Math.max(1, Math.ceil(pickingPerformanceQuery.data.total / pickingPerformanceQuery.data.page_size));
      return { total: pickingPerformanceQuery.data.total, totalPages };
    }
    if (reportType === "purchase-recommendations" && purchaseRecommendationQuery.data) {
      const totalPages = Math.max(1, Math.ceil(purchaseRecommendationQuery.data.total / purchaseRecommendationQuery.data.page_size));
      return { total: purchaseRecommendationQuery.data.total, totalPages };
    }
    if (reportType === "demand-forecast" && forecastQuery.data) {
      const totalPages = Math.max(1, Math.ceil(forecastQuery.data.total / pageSize));
      return { total: forecastQuery.data.total, totalPages };
    }
    return null;
  }, [
    forecastQuery.data,
    movementsQuery.data,
    pageSize,
    pickingPerformanceQuery.data,
    purchaseRecommendationQuery.data,
    reportType,
    returnsQuery.data,
    stockQuery.data,
  ]);

  const trendSparklines = useMemo<TrendSparklineRow[]>(() => {
    const groups = new Map<number, TrendSparklineRow>();

    for (const row of trendsQuery.data?.items ?? []) {
      const typedRow = row as TrendRow;
      const outbound = Number(typedRow.outbound_quantity);
      const existing = groups.get(typedRow.product_id);

      if (existing) {
        existing.values.push(outbound);
        existing.total += outbound;
      } else {
        groups.set(typedRow.product_id, {
          product_id: typedRow.product_id,
          product_number: typedRow.product_number,
          product_name: typedRow.product_name,
          values: [outbound],
          total: outbound,
        });
      }
    }

    return Array.from(groups.values()).sort((a, b) => b.total - a.total);
  }, [trendsQuery.data?.items]);

  const onDownloadCsv = async () => {
    setIsDownloading(true);
    try {
      const params: Record<string, string | number | undefined> = {
        date_from: dateFrom,
        date_to: dateTo,
      };

      if (reportType === "stock") {
        params.page = page;
        params.page_size = pageSize;
        params.search = search || undefined;
      }
      if (reportType === "movements") {
        params.page = page;
        params.page_size = pageSize;
        params.movement_type = movementType || undefined;
      }
      if (
        reportType === "returns" ||
        reportType === "picking-performance" ||
        reportType === "purchase-recommendations"
      ) {
        params.page = page;
        params.page_size = pageSize;
      }
      if (reportType === "abc") {
        params.search = search || undefined;
      }
      if (reportType === "trends") {
        params.product_id = trendProductId || undefined;
        params.warehouse_id = trendWarehouseId || undefined;
      }
      if (reportType === "demand-forecast") {
        params.page = page;
        params.page_size = pageSize;
        params.run_id = forecastRunId || undefined;
        params.product_id = forecastProductId || undefined;
        params.warehouse_id = forecastWarehouseId || undefined;
      }

      const blob = await downloadReportCsv(reportType, params);
      triggerDownload(blob, `directstock-report-${reportType}.csv`);
    } finally {
      setIsDownloading(false);
    }
  };

  return {
    kpisQuery,
    stockQuery,
    movementsQuery,
    inboundOutboundQuery,
    accuracyQuery,
    abcQuery,
    returnsQuery,
    pickingPerformanceQuery,
    purchaseRecommendationQuery,
    trendsQuery,
    forecastQuery,
    recomputeForecastMutation,
    pagination,
    trendSparklines,
    isDownloading,
    onDownloadCsv,
  };
}
