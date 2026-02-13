import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  downloadReportCsv,
  fetchReportAbc,
  fetchReportInboundOutbound,
  fetchReportInventoryAccuracy,
  fetchReportKpis,
  fetchReportMovements,
  fetchReportStock,
} from "../services/reportsApi";

type ReportType = "stock" | "movements" | "inbound-outbound" | "inventory-accuracy" | "abc";

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

export default function ReportsPage() {
  const initialRange = defaultDateRange();
  const [reportType, setReportType] = useState<ReportType>("stock");
  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [dateTo, setDateTo] = useState(initialRange.to);
  const [search, setSearch] = useState("");
  const [movementType, setMovementType] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;
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

  const pagination = useMemo(() => {
    if (reportType === "stock" && stockQuery.data) {
      const totalPages = Math.max(1, Math.ceil(stockQuery.data.total / stockQuery.data.page_size));
      return { total: stockQuery.data.total, totalPages };
    }
    if (reportType === "movements" && movementsQuery.data) {
      const totalPages = Math.max(1, Math.ceil(movementsQuery.data.total / movementsQuery.data.page_size));
      return { total: movementsQuery.data.total, totalPages };
    }
    return null;
  }, [movementsQuery.data, reportType, stockQuery.data]);

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
      if (reportType === "abc") {
        params.search = search || undefined;
      }

      const blob = await downloadReportCsv(reportType, params);
      triggerDownload(blob, `directstock-report-${reportType}.csv`);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <section className="panel" data-testid="reports-page">
      <header className="panel-header">
        <div>
          <h2>Reports & KPI</h2>
          <p className="panel-subtitle">Filterbare Analysen mit CSV-Export.</p>
        </div>
      </header>

      <div className="kpi-grid">
        <div className="kpi-card" data-testid="reports-kpi-turnover">
          <span>Turnover</span>
          <strong>{kpisQuery.data?.turnover_rate ?? "-"}</strong>
        </div>
        <div className="kpi-card" data-testid="reports-kpi-dock-to-stock">
          <span>Dock-to-Stock (h)</span>
          <strong>{kpisQuery.data?.dock_to_stock_hours ?? "-"}</strong>
        </div>
        <div className="kpi-card" data-testid="reports-kpi-accuracy">
          <span>Inventory Accuracy</span>
          <strong>{kpisQuery.data ? `${kpisQuery.data.inventory_accuracy_percent}%` : "-"}</strong>
        </div>
        <div className="kpi-card" data-testid="reports-kpi-alerts">
          <span>Alert Count</span>
          <strong>{kpisQuery.data?.alert_count ?? "-"}</strong>
        </div>
      </div>

      <div className="products-toolbar">
        <select
          className="input"
          value={reportType}
          onChange={(event) => {
            setReportType(event.target.value as ReportType);
            setPage(1);
          }}
          data-testid="reports-type-select"
        >
          <option value="stock">Stock</option>
          <option value="movements">Movements</option>
          <option value="inbound-outbound">Inbound/Outbound</option>
          <option value="inventory-accuracy">Inventory Accuracy</option>
          <option value="abc">ABC</option>
        </select>
        <input
          className="input"
          type="date"
          value={dateFrom}
          onChange={(event) => setDateFrom(event.target.value)}
          data-testid="reports-date-from"
        />
        <input
          className="input"
          type="date"
          value={dateTo}
          onChange={(event) => setDateTo(event.target.value)}
          data-testid="reports-date-to"
        />
        {reportType === "stock" || reportType === "abc" ? (
          <input
            className="input"
            placeholder="Suche Produkt"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            data-testid="reports-search-input"
          />
        ) : null}
        {reportType === "movements" ? (
          <select
            className="input"
            value={movementType}
            onChange={(event) => {
              setMovementType(event.target.value);
              setPage(1);
            }}
            data-testid="reports-movement-type-select"
          >
            <option value="">Alle Bewegungen</option>
            <option value="goods_receipt">goods_receipt</option>
            <option value="goods_issue">goods_issue</option>
            <option value="stock_transfer">stock_transfer</option>
            <option value="inventory_adjustment">inventory_adjustment</option>
          </select>
        ) : null}
        <button className="btn" onClick={() => void onDownloadCsv()} disabled={isDownloading} data-testid="reports-download-csv-btn">
          CSV Export
        </button>
      </div>

      {reportType === "stock" ? (
        <div className="table-wrap">
          <table className="products-table" data-testid="reports-stock-table">
            <thead>
              <tr>
                <th>Artikelnr.</th>
                <th>Name</th>
                <th>Gesamt</th>
                <th>Reserviert</th>
                <th>Verfügbar</th>
                <th>Einheit</th>
              </tr>
            </thead>
            <tbody>
              {(stockQuery.data?.items ?? []).map((row) => (
                <tr key={row.product_id}>
                  <td>{row.product_number}</td>
                  <td>{row.product_name}</td>
                  <td>{row.total_quantity}</td>
                  <td>{row.reserved_quantity}</td>
                  <td>{row.available_quantity}</td>
                  <td>{row.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {reportType === "movements" ? (
        <div className="table-wrap">
          <table className="products-table" data-testid="reports-movements-table">
            <thead>
              <tr>
                <th>Zeit</th>
                <th>Typ</th>
                <th>Artikel</th>
                <th>Menge</th>
                <th>Von</th>
                <th>Nach</th>
              </tr>
            </thead>
            <tbody>
              {(movementsQuery.data?.items ?? []).map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.performed_at).toLocaleString()}</td>
                  <td>{row.movement_type}</td>
                  <td>{row.product_number}</td>
                  <td>{row.quantity}</td>
                  <td>{row.from_bin_code ?? "-"}</td>
                  <td>{row.to_bin_code ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {reportType === "inbound-outbound" ? (
        <div className="table-wrap">
          <table className="products-table" data-testid="reports-inbound-outbound-table">
            <thead>
              <tr>
                <th>Tag</th>
                <th>Inbound</th>
                <th>Outbound</th>
                <th>Transfer</th>
                <th>Adjustment</th>
                <th>Movements</th>
              </tr>
            </thead>
            <tbody>
              {(inboundOutboundQuery.data?.items ?? []).map((row) => (
                <tr key={row.day}>
                  <td>{row.day}</td>
                  <td>{row.inbound_quantity}</td>
                  <td>{row.outbound_quantity}</td>
                  <td>{row.transfer_quantity}</td>
                  <td>{row.adjustment_quantity}</td>
                  <td>{row.movement_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {reportType === "inventory-accuracy" ? (
        <div className="table-wrap">
          <table className="products-table" data-testid="reports-accuracy-table">
            <thead>
              <tr>
                <th>Session</th>
                <th>Abgeschlossen</th>
                <th>Gezählt</th>
                <th>Exact Match</th>
                <th>Nachzählung</th>
                <th>Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {(accuracyQuery.data?.sessions ?? []).map((row) => (
                <tr key={row.session_id}>
                  <td>{row.session_number}</td>
                  <td>{row.completed_at ? new Date(row.completed_at).toLocaleString() : "-"}</td>
                  <td>{row.counted_items} / {row.total_items}</td>
                  <td>{row.exact_match_items}</td>
                  <td>{row.recount_required_items}</td>
                  <td>{row.accuracy_percent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {reportType === "abc" ? (
        <div className="table-wrap">
          <table className="products-table" data-testid="reports-abc-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Artikel</th>
                <th>Outbound</th>
                <th>Share</th>
                <th>Kumulativ</th>
                <th>Klasse</th>
              </tr>
            </thead>
            <tbody>
              {(abcQuery.data?.items ?? []).map((row) => (
                <tr key={row.product_id}>
                  <td>{row.rank}</td>
                  <td>{row.product_number}</td>
                  <td>{row.outbound_quantity}</td>
                  <td>{row.share_percent}%</td>
                  <td>{row.cumulative_share_percent}%</td>
                  <td>{row.category}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {pagination ? (
        <footer className="pagination">
          <span>
            Seite {page} / {pagination.totalPages} ({pagination.total} Einträge)
          </span>
          <div className="pagination-actions">
            <button className="btn" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
              Zurück
            </button>
            <button className="btn" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)}>
              Weiter
            </button>
          </div>
        </footer>
      ) : null}
    </section>
  );
}
