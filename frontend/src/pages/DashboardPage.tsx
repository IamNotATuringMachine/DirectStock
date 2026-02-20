import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Layout, Settings, X } from "lucide-react";

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

import { DashboardStats } from "./dashboard/components/DashboardStats";
import { DashboardQuickActions } from "./dashboard/components/DashboardQuickActions";
import { DashboardRecentMovements } from "./dashboard/components/DashboardRecentMovements";
import { DashboardLowStock } from "./dashboard/components/DashboardLowStock";
import { DashboardCriticalAlerts } from "./dashboard/components/DashboardCriticalAlerts";
import { DashboardActivity } from "./dashboard/components/DashboardActivity";

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

  return (
    <section className="page" data-testid="dashboard-page">
      <header className="panel-header">
        <div>
          <h2 className="page-title">Dashboard</h2>
          <p className="panel-subtitle section-subtitle">Operativer Überblick</p>
        </div>
        <div className="flex gap-2">
          <button
            className={`btn ${showConfig ? "btn-secondary" : ""}`}
            onClick={() => setShowConfig(!showConfig)}
            title="Dashboard anpassen"
          >
            {showConfig ? <X size={18} /> : <Settings size={18} />}
            <span>{showConfig ? "Schließen" : "Anpassen"}</span>
          </button>
        </div>
      </header>

      {showConfig && (
        <article className="subpanel mb-6 animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2 mb-4">
            <Layout size={20} className="text-accent" />
            <h3 className="text-lg font-semibold m-0">Karten konfigurieren</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Wählen Sie die Module aus, die auf Ihrem Dashboard angezeigt werden sollen. Die Änderungen werden automatisch gespeichert.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {cardsCatalog.map((card) => (
              <label
                key={card.card_key}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  visibleCardKeys.has(card.card_key)
                    ? "bg-accent/5 border-accent/30"
                    : "bg-panel border-line hover:border-accent/50"
                }`}
              >
                <div className="relative flex items-center justify-center h-5 w-5">
                  <input
                    type="checkbox"
                    className="peer h-5 w-5 cursor-pointer appearance-none rounded border border-line transition-all checked:bg-accent checked:border-accent"
                    checked={visibleCardKeys.has(card.card_key)}
                    onChange={() => toggleCard(card.card_key)}
                    disabled={isSavingDashboardConfig}
                    data-testid={`dashboard-card-toggle-${card.card_key}`}
                  />
                  <CheckIcon className="absolute w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                </div>
                <span className="text-sm font-medium">{card.title}</span>
              </label>
            ))}
          </div>
        </article>
      )}

      <div className="dashboard-grid">
        <DashboardStats
          summary={summaryQuery.data}
          kpis={kpiQuery.data}
          visible={visibleCardKeys.has("summary")}
          isLoading={summaryQuery.isLoading || kpiQuery.isLoading}
        />

        <DashboardQuickActions visible={visibleCardKeys.has("quick-actions")} />

        <div className="dashboard-half-width flex flex-col gap-4">
          <DashboardRecentMovements
            data={recentQuery.data}
            visible={visibleCardKeys.has("recent-movements")}
            isLoading={recentQuery.isLoading}
          />
        </div>

        <div className="dashboard-half-width flex flex-col gap-4">
          <DashboardLowStock
            data={lowStockQuery.data}
            visible={visibleCardKeys.has("low-stock")}
            isLoading={lowStockQuery.isLoading}
          />

          <DashboardCriticalAlerts
            data={criticalAlertsQuery.data}
            visible={visibleCardKeys.has("critical-alerts")}
            isLoading={criticalAlertsQuery.isLoading}
          />
        </div>

        <DashboardActivity
          data={activityQuery.data}
          visible={visibleCardKeys.has("activity-today")}
          isLoading={activityQuery.isLoading}
        />
      </div>
    </section>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
