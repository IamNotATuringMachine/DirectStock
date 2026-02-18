import { useMemo } from "react";

import { ReportsFilterBar } from "./reports/components/ReportsFilterBar";
import { ReportsHeader } from "./reports/components/ReportsHeader";
import { ReportsKpiCards } from "./reports/components/ReportsKpiCards";
import { ReportsPagination } from "./reports/components/ReportsPagination";
import { AbcSection } from "./reports/components/sections/AbcSection";
import { DemandForecastSection } from "./reports/components/sections/DemandForecastSection";
import { InboundOutboundSection } from "./reports/components/sections/InboundOutboundSection";
import { InventoryAccuracySection } from "./reports/components/sections/InventoryAccuracySection";
import { MovementsSection } from "./reports/components/sections/MovementsSection";
import { PickingPerformanceSection } from "./reports/components/sections/PickingPerformanceSection";
import { PurchaseRecommendationsSection } from "./reports/components/sections/PurchaseRecommendationsSection";
import { ReturnsSection } from "./reports/components/sections/ReturnsSection";
import { StockSection } from "./reports/components/sections/StockSection";
import { TrendsSection } from "./reports/components/sections/TrendsSection";
import { useReportsData } from "./reports/hooks/useReportsData";
import { useReportsFilters } from "./reports/hooks/useReportsFilters";

export default function ReportsPage() {
  const {
    reportType,
    setReportType,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    search,
    setSearch,
    movementType,
    setMovementType,
    page,
    setPage,
    pageSize,
    trendProductId,
    setTrendProductId,
    trendWarehouseId,
    setTrendWarehouseId,
    forecastRunId,
    setForecastRunId,
    forecastProductId,
    setForecastProductId,
    forecastWarehouseId,
    setForecastWarehouseId,
  } = useReportsFilters();

  const {
    kpisQuery,
    stockQuery,
    movementsQuery,
    inboundOutboundQuery,
    accuracyQuery,
    abcQuery,
    returnsQuery,
    pickingPerformanceQuery,
    purchaseRecommendationQuery,
    forecastQuery,
    recomputeForecastMutation,
    pagination,
    trendSparklines,
    isDownloading,
    onDownloadCsv,
  } = useReportsData({
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
  });

  const section = useMemo(() => {
    if (reportType === "stock") {
      return <StockSection items={stockQuery.data?.items ?? []} />;
    }
    if (reportType === "movements") {
      return <MovementsSection items={movementsQuery.data?.items ?? []} />;
    }
    if (reportType === "inbound-outbound") {
      return <InboundOutboundSection items={inboundOutboundQuery.data?.items ?? []} />;
    }
    if (reportType === "inventory-accuracy") {
      return <InventoryAccuracySection sessions={accuracyQuery.data?.sessions ?? []} />;
    }
    if (reportType === "abc") {
      return <AbcSection items={abcQuery.data?.items ?? []} />;
    }
    if (reportType === "returns") {
      return <ReturnsSection items={returnsQuery.data?.items ?? []} />;
    }
    if (reportType === "picking-performance") {
      return <PickingPerformanceSection items={pickingPerformanceQuery.data?.items ?? []} />;
    }
    if (reportType === "purchase-recommendations") {
      return <PurchaseRecommendationsSection items={purchaseRecommendationQuery.data?.items ?? []} />;
    }
    if (reportType === "trends") {
      return <TrendsSection items={trendSparklines} />;
    }
    return <DemandForecastSection items={forecastQuery.data?.items ?? []} />;
  }, [
    abcQuery.data?.items,
    accuracyQuery.data?.sessions,
    forecastQuery.data?.items,
    inboundOutboundQuery.data?.items,
    movementsQuery.data?.items,
    pickingPerformanceQuery.data?.items,
    purchaseRecommendationQuery.data?.items,
    reportType,
    returnsQuery.data?.items,
    stockQuery.data?.items,
    trendSparklines,
  ]);

  return (
    <div className="page" data-testid="reports-page">
      <div className="space-y-6 animate-fade-in">
        <ReportsHeader isDownloading={isDownloading} onDownloadCsv={onDownloadCsv} />

        <ReportsKpiCards kpis={kpisQuery.data} />

        <ReportsFilterBar
          reportType={reportType}
          setReportType={setReportType}
          setPage={setPage}
          dateFrom={dateFrom}
          setDateFrom={setDateFrom}
          dateTo={dateTo}
          setDateTo={setDateTo}
          search={search}
          setSearch={setSearch}
          movementType={movementType}
          setMovementType={setMovementType}
          trendProductId={trendProductId}
          setTrendProductId={setTrendProductId}
          trendWarehouseId={trendWarehouseId}
          setTrendWarehouseId={setTrendWarehouseId}
          forecastRunId={forecastRunId}
          setForecastRunId={setForecastRunId}
          forecastProductId={forecastProductId}
          setForecastProductId={setForecastProductId}
          forecastWarehouseId={forecastWarehouseId}
          setForecastWarehouseId={setForecastWarehouseId}
          recomputePending={recomputeForecastMutation.isPending}
          onRecomputeForecast={recomputeForecastMutation.mutateAsync}
        />

        <div className="bg-[var(--panel)] rounded-xl border border-[var(--line)] shadow-sm overflow-hidden min-h-[400px]">
          <div className="overflow-x-auto">{section}</div>
        </div>

        {pagination ? (
          <ReportsPagination
            page={page}
            totalPages={pagination.totalPages}
            onPrev={() => setPage((current) => current - 1)}
            onNext={() => setPage((current) => current + 1)}
          />
        ) : null}
      </div>
    </div>
  );
}
