import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchAlerts } from "../services/alertsApi";
import {
  fetchDashboardActivityToday,
  fetchDashboardLowStock,
  fetchDashboardRecentMovements,
  fetchDashboardSummary,
} from "../services/dashboardApi";
import {
  fetchDashboardCardsCatalog,
  fetchMyDashboardConfig,
  updateMyDashboardConfig,
} from "../services/dashboardConfigApi";
import { fetchReportKpis } from "../services/reportsApi";

const quickActions = [
  { to: "/goods-receipt", label: "Neuer Wareneingang" },
  { to: "/goods-issue", label: "Neuer Warenausgang" },
  { to: "/stock-transfer", label: "Neue Umlagerung" },
  { to: "/scanner", label: "Scanner" },
];

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const now = new Date();
  const dateTo = now.toISOString().slice(0, 10);
  const prior = new Date(now);
  prior.setDate(prior.getDate() - 29);
  const dateFrom = prior.toISOString().slice(0, 10);

  const summaryQuery = useQuery({ queryKey: ["dashboard-summary"], queryFn: fetchDashboardSummary, refetchInterval: 60000 });
  const recentQuery = useQuery({ queryKey: ["dashboard-recent"], queryFn: () => fetchDashboardRecentMovements(12), refetchInterval: 60000 });
  const lowStockQuery = useQuery({ queryKey: ["dashboard-low-stock"], queryFn: fetchDashboardLowStock, refetchInterval: 60000 });
  const activityQuery = useQuery({ queryKey: ["dashboard-activity"], queryFn: fetchDashboardActivityToday, refetchInterval: 60000 });
  const kpiQuery = useQuery({ queryKey: ["dashboard-report-kpis", dateFrom, dateTo], queryFn: () => fetchReportKpis({ dateFrom, dateTo }), refetchInterval: 60000 });
  const criticalAlertsQuery = useQuery({ queryKey: ["dashboard-critical-alerts"], queryFn: () => fetchAlerts({ page: 1, pageSize: 5, status: "open", severity: "critical" }), refetchInterval: 60000 });

  const cardsCatalogQuery = useQuery({ queryKey: ["dashboard-cards-catalog"], queryFn: fetchDashboardCardsCatalog });
  const dashboardConfigQuery = useQuery({ queryKey: ["dashboard-config"], queryFn: fetchMyDashboardConfig });

  const saveConfigMutation = useMutation({
    mutationFn: updateMyDashboardConfig,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dashboard-config"] });
    },
  });

  const summary = summaryQuery.data;
  const configItems = dashboardConfigQuery.data?.cards ?? [];
  const visibleCardKeys = new Set(
    [...configItems]
      .sort((a, b) => a.display_order - b.display_order)
      .filter((item) => item.visible)
      .map((item) => item.card_key)
  );

  const cardsCatalog = cardsCatalogQuery.data ?? [];

  const toggleCard = (cardKey: string) => {
    const rows = configItems.length
      ? [...configItems]
      : cardsCatalog.map((card, index) => ({ card_key: card.card_key, visible: true, display_order: card.default_order ?? index * 10 }));

    const existing = rows.find((item) => item.card_key === cardKey);
    const nextRows = existing
      ? rows.map((item) => (item.card_key === cardKey ? { ...item, visible: !item.visible } : item))
      : [...rows, { card_key: cardKey, visible: true, display_order: rows.length * 10 }];

    void saveConfigMutation.mutateAsync({ cards: nextRows });
  };

  return (
    <section className="panel" data-testid="dashboard-page">
      <header className="panel-header">
        <div>
          <h2>Dashboard</h2>
          <p className="panel-subtitle">Operativer Überblick mit KPI, Bewegungen und Warnungen.</p>
        </div>
      </header>

      <article className="subpanel">
        <h3>Karten konfigurieren</h3>
        <div className="checkbox-grid">
          {cardsCatalog.map((card) => (
            <label key={card.card_key} className="checkbox">
              <input
                type="checkbox"
                checked={visibleCardKeys.has(card.card_key)}
                onChange={() => toggleCard(card.card_key)}
                data-testid={`dashboard-card-toggle-${card.card_key}`}
              />
              {card.title}
            </label>
          ))}
        </div>
      </article>

      {visibleCardKeys.has("summary") ? (
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
            <span>Offene WE/WA/Uml./IWT</span>
            <strong>
              {summary
                ? `${summary.open_goods_receipts}/${summary.open_goods_issues}/${summary.open_stock_transfers}/${summary.open_inter_warehouse_transfers}`
                : "-"}
            </strong>
          </div>
          <div className="kpi-card" data-testid="dashboard-kpi-low-stock">
            <span>Unter Meldebestand</span>
            <strong>{summary?.low_stock_count ?? "-"}</strong>
          </div>
          <div className="kpi-card" data-testid="dashboard-kpi-turnover">
            <span>Turnover</span>
            <strong>{kpiQuery.data?.turnover_rate ?? "-"}</strong>
          </div>
          <div className="kpi-card" data-testid="dashboard-kpi-dock-to-stock">
            <span>Dock-to-Stock (h)</span>
            <strong>{kpiQuery.data?.dock_to_stock_hours ?? "-"}</strong>
          </div>
          <div className="kpi-card" data-testid="dashboard-kpi-accuracy">
            <span>Bestandsgenauigkeit</span>
            <strong>{kpiQuery.data ? `${kpiQuery.data.inventory_accuracy_percent}%` : "-"}</strong>
          </div>
          <div className="kpi-card" data-testid="dashboard-kpi-alert-count">
            <span>Warnungsanzahl</span>
            <strong>{kpiQuery.data?.alert_count ?? "-"}</strong>
          </div>
          <div className="kpi-card" data-testid="dashboard-kpi-iwt-transit">
            <span>IWT Transit (Menge)</span>
            <strong>{summary?.inter_warehouse_transit_quantity ?? "-"}</strong>
          </div>
        </div>
      ) : null}

      {visibleCardKeys.has("capacity") ? (
        <article className="subpanel">
          <h3>Kapazität</h3>
          <p>
            Belegte Lagerplätze: {summary?.occupied_bins ?? "-"} / {summary?.total_bins ?? "-"} | Gesamtmenge: {summary?.total_quantity ?? "-"}
          </p>
        </article>
      ) : null}

      {visibleCardKeys.has("quick-actions") ? (
        <article className="subpanel">
          <h3>Schnellaktionen</h3>
          <div className="actions-cell">
            {quickActions.map((action) => (
              <Link key={action.to} className="btn" to={action.to} data-testid={`dashboard-quick-action-${action.to.replace("/", "")}`}>
                {action.label}
              </Link>
            ))}
          </div>
        </article>
      ) : null}

      {visibleCardKeys.has("recent-movements") || visibleCardKeys.has("low-stock") ? (
        <div className="two-col-grid">
          {visibleCardKeys.has("recent-movements") ? (
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
              </div>
            </article>
          ) : null}

          {visibleCardKeys.has("low-stock") ? (
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
              </div>
            </article>
          ) : null}
        </div>
      ) : null}

      {visibleCardKeys.has("activity-today") ? (
        <article className="subpanel">
          <h3>Aktivität heute</h3>
          <p>
            Bewegungen: {activityQuery.data?.movements_today ?? "-"} | Abgeschlossene WE: {activityQuery.data?.completed_goods_receipts_today ?? "-"} |
            Abgeschlossene WA: {activityQuery.data?.completed_goods_issues_today ?? "-"} | Abgeschlossene Umlagerungen: {activityQuery.data?.completed_stock_transfers_today ?? "-"}
          </p>
        </article>
      ) : null}

      {visibleCardKeys.has("critical-alerts") ? (
        <article className="subpanel" data-testid="dashboard-critical-alerts">
          <h3>Kritische Warnungen</h3>
          <div className="list-stack small">
            {(criticalAlertsQuery.data?.items ?? []).map((alert) => (
              <div key={alert.id} className="list-item static-item">
                <strong>{alert.title}</strong>
                <span>{new Date(alert.triggered_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="actions-cell">
            <Link className="btn" to="/alerts" data-testid="dashboard-open-alerts-link">
              Warnungen öffnen
            </Link>
          </div>
        </article>
      ) : null}
    </section>
  );
}
