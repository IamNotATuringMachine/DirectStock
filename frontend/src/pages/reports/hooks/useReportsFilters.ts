import { useState } from "react";

import { defaultDateRange, REPORT_PAGE_SIZE, type ReportType } from "../model";

export function useReportsFilters() {
  const initialRange = defaultDateRange();

  const [reportType, setReportType] = useState<ReportType>("stock");
  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [dateTo, setDateTo] = useState(initialRange.to);
  const [search, setSearch] = useState("");
  const [movementType, setMovementType] = useState("");
  const [page, setPage] = useState(1);

  const [trendProductId, setTrendProductId] = useState("");
  const [trendWarehouseId, setTrendWarehouseId] = useState("");
  const [forecastRunId, setForecastRunId] = useState("");
  const [forecastProductId, setForecastProductId] = useState("");
  const [forecastWarehouseId, setForecastWarehouseId] = useState("");

  return {
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
    pageSize: REPORT_PAGE_SIZE,
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
  };
}
