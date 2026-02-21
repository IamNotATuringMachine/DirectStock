import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { fetchAlerts } from "../../../services/alertsApi";
import {
  fetchDashboardActivityToday,
  fetchDashboardLowStock,
  fetchDashboardRecentMovements,
  fetchDashboardSummary,
} from "../../../services/dashboardApi";
import {
  fetchDashboardCardsCatalog,
  fetchMyDashboardConfig,
  updateMyDashboardConfig,
} from "../../../services/dashboardConfigApi";
import { fetchReportKpis } from "../../../services/reportsApi";

export function useDashboard() {
  const queryClient = useQueryClient();
  const [showConfig, setShowConfig] = useState(false);

  const now = new Date();
  const dateTo = now.toISOString().slice(0, 10);
  const prior = new Date(now);
  prior.setDate(prior.getDate() - 29);
  const dateFrom = prior.toISOString().slice(0, 10);

  const summaryQuery = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: fetchDashboardSummary,
    refetchInterval: 60000
  });

  const recentQuery = useQuery({
    queryKey: ["dashboard-recent"],
    queryFn: () => fetchDashboardRecentMovements(12),
    refetchInterval: 60000,
  });

  const lowStockQuery = useQuery({
    queryKey: ["dashboard-low-stock"],
    queryFn: fetchDashboardLowStock,
    refetchInterval: 60000
  });

  const activityQuery = useQuery({
    queryKey: ["dashboard-activity"],
    queryFn: fetchDashboardActivityToday,
    refetchInterval: 60000
  });

  const kpiQuery = useQuery({
    queryKey: ["dashboard-report-kpis", dateFrom, dateTo],
    queryFn: () => fetchReportKpis({ dateFrom, dateTo }),
    refetchInterval: 60000,
  });

  const criticalAlertsQuery = useQuery({
    queryKey: ["dashboard-critical-alerts"],
    queryFn: () =>
      fetchAlerts({
        page: 1,
        pageSize: 5,
        status: "open",
        severity: "critical"
      }),
    refetchInterval: 60000,
  });

  const cardsCatalogQuery = useQuery({
    queryKey: ["dashboard-cards-catalog"],
    queryFn: fetchDashboardCardsCatalog
  });

  const dashboardConfigQuery = useQuery({
    queryKey: ["dashboard-config"],
    queryFn: fetchMyDashboardConfig
  });

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
      ? rows.map((item) =>
          item.card_key === cardKey ? { ...item, visible: !item.visible } : item
        )
      : [...rows, { card_key: cardKey, visible: true, display_order: rows.length * 10 }];

    void saveConfigMutation.mutateAsync({ cards: nextRows });
  };

  return {
    showConfig,
    setShowConfig,
    summaryQuery,
    recentQuery,
    lowStockQuery,
    activityQuery,
    kpiQuery,
    criticalAlertsQuery,
    cardsCatalog,
    visibleCardKeys,
    isSavingDashboardConfig,
    toggleCard,
  };
}
