import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import {
  fetchDashboardActivityToday,
  fetchDashboardLowStock,
  fetchDashboardRecentMovements,
  fetchDashboardSummary,
} from "../services/dashboardApi";

const quickActions = [
  { to: "/goods-receipt", label: "Neuer Wareneingang" },
  { to: "/goods-issue", label: "Neuer Warenausgang" },
  { to: "/stock-transfer", label: "Neue Umlagerung" },
  { to: "/scanner", label: "Scanner" },
];

export default function DashboardPage() {
  const summaryQuery = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: fetchDashboardSummary,
    refetchInterval: 60000,
  });
  const recentQuery = useQuery({
    queryKey: ["dashboard-recent"],
    queryFn: () => fetchDashboardRecentMovements(12),
    refetchInterval: 60000,
  });
  const lowStockQuery = useQuery({
    queryKey: ["dashboard-low-stock"],
    queryFn: fetchDashboardLowStock,
    refetchInterval: 60000,
  });
  const activityQuery = useQuery({
    queryKey: ["dashboard-activity"],
    queryFn: fetchDashboardActivityToday,
    refetchInterval: 60000,
  });

  const summary = summaryQuery.data;

  return (
    <section className="panel" data-testid="dashboard-page">
      <header className="panel-header">
        <div>
          <h2>Dashboard</h2>
          <p className="panel-subtitle">Operativer Überblick mit KPI, Bewegungen und Warnungen.</p>
        </div>
      </header>

      <div className="kpi-grid">
        <div className="kpi-card" data-testid="dashboard-kpi-total-products">
          <span>Gesamtartikel</span>
          <strong>{summary?.total_products ?? "-"}</strong>
        </div>
        <div className="kpi-card" data-testid="dashboard-kpi-utilization">
          <span>Auslastung</span>
          <strong>{summary ? `${summary.utilization_percent}%` : "-"}</strong>
        </div>
        <div className="kpi-card" data-testid="dashboard-kpi-open-ops">
          <span>Offene WE/WA/Uml.</span>
          <strong>
            {summary
              ? `${summary.open_goods_receipts}/${summary.open_goods_issues}/${summary.open_stock_transfers}`
              : "-"}
          </strong>
        </div>
        <div className="kpi-card" data-testid="dashboard-kpi-low-stock">
          <span>Unter Meldebestand</span>
          <strong>{summary?.low_stock_count ?? "-"}</strong>
        </div>
      </div>

      <article className="subpanel">
        <h3>Kapazität</h3>
        <p>
          Belegte Lagerplätze: {summary?.occupied_bins ?? "-"} / {summary?.total_bins ?? "-"} | Gesamtmenge: {summary?.total_quantity ?? "-"}
        </p>
      </article>

      <article className="subpanel">
        <h3>Quick Actions</h3>
        <div className="actions-cell">
          {quickActions.map((action) => (
            <Link key={action.to} className="btn" to={action.to} data-testid={`dashboard-quick-action-${action.to.replace("/", "")}`}>
              {action.label}
            </Link>
          ))}
        </div>
      </article>

      <div className="two-col-grid">
        <article className="subpanel">
          <h3>Letzte Bewegungen</h3>
          <div className="list-stack small">
            {(recentQuery.data?.items ?? []).map((movement) => (
              <div key={movement.id} className="list-item static-item">
                <strong>{movement.product_number}</strong>
                <span>
                  {movement.movement_type}: {movement.quantity} ({movement.from_bin_code ?? "-"} → {movement.to_bin_code ?? "-"})
                </span>
              </div>
            ))}
            {!recentQuery.isLoading && (recentQuery.data?.items.length ?? 0) === 0 ? <p>Keine Bewegungen.</p> : null}
          </div>
        </article>

        <article className="subpanel">
          <h3>Niedrige Bestände</h3>
          <div className="list-stack small">
            {(lowStockQuery.data?.items ?? []).map((item) => (
              <div key={`${item.product_id}-${item.warehouse_id}`} className="list-item static-item">
                <strong>{item.product_number}</strong>
                <span>
                  {item.warehouse_code}: {item.on_hand} / Schwelle {item.threshold}
                </span>
              </div>
            ))}
            {!lowStockQuery.isLoading && (lowStockQuery.data?.items.length ?? 0) === 0 ? <p>Keine kritischen Bestände.</p> : null}
          </div>
        </article>
      </div>

      <article className="subpanel">
        <h3>Aktivität heute</h3>
        <p>
          Bewegungen: {activityQuery.data?.movements_today ?? "-"} | Abgeschlossene WE: {activityQuery.data?.completed_goods_receipts_today ?? "-"} |
          Abgeschlossene WA: {activityQuery.data?.completed_goods_issues_today ?? "-"} | Abgeschlossene Umlagerungen: {activityQuery.data?.completed_stock_transfers_today ?? "-"}
        </p>
      </article>
    </section>
  );
}
