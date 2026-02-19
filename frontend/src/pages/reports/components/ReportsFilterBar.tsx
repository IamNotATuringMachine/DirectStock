import { Calendar, ChevronDown, Search } from "lucide-react";

import { REPORT_TYPE_OPTIONS, type ReportType } from "../model";
import { ReportsTrendForecastFilters } from "./ReportsTrendForecastFilters";

type ReportsFilterBarProps = {
  reportType: ReportType;
  setReportType: (value: ReportType) => void;
  setPage: (value: number | ((prev: number) => number)) => void;
  dateFrom: string;
  setDateFrom: (value: string) => void;
  dateTo: string;
  setDateTo: (value: string) => void;
  search: string;
  setSearch: (value: string) => void;
  movementType: string;
  setMovementType: (value: string) => void;
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
  recomputePending: boolean;
  onRecomputeForecast: (payload: { date_from?: string; date_to?: string; warehouse_id?: number }) => Promise<unknown>;
};

export function ReportsFilterBar({
  reportType,
  setReportType,
  setPage,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  search,
  setSearch,
  movementType,
  setMovementType,
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
  recomputePending,
  onRecomputeForecast,
}: ReportsFilterBarProps) {
  const reportTypeSelectId = "reports-type-select-field";
  const dateFromInputId = "reports-date-from-field";
  const dateToInputId = "reports-date-to-field";
  const movementTypeSelectId = "reports-movement-type-select-field";

  return (
    <div className="bg-[var(--panel)] p-4 rounded-xl border border-[var(--line)] shadow-sm space-y-4">
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-end justify-between">
        <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
          <div className="w-full sm:w-64">
            <label className="form-label-standard mb-1.5 block" htmlFor={reportTypeSelectId}>
              Berichtstyp
            </label>
            <div className="relative">
              <select
                id={reportTypeSelectId}
                className="input reports-type-select w-full font-medium"
                value={reportType}
                onChange={(event) => {
                  setReportType(event.target.value as ReportType);
                  setPage(1);
                }}
                data-testid="reports-type-select"
              >
                {REPORT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="reports-type-select-chevron absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
            </div>
          </div>

          {reportType !== "purchase-recommendations" ? (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="w-full sm:w-40">
                <label className="form-label-standard mb-1.5 block" htmlFor={dateFromInputId}>
                  Von
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
                  <input
                    id={dateFromInputId}
                    type="date"
                    className="input input-leading-icon w-full"
                    value={dateFrom}
                    onChange={(event) => setDateFrom(event.target.value)}
                    data-testid="reports-date-from"
                  />
                </div>
              </div>
              <span className="text-[var(--muted)] mt-6">-</span>
              <div className="w-full sm:w-40">
                <label className="form-label-standard mb-1.5 block" htmlFor={dateToInputId}>
                  Bis
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
                  <input
                    id={dateToInputId}
                    type="date"
                    className="input input-leading-icon w-full"
                    value={dateTo}
                    onChange={(event) => setDateTo(event.target.value)}
                    data-testid="reports-date-to"
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
          {reportType === "stock" || reportType === "abc" ? (
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
              <input
                className="input input-leading-icon w-full"
                placeholder="Suche nach Artikel..."
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                data-testid="reports-search-input"
              />
            </div>
          ) : null}

          {reportType === "movements" ? (
            <div className="w-full sm:w-48">
              <label className="sr-only" htmlFor={movementTypeSelectId}>
                Bewegungsart
              </label>
              <select
                id={movementTypeSelectId}
                className="input w-full"
                value={movementType}
                onChange={(event) => {
                  setMovementType(event.target.value);
                  setPage(1);
                }}
                data-testid="reports-movement-type-select"
              >
                <option value="">Alle Bewegungsarten</option>
                <option value="goods_receipt">Wareneingang</option>
                <option value="goods_issue">Warenausgang</option>
                <option value="stock_transfer">Umlagerung</option>
                <option value="inventory_adjustment">Korrektur</option>
              </select>
            </div>
          ) : null}
        </div>
      </div>

      <ReportsTrendForecastFilters
        reportType={reportType}
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
        setPage={setPage}
        dateFrom={dateFrom}
        dateTo={dateTo}
        recomputePending={recomputePending}
        onRecomputeForecast={onRecomputeForecast}
      />
    </div>
  );
}
