import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Box,
  CheckCircle,
  Clock,
  Layout,
  Package,
  QrCode,
  Repeat,
  RotateCcw,
  Settings,
  ShoppingCart,
  TrendingUp,
  Truck,
  Users,
} from "lucide-react";

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

interface QuickAction {
  to: string;
  label: string;
  icon: React.ReactNode;
}

const quickActions: QuickAction[] = [
  { to: "/goods-receipt", label: "Wareneingang", icon: <ArrowDownLeft size={32} /> },
  { to: "/goods-issue", label: "Warenausgang", icon: <ArrowUpRight size={32} /> },
  { to: "/stock-transfer", label: "Umlagerung", icon: <Repeat size={32} /> },
  { to: "/scanner", label: "Scanner", icon: <QrCode size={32} /> },
];

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [showConfig, setShowConfig] = useState(false);

  const now = new Date();
  const dateTo = now.toISOString().slice(0, 10);
  const prior = new Date(now);
  prior.setDate(prior.getDate() - 29);
  const dateFrom = prior.toISOString().slice(0, 10);

  const summaryQuery = useQuery({ queryKey: ["dashboard-summary"], queryFn: fetchDashboardSummary, refetchInterval: 60000 });
  const recentQuery = useQuery({
    queryKey: ["dashboard-recent"],
    queryFn: () => fetchDashboardRecentMovements(12),
    refetchInterval: 60000,
  });
  const lowStockQuery = useQuery({ queryKey: ["dashboard-low-stock"], queryFn: fetchDashboardLowStock, refetchInterval: 60000 });
  const activityQuery = useQuery({ queryKey: ["dashboard-activity"], queryFn: fetchDashboardActivityToday, refetchInterval: 60000 });
  const kpiQuery = useQuery({
    queryKey: ["dashboard-report-kpis", dateFrom, dateTo],
    queryFn: () => fetchReportKpis({ dateFrom, dateTo }),
    refetchInterval: 60000,
  });
  const criticalAlertsQuery = useQuery({
    queryKey: ["dashboard-critical-alerts"],
    queryFn: () => fetchAlerts({ page: 1, pageSize: 5, status: "open", severity: "critical" }),
    refetchInterval: 60000,
  });

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
  const isSavingDashboardConfig = saveConfigMutation.isPending;
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
      : cardsCatalog.map((card, index) => ({
        card_key: card.card_key,
        visible: true,
        display_order: card.default_order ?? index * 10,
      }));

    const existing = rows.find((item) => item.card_key === cardKey);
    const nextRows = existing
      ? rows.map((item) => (item.card_key === cardKey ? { ...item, visible: !item.visible } : item))
      : [...rows, { card_key: cardKey, visible: true, display_order: rows.length * 10 }];

    void saveConfigMutation.mutateAsync({ cards: nextRows });
  };

  const StatCard = ({
    title,
    value,
    icon,
  }: {
    title: string;
    value: string | number;
    icon: React.ReactNode;
  }) => (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div className="stat-content">
        <span className="stat-label">{title}</span>
        <span className="stat-value">{value}</span>
      </div>
    </div>
  );

  return (
    <section className="page" data-testid="dashboard-page">
      <header className="panel-header">
        <div>
          <h2 className="page-title">Dashboard</h2>
          <p className="panel-subtitle section-subtitle">Operativer Überblick</p>
        </div>
        <button className="btn" onClick={() => setShowConfig(!showConfig)}>
          <Layout size={18} />
          <span>Ansicht anpassen</span>
        </button>
      </header>

      {showConfig && (
        <article className="subpanel mb-4">
          <h3>Karten konfigurieren</h3>
          <div className="checkbox-grid">
            {cardsCatalog.map((card) => (
              <label key={card.card_key} className="checkbox">
                <input
                  type="checkbox"
                  checked={visibleCardKeys.has(card.card_key)}
                  onChange={() => toggleCard(card.card_key)}
                  disabled={isSavingDashboardConfig}
                  data-testid={`dashboard-card-toggle-${card.card_key}`}
                />
                {card.title}
              </label>
            ))}
          </div>
        </article>
      )}

      <div className="dashboard-grid">
        {visibleCardKeys.has("summary") && (
          <>
            <StatCard icon={<Package size={24} />} title="Gesamtartikel" value={summary?.total_products ?? "-"} />
            <StatCard icon={<Activity size={24} />} title="Auslastung" value={summary ? `${summary.utilization_percent}%` : "-"} />
            <StatCard
              icon={<Truck size={24} />}
              title="Offene Aufträge"
              value={summary ? summary.open_goods_receipts + summary.open_goods_issues : "-"}
            />
            <StatCard icon={<AlertTriangle size={24} />} title="Unter Bestandsgrenze" value={summary?.low_stock_count ?? "-"} />
            <StatCard icon={<TrendingUp size={24} />} title="Turnover Rate" value={kpiQuery.data?.turnover_rate ?? "-"} />
            <StatCard icon={<Clock size={24} />} title="Dock-to-Stock (h)" value={kpiQuery.data?.dock_to_stock_hours ?? "-"} />
            <StatCard
              icon={<CheckCircle size={24} />}
              title="Bestandsgenauigkeit"
              value={kpiQuery.data ? `${kpiQuery.data.inventory_accuracy_percent}%` : "-"}
            />
            <StatCard icon={<AlertTriangle size={24} />} title="Warnungen" value={kpiQuery.data?.alert_count ?? "-"} />
          </>
        )}

        {visibleCardKeys.has("quick-actions") && (
          <div className="dashboard-full-width grid grid-cols-2 md:grid-cols-4 gap-4">
            {quickActions.map((action) => (
              <Link key={action.to} to={action.to} className="action-card" data-testid={`dashboard-quick-action-${action.to.slice(1)}`}>
                <div className="action-icon">{action.icon}</div>
                <span className="action-label">{action.label}</span>
              </Link>
            ))}
          </div>
        )}

        <div className="dashboard-half-width flex flex-col gap-4">
          {visibleCardKeys.has("recent-movements") && (
            <article className="subpanel h-full">
              <h3>Letzte Bewegungen</h3>
              <div className="flex flex-col gap-0 mt-2">
                {(recentQuery.data?.items ?? []).map((movement) => (
                  <div key={movement.id} className="modern-list-item">
                    <div className="flex flex-col">
                      <strong className="text-sm">{movement.product_number}</strong>
                      <span className="text-xs text-muted-foreground">{new Date(movement.performed_at).toLocaleString()}</span>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`movement-type-badge ${movement.movement_type === "goods_receipt"
                          ? "badge-in"
                          : movement.movement_type === "goods_issue"
                            ? "badge-out"
                            : "badge-transfer"
                          }`}
                      >
                        {movement.movement_type === "goods_receipt" ? "Eingang" : movement.movement_type === "goods_issue" ? "Ausgang" : "Umlag."}
                      </span>
                      <span className="text-sm font-medium">
                        {movement.quantity} Stk. ({movement.from_bin_code || "-"} → {movement.to_bin_code || "-"})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          )}
        </div>

        <div className="dashboard-half-width flex flex-col gap-4">
          {visibleCardKeys.has("low-stock") && (
            <article className="subpanel h-full">
              <h3>Niedrige Bestände</h3>
              <div className="flex flex-col gap-0 mt-2">
                {(lowStockQuery.data?.items ?? []).map((item) => (
                  <div key={`${item.product_id}-${item.warehouse_id}`} className="modern-list-item">
                    <div className="flex flex-col">
                      <strong className="text-sm">{item.product_number}</strong>
                      <span className="text-xs text-muted-foreground">{item.warehouse_code}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="block text-xs text-muted-foreground">Bestand</span>
                        <strong className="text-sm text-red-600">{item.on_hand}</strong>
                      </div>
                      <div className="text-right">
                        <span className="block text-xs text-muted-foreground">Min</span>
                        <strong className="text-sm">{item.threshold}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          )}

          {visibleCardKeys.has("critical-alerts") && (
            <article className="subpanel h-full border-l-4 border-l-red-500">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-red-700">Kritische Warnungen</h3>
                <Link to="/alerts" className="text-xs font-semibold text-red-700 hover:underline">
                  Alle ansehen
                </Link>
              </div>
              <div className="flex flex-col gap-2">
                {(criticalAlertsQuery.data?.items ?? []).map((alert) => (
                  <div key={alert.id} className="p-2 rounded bg-red-50 border border-red-100 flex justify-between items-center">
                    <span className="text-sm font-medium text-red-900 truncate flex-1 mr-2">{alert.title}</span>
                    <span className="text-xs text-red-700 whitespace-nowrap">{new Date(alert.triggered_at).toLocaleTimeString()}</span>
                  </div>
                ))}
                {(!criticalAlertsQuery.data?.items || criticalAlertsQuery.data.items.length === 0) && (
                  <p className="text-sm text-gray-500 italic">Keine kritischen Warnungen.</p>
                )}
              </div>
            </article>
          )}
        </div>

        {visibleCardKeys.has("activity-today") && (
          <div className="dashboard-full-width">
            <article className="subpanel">
              <h3>Aktivität heute</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2 text-center">
                <div className="dashboard-activity-card">
                  <div className="text-2xl font-bold">{activityQuery.data?.movements_today ?? "-"}</div>
                  <div className="dashboard-activity-label">Bewegungen</div>
                </div>
                <div className="dashboard-activity-card">
                  <div className="text-2xl font-bold">{activityQuery.data?.completed_goods_receipts_today ?? "-"}</div>
                  <div className="dashboard-activity-label">Wareneingänge</div>
                </div>
                <div className="dashboard-activity-card">
                  <div className="text-2xl font-bold">{activityQuery.data?.completed_goods_issues_today ?? "-"}</div>
                  <div className="dashboard-activity-label">Warenausgänge</div>
                </div>
                <div className="dashboard-activity-card">
                  <div className="text-2xl font-bold">{activityQuery.data?.completed_stock_transfers_today ?? "-"}</div>
                  <div className="dashboard-activity-label">Umlagerungen</div>
                </div>
              </div>
            </article>
          </div>
        )}
      </div>
    </section>
  );
}
