import { Filter, RefreshCw } from "lucide-react";

import type { ReportType } from "../model";

type ReportsTrendForecastFiltersProps = {
  reportType: ReportType;
  trendProductId: string;
  setTrendProductId: (value: string) => void;
  trendWarehouseId: string;
  setTrendWarehouseId: (value: string) => void;
  forecastRunId: string;
  setForecastRunId: (value: string) => void;
  forecastProductId: string;
  setForecastProductId: (value: string) => void;
  forecastWarehouseId: string;
  setForecastWarehouseId: (value: string) => void;
  setPage: (value: number | ((prev: number) => number)) => void;
  dateFrom: string;
  dateTo: string;
  recomputePending: boolean;
  onRecomputeForecast: (payload: { date_from?: string; date_to?: string; warehouse_id?: number }) => Promise<unknown>;
};

export function ReportsTrendForecastFilters({
  reportType,
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
  setPage,
  dateFrom,
  dateTo,
  recomputePending,
  onRecomputeForecast,
}: ReportsTrendForecastFiltersProps) {
  if (reportType !== "trends" && reportType !== "demand-forecast") {
    return null;
  }

  return (
    <div className="pt-3 border-t border-[var(--line)] flex flex-wrap gap-3 items-end">
      <span className="text-sm font-medium text-[var(--muted)] flex items-center gap-1.5 mb-2 mr-2">
        <Filter className="w-4 h-4" />
        Erweitert:
      </span>

      {reportType === "trends" ? (
        <>
          <input
            className="input w-32"
            placeholder="Produkt ID"
            value={trendProductId}
            onChange={(event) => setTrendProductId(event.target.value)}
            data-testid="reports-trend-product-id"
          />
          <input
            className="input w-32"
            placeholder="Lager ID"
            value={trendWarehouseId}
            onChange={(event) => setTrendWarehouseId(event.target.value)}
            data-testid="reports-trend-warehouse-id"
          />
        </>
      ) : (
        <>
          <input
            className="input w-24"
            placeholder="Run ID"
            value={forecastRunId}
            onChange={(event) => {
              setForecastRunId(event.target.value);
              setPage(1);
            }}
            data-testid="reports-forecast-run-id"
          />
          <input
            className="input w-32"
            placeholder="Produkt ID"
            value={forecastProductId}
            onChange={(event) => {
              setForecastProductId(event.target.value);
              setPage(1);
            }}
            data-testid="reports-forecast-product-id"
          />
          <input
            className="input w-32"
            placeholder="Lager ID"
            value={forecastWarehouseId}
            onChange={(event) => {
              setForecastWarehouseId(event.target.value);
              setPage(1);
            }}
            data-testid="reports-forecast-warehouse-id"
          />
          <button
            className="btn ml-auto bg-[var(--panel-soft)] hover:bg-[var(--line)]"
            onClick={() =>
              void onRecomputeForecast({
                date_from: dateFrom || undefined,
                date_to: dateTo || undefined,
                warehouse_id: forecastWarehouseId ? Number(forecastWarehouseId) : undefined,
              })
            }
            disabled={recomputePending}
            data-testid="reports-forecast-recompute-btn"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${recomputePending ? "animate-spin" : ""}`} />
            Neu berechnen
          </button>
        </>
      )}
    </div>
  );
}
