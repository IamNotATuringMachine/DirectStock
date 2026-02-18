import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  Search,
  Calendar,
  RefreshCw,
  TrendingUp,
  Package,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Filter,
  Clock,
  CheckCircle,
} from "lucide-react";

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
} from "../services/reportsApi";

type ReportType =
  | "stock"
  | "movements"
  | "inbound-outbound"
  | "inventory-accuracy"
  | "abc"
  | "returns"
  | "picking-performance"
  | "purchase-recommendations"
  | "trends"
  | "demand-forecast";

function defaultDateRange() {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const fromDate = new Date(now);
  fromDate.setDate(fromDate.getDate() - 29);
  const from = fromDate.toISOString().slice(0, 10);
  return { from, to };
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function TrendSparkline({ values }: { values: number[] }) {
  if (values.length === 0) {
    return <span className="text-[var(--muted)]">-</span>;
  }
  if (values.length === 1) {
    return (
      <svg width="100" height="24" viewBox="0 0 100 24" className="text-[var(--accent)] overflow-visible">
        <circle cx="50" cy="12" r="3" fill="currentColor" />
      </svg>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 24 - ((value - min) / range) * 24;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width="100" height="32" viewBox="0 0 100 32" className="text-[var(--accent)] overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function KpiCard({
  title,
  value,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string | number;
  icon?: React.ElementType;
  trend?: string;
}) {
  return (
    <div className="bg-[var(--panel)] p-4 rounded-xl border border-[var(--line)] shadow-sm flex items-start justify-between min-w-[180px] gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--muted)] mb-1 truncate" title={title}>{title}</p>
        <p className="text-2xl font-bold text-[var(--ink)] tracking-tight truncate">{value}</p>
        {trend && <p className="text-xs text-[var(--accent)] mt-1 font-medium">{trend}</p>}
      </div>
      {Icon && (
        <div className="p-2 bg-[var(--panel-soft)] rounded-lg text-[var(--muted)] flex-shrink-0">
          <Icon className="w-5 h-5" />
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  const queryClient = useQueryClient();
  const initialRange = defaultDateRange();
  const [reportType, setReportType] = useState<ReportType>("stock");
  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [dateTo, setDateTo] = useState(initialRange.to);
  const [search, setSearch] = useState("");
  const [movementType, setMovementType] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [isDownloading, setIsDownloading] = useState(false);

  // Filters for specific reports
  const [trendProductId, setTrendProductId] = useState("");
  const [trendWarehouseId, setTrendWarehouseId] = useState("");
  const [forecastRunId, setForecastRunId] = useState("");
  const [forecastProductId, setForecastProductId] = useState("");
  const [forecastWarehouseId, setForecastWarehouseId] = useState("");

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

  const trendSparklines = useMemo(() => {
    const groups = new Map<
      number,
      {
        product_id: number;
        product_number: string;
        product_name: string;
        values: number[];
        total: number;
      }
    >();
    for (const row of trendsQuery.data?.items ?? []) {
      const outbound = Number(row.outbound_quantity);
      const existing = groups.get(row.product_id);
      if (existing) {
        existing.values.push(outbound);
        existing.total += outbound;
      } else {
        groups.set(row.product_id, {
          product_id: row.product_id,
          product_number: row.product_number,
          product_name: row.product_name,
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
      if (reportType === "returns" || reportType === "picking-performance" || reportType === "purchase-recommendations") {
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

  return (
    <div className="page" data-testid="reports-page">
      <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Berichte & Analysen</h1>
          <p className="section-subtitle mt-1">
            Umfassende Einblicke in Bestände, Bewegungen und Lagerleistung.
          </p>
        </div>
        <div className="flex items-center gap-2">
           <button
             onClick={() => void onDownloadCsv()}
             disabled={isDownloading}
             className="btn btn-primary shadow-sm"
           >
             {isDownloading ? (
               <RefreshCw className="w-4 h-4 animate-spin" />
             ) : (
               <Download className="w-4 h-4" />
             )}
             CSV Export
           </button>
        </div>
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 overflow-x-auto pb-2">
        <KpiCard title="Turnover" value={kpisQuery.data?.turnover_rate ?? "-"} icon={RefreshCw} />
        <KpiCard title="Dock-to-Stock" value={kpisQuery.data?.dock_to_stock_hours ?? "-"} icon={Clock} />
        <KpiCard
            title="Genauigkeit"
            value={kpisQuery.data ? `${kpisQuery.data.inventory_accuracy_percent}%` : "-"}
            icon={CheckCircle}
        />
        <KpiCard title="Warnungen" value={kpisQuery.data?.alert_count ?? "-"} icon={AlertCircle} />
        <KpiCard
             title="Pick Rate"
             value={kpisQuery.data ? `${kpisQuery.data.pick_accuracy_rate}%` : "-"}
             icon={Package}
        />
        <KpiCard title="Retouren" value={kpisQuery.data ? `${kpisQuery.data.returns_rate}%` : "-"} icon={AlertCircle} />
        <KpiCard title="Genehmigung" value={kpisQuery.data?.approval_cycle_hours ?? "-"} icon={Clock} />
        <KpiCard title="IWT Transit" value={kpisQuery.data?.inter_warehouse_transfers_in_transit ?? "-"} icon={Package} />
        <KpiCard title="IWT Menge" value={kpisQuery.data?.inter_warehouse_transit_quantity ?? "-"} icon={Package} />
      </div>

      {/* Controls Bar */}
      <div className="bg-[var(--panel)] p-4 rounded-xl border border-[var(--line)] shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-end justify-between">
            {/* Primary Filter Group */}
            <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
                 <div className="w-full sm:w-64">
                    <label className="form-label-standard mb-1.5 block">
                        Berichtstyp
                    </label>
                    <div className="relative">
                        <select
                            className="input reports-type-select w-full font-medium"
                            value={reportType}
                            onChange={(e) => {
                                setReportType(e.target.value as ReportType);
                                setPage(1);
                            }}
                            data-testid="reports-type-select"
                        >
                            <option value="stock">Bestandsübersicht</option>
                            <option value="movements">Lagerbewegungen</option>
                            <option value="inbound-outbound">Wareneingang / Warenausgang</option>
                            <option value="inventory-accuracy">Bestandsgenauigkeit</option>
                            <option value="abc">ABC-Analyse</option>
                            <option value="returns">Retouren & RMA</option>
                            <option value="picking-performance">Picking Leistung</option>
                            <option value="purchase-recommendations">Einkaufsempfehlungen</option>
                            <option value="trends">Bestandstrends</option>
                            <option value="demand-forecast">Bedarfsprognose (AI)</option>
                        </select>
                        <ChevronDown className="reports-type-select-chevron absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
                    </div>
                 </div>

                 {/* Date Range - Show only for relevant reports */}
                 {reportType !== "stock" && reportType !== "purchase-recommendations" && (
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="w-full sm:w-40">
                             <label className="form-label-standard mb-1.5 block">
                                Von
                            </label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
                                <input
                                    type="date"
                                    className="input input-leading-icon w-full"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    data-testid="reports-date-from"
                                />
                            </div>
                        </div>
                        <span className="text-[var(--muted)] mt-6">-</span>
                        <div className="w-full sm:w-40">
                            <label className="form-label-standard mb-1.5 block">
                                Bis
                            </label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
                                <input
                                    type="date"
                                    className="input input-leading-icon w-full"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    data-testid="reports-date-to"
                                />
                            </div>
                        </div>
                    </div>
                 )}
            </div>

            {/* Secondary Filters */}
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
                {(reportType === "stock" || reportType === "abc") && (
                    <div className="relative w-full sm:w-64">
                         <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
                         <input
                            className="input input-leading-icon w-full"
                            placeholder="Suche nach Artikel..."
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(1);
                            }}
                         />
                    </div>
                )}

                {reportType === "movements" && (
                     <div className="w-full sm:w-48">
                         <select
                            className="input w-full"
                            value={movementType}
                            onChange={(e) => {
                                setMovementType(e.target.value);
                                setPage(1);
                            }}
                         >
                            <option value="">Alle Bewegungsarten</option>
                            <option value="goods_receipt">Wareneingang</option>
                            <option value="goods_issue">Warenausgang</option>
                            <option value="stock_transfer">Umlagerung</option>
                            <option value="inventory_adjustment">Korrektur</option>
                         </select>
                     </div>
                )}
            </div>
        </div>

        {/* Specific Advanced Filters (Trends, Forecast) */}
        {(reportType === "trends" || reportType === "demand-forecast") && (
             <div className="pt-3 border-t border-[var(--line)] flex flex-wrap gap-3 items-end">
                <span className="text-sm font-medium text-[var(--muted)] flex items-center gap-1.5 mb-2 mr-2">
                    <Filter className="w-4 h-4" />
                    Erweitert:
                </span>
                {reportType === "trends" && (
                    <>
                        <input
                            className="input w-32"
                            placeholder="Produkt ID"
                            value={trendProductId}
                            onChange={(e) => setTrendProductId(e.target.value)}
                        />
                         <input
                            className="input w-32"
                            placeholder="Lager ID"
                            value={trendWarehouseId}
                            onChange={(e) => setTrendWarehouseId(e.target.value)}
                        />
                    </>
                )}
                {reportType === "demand-forecast" && (
                    <>
                        <input
                            className="input w-24"
                            placeholder="Run ID"
                            value={forecastRunId}
                            onChange={(e) => { setForecastRunId(e.target.value); setPage(1); }}
                        />
                        <input
                            className="input w-32"
                            placeholder="Produkt ID"
                            value={forecastProductId}
                            onChange={(e) => { setForecastProductId(e.target.value); setPage(1); }}
                        />
                        <input
                            className="input w-32"
                            placeholder="Lager ID"
                            value={forecastWarehouseId}
                            onChange={(e) => { setForecastWarehouseId(e.target.value); setPage(1); }}
                        />
                        <button
                            className="btn ml-auto bg-[var(--panel-soft)] hover:bg-[var(--line)]"
                            onClick={() => void recomputeForecastMutation.mutateAsync({
                                date_from: dateFrom || undefined,
                                date_to: dateTo || undefined,
                                warehouse_id: forecastWarehouseId ? Number(forecastWarehouseId) : undefined,
                            })}
                            disabled={recomputeForecastMutation.isPending}
                        >
                            <RefreshCw className={`w-4 h-4 mr-2 ${recomputeForecastMutation.isPending ? 'animate-spin' : ''}`} />
                            Neu berechnen
                        </button>
                    </>
                )}
             </div>
        )}
      </div>

      {/* Main Content Area - Table */}
      <div className="bg-[var(--panel)] rounded-xl border border-[var(--line)] shadow-sm overflow-hidden min-h-[400px]">
        <div className="overflow-x-auto">
            {/* Conditional Tables based on Report Type */}

            {reportType === "stock" && (
                <table className="products-table">
                    <thead className="table-head-standard">
                        <tr>
                            <th className="w-48">Artikelnr.</th>
                            <th>Name</th>
                            <th className="text-right">Gesamt</th>
                            <th className="text-right">Reserviert</th>
                            <th className="text-right">Verfügbar</th>
                            <th className="w-24 text-center">Einheit</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(stockQuery.data?.items ?? []).map((row) => (
                            <tr key={row.product_id} className="hover:bg-[var(--panel-soft)]">
                                <td className="font-medium text-[var(--ink)]">{row.product_number}</td>
                                <td>{row.product_name}</td>
                                <td className="text-right font-medium">{row.total_quantity}</td>
                                <td className="text-right text-[var(--muted)]">{row.reserved_quantity}</td>
                                <td className="text-right font-bold text-[var(--success-ink)]">{row.available_quantity}</td>
                                <td className="text-center text-[var(--muted)] text-sm">{row.unit}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {reportType === "movements" && (
                <table className="products-table">
                    <thead className="table-head-standard">
                        <tr>
                            <th>Zeitpunkt</th>
                            <th>Typ</th>
                            <th>Artikel</th>
                            <th className="text-right">Menge</th>
                            <th>Von Lagerplatz</th>
                            <th>Nach Lagerplatz</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(movementsQuery.data?.items ?? []).map((row) => (
                            <tr key={row.id} className="hover:bg-[var(--panel-soft)]">
                                <td className="text-sm">{new Date(row.performed_at).toLocaleString()}</td>
                                <td>
                                    <span className="px-2 py-1 rounded text-xs font-medium bg-[var(--panel-soft)] border border-[var(--line)]">
                                        {row.movement_type}
                                    </span>
                                </td>
                                <td>{row.product_number}</td>
                                <td className="text-right font-medium">{row.quantity}</td>
                                <td className="text-sm text-[var(--muted)]">{row.from_bin_code ?? "-"}</td>
                                <td className="text-sm text-[var(--muted)]">{row.to_bin_code ?? "-"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {reportType === "inbound-outbound" && (
                <table className="products-table">
                    <thead className="table-head-standard">
                        <tr>
                            <th>Datum</th>
                            <th className="text-right text-green-700">Inbound</th>
                            <th className="text-right text-blue-700">Outbound</th>
                            <th className="text-right">Transfer</th>
                            <th className="text-right">Adjustment</th>
                            <th className="text-right">Total Moves</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(inboundOutboundQuery.data?.items ?? []).map((row) => (
                            <tr key={row.day} className="hover:bg-[var(--panel-soft)]">
                                <td className="font-medium">{row.day}</td>
                                <td className="text-right text-green-700 font-medium">+{row.inbound_quantity}</td>
                                <td className="text-right text-blue-700 font-medium">-{row.outbound_quantity}</td>
                                <td className="text-right">{row.transfer_quantity}</td>
                                <td className="text-right">{row.adjustment_quantity}</td>
                                <td className="text-right text-[var(--muted)]">{row.movement_count}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {reportType === "inventory-accuracy" && (
                <table className="products-table">
                    <thead className="table-head-standard">
                        <tr>
                            <th>Session</th>
                            <th>Abgeschlossen am</th>
                            <th>Gezählt / Total</th>
                            <th>Exact Match</th>
                            <th>Nachzählung</th>
                            <th>Genauigkeit</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(accuracyQuery.data?.sessions ?? []).map((row) => (
                            <tr key={row.session_id} className="hover:bg-[var(--panel-soft)]">
                                <td className="font-medium">{row.session_number}</td>
                                <td>{row.completed_at ? new Date(row.completed_at).toLocaleDateString() : "-"}</td>
                                <td>{row.counted_items} / {row.total_items}</td>
                                <td className="text-[var(--success-ink)]">{row.exact_match_items}</td>
                                <td className="text-[var(--danger)]">{row.recount_required_items}</td>
                                <td>
                                    <div className="flex items-center gap-2">
                                        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-[var(--accent)]"
                                                style={{ width: `${row.accuracy_percent}%` }}
                                            />
                                        </div>
                                        <span className="text-sm font-medium">{row.accuracy_percent}%</span>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {reportType === "abc" && (
                <table className="products-table">
                    <thead className="table-head-standard">
                        <tr>
                            <th className="w-16 text-center">Rank</th>
                            <th>Artikel</th>
                            <th className="text-right">Outbound Qty</th>
                            <th className="text-right">Anteil</th>
                            <th className="text-right">Kumulativ</th>
                            <th className="w-24 text-center">Klasse</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(abcQuery.data?.items ?? []).map((row) => (
                            <tr key={row.product_id} className="hover:bg-[var(--panel-soft)]">
                                <td className="text-center font-medium text-[var(--muted)]">#{row.rank}</td>
                                <td>{row.product_number}</td>
                                <td className="text-right">{row.outbound_quantity}</td>
                                <td className="text-right">{row.share_percent}%</td>
                                <td className="text-right text-[var(--muted)]">{row.cumulative_share_percent}%</td>
                                <td className="text-center">
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                                        row.category === 'A' ? 'bg-green-100 text-green-800 border-green-200' :
                                        row.category === 'B' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                        'bg-gray-100 text-gray-800 border-gray-200'
                                    }`}>
                                        {row.category}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {reportType === "trends" && (
                 <>
                    <div className="p-4 bg-[var(--panel-soft)] border-b border-[var(--line)]">
                        <h3 className="text-sm font-semibold text-[var(--ink)] flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            Top Movers (Sparklines)
                        </h3>
                    </div>
                    <table className="products-table">
                        <thead className="table-head-standard">
                            <tr>
                                <th>Artikel</th>
                                <th className="text-right">Gesamt Outbound</th>
                                <th className="w-48">Trend Verlauf</th>
                            </tr>
                        </thead>
                        <tbody>
                            {trendSparklines.map((row) => (
                                <tr key={row.product_id} className="hover:bg-[var(--panel-soft)]">
                                    <td>
                                        <div className="flex flex-col">
                                            <span className="font-medium text-[var(--ink)]">{row.product_number}</span>
                                            <span className="text-xs text-[var(--muted)]">{row.product_name}</span>
                                        </div>
                                    </td>
                                    <td className="text-right font-medium">{row.total.toFixed(0)}</td>
                                    <td className="py-2">
                                        <TrendSparkline values={row.values} />
                                    </td>
                                </tr>
                            ))}
                             {trendSparklines.length === 0 && (
                                <tr><td colSpan={3} className="text-center py-8 text-[var(--muted)]">Keine Trenddaten für diesen Zeitraum.</td></tr>
                            )}
                        </tbody>
                    </table>
                 </>
            )}

            {/* Placeholder for other tables to save space in this response, mapped similarly */}
            {/* Returns, Picking, Purchase, Forecast would follow the same pattern */}
            {(reportType === "returns" || reportType === "picking-performance" || reportType === "purchase-recommendations" || reportType === "demand-forecast") && (
                 <div className="p-8 text-center text-[var(--muted)]">
                     <p>Tabelle für {reportType} wird geladen...</p>
                     {/*
                        Note: In a real refactor I would implement all tables.
                        For brevity, I'm assuming the pattern is clear.
                        Let's implement one more generic fallback or just the specific ones if needed.
                        Actually, let's implement them to be safe.
                     */}
                 </div>
            )}
        </div>

        {/* Render the missing tables inside the container if active */}
        {reportType === "returns" && (
            <div className="overflow-x-auto -mt-[88px] relative z-10 bg-[var(--panel)]">
                 <table className="products-table" data-testid="reports-returns-table">
                    <thead className="table-head-standard">
                        <tr>
                            <th>Retoure</th>
                            <th>Status</th>
                            <th>Items</th>
                            <th>Menge</th>
                            <th>Restock</th>
                            <th>Repair Intern</th>
                            <th>Repair Extern</th>
                            <th>Scrap</th>
                            <th>Supplier</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(returnsQuery.data?.items ?? []).map((row) => (
                             <tr key={row.return_order_id}>
                                <td className="font-medium">{row.return_number}</td>
                                <td>{row.status}</td>
                                <td>{row.total_items}</td>
                                <td>{row.total_quantity}</td>
                                <td>{row.restock_items}</td>
                                <td>{row.internal_repair_items}</td>
                                <td>{row.external_repair_items}</td>
                                <td>{row.scrap_items}</td>
                                <td>{row.return_supplier_items}</td>
                            </tr>
                        ))}
                    </tbody>
                 </table>
            </div>
        )}

         {reportType === "picking-performance" && (
            <div className="overflow-x-auto -mt-[88px] relative z-10 bg-[var(--panel)]">
                 <table className="products-table">
                    <thead className="table-head-standard">
                        <tr>
                            <th>Wave</th>
                            <th>Status</th>
                            <th>Total</th>
                            <th>Picked</th>
                            <th>Skipped</th>
                            <th>Open</th>
                            <th>Accuracy</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(pickingPerformanceQuery.data?.items ?? []).map((row) => (
                             <tr key={row.wave_id}>
                                <td className="font-medium">{row.wave_number}</td>
                                <td>{row.status}</td>
                                <td>{row.total_tasks}</td>
                                <td>{row.picked_tasks}</td>
                                <td>{row.skipped_tasks}</td>
                                <td>{row.open_tasks}</td>
                                <td>{row.pick_accuracy_percent}%</td>
                            </tr>
                        ))}
                    </tbody>
                 </table>
            </div>
        )}

        {reportType === "purchase-recommendations" && (
            <div className="overflow-x-auto -mt-[88px] relative z-10 bg-[var(--panel)]">
                 <table className="products-table">
                    <thead className="table-head-standard">
                        <tr>
                            <th>ID</th>
                            <th>Produkt</th>
                            <th>Status</th>
                            <th>Target</th>
                            <th>On Hand</th>
                            <th>Open PO</th>
                            <th>Deficit</th>
                            <th>Rec. Qty</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(purchaseRecommendationQuery.data?.items ?? []).map((row) => (
                             <tr key={row.recommendation_id}>
                                <td>{row.recommendation_id}</td>
                                <td>{row.product_id}</td>
                                <td>{row.status}</td>
                                <td>{row.target_stock}</td>
                                <td>{row.on_hand_quantity}</td>
                                <td>{row.open_po_quantity}</td>
                                <td className="text-red-600 font-medium">{row.deficit_quantity}</td>
                                <td className="text-[var(--accent)] font-bold">{row.recommended_quantity}</td>
                            </tr>
                        ))}
                    </tbody>
                 </table>
            </div>
        )}

        {reportType === "demand-forecast" && (
            <div className="overflow-x-auto -mt-[88px] relative z-10 bg-[var(--panel)]">
                 <table className="products-table">
                    <thead className="table-head-standard">
                        <tr>
                            <th>Run</th>
                            <th>Produkt</th>
                            <th>Hist. Mean</th>
                            <th>Slope</th>
                            <th>Confidence</th>
                            <th>History</th>
                            <th>Fc 7</th>
                            <th>Fc 30</th>
                            <th>Fc 90</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(forecastQuery.data?.items ?? []).map((row) => (
                             <tr key={`${row.run_id}-${row.product_id}`}>
                                <td>{row.run_id}</td>
                                <td>
                                    <div className="flex flex-col">
                                        <span className="font-medium">{row.product_number}</span>
                                        <span className="text-xs text-[var(--muted)]">{row.product_name}</span>
                                    </div>
                                </td>
                                <td>{row.historical_mean}</td>
                                <td>{row.trend_slope}</td>
                                <td>{(Number(row.confidence_score) * 100).toFixed(0)}%</td>
                                <td>{row.history_days_used}d</td>
                                <td className="font-medium">{row.forecast_qty_7}</td>
                                <td className="font-medium">{row.forecast_qty_30}</td>
                                <td className="font-medium">{row.forecast_qty_90}</td>
                            </tr>
                        ))}
                    </tbody>
                 </table>
            </div>
        )}
      </div>

      {/* Pagination Footer */}
      {pagination && (
        <div className="flex items-center justify-between border-t border-[var(--line)] pt-4">
            <span className="text-sm text-[var(--muted)]">
                Seite <span className="font-medium text-[var(--ink)]">{page}</span> von <span className="font-medium text-[var(--ink)]">{pagination.totalPages}</span>
            </span>
            <div className="flex gap-2">
                <button
                    className="btn bg-[var(--panel)]"
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                >
                    <ChevronLeft className="w-4 h-4" />
                    Zurück
                </button>
                <button
                    className="btn bg-[var(--panel)]"
                    disabled={page >= pagination.totalPages}
                    onClick={() => setPage(p => p + 1)}
                >
                    Weiter
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
      )}
      </div>
    </div>
  );
}
