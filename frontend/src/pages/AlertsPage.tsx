import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { acknowledgeAlert, fetchAlerts, fetchAlertRules } from "../services/alertsApi";
import { AlertsView } from "./alerts/AlertsView";

export default function AlertsPage() {
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [statusFilter, setStatusFilter] = useState("open");
  const [severityFilter, setSeverityFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const alertsQuery = useQuery({
    queryKey: ["alerts", page, pageSize, statusFilter, severityFilter, typeFilter],
    queryFn: () =>
      fetchAlerts({
        page,
        pageSize,
        status: statusFilter || undefined,
        severity: severityFilter || undefined,
        alertType: typeFilter || undefined,
      }),
    refetchInterval: 60000,
  });

  const openCriticalQuery = useQuery({
    queryKey: ["alerts-open-critical"],
    queryFn: () =>
      fetchAlerts({
        page: 1,
        pageSize: 1,
        status: "open",
        severity: "critical",
      }),
    refetchInterval: 60000,
  });

  const openHighQuery = useQuery({
    queryKey: ["alerts-open-high"],
    queryFn: () =>
      fetchAlerts({
        page: 1,
        pageSize: 1,
        status: "open",
        severity: "high",
      }),
    refetchInterval: 60000,
  });

  const rulesQuery = useQuery({
    queryKey: ["alert-rules", "active-count"],
    queryFn: () => fetchAlertRules({ page: 1, pageSize: 1, isActive: true }),
    refetchInterval: 60000,
  });

  const ackMutation = useMutation({
    mutationFn: acknowledgeAlert,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["alerts"] });
      await queryClient.invalidateQueries({ queryKey: ["alerts-open-critical"] });
      await queryClient.invalidateQueries({ queryKey: ["alerts-open-high"] });
    },
  });

  const totalPages = useMemo(() => {
    const total = alertsQuery.data?.total ?? 0;
    return Math.max(1, Math.ceil(total / pageSize));
  }, [alertsQuery.data?.total]);

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["alerts"] });
    void queryClient.invalidateQueries({ queryKey: ["alert-rules"] });
  };

  const resetFilters = () => {
    setStatusFilter("open");
    setSeverityFilter("");
    setTypeFilter("");
    setPage(1);
  };

  return (
    <AlertsView
      alerts={alertsQuery.data?.items ?? []}
      page={page}
      totalPages={totalPages}
      statusFilter={statusFilter}
      severityFilter={severityFilter}
      typeFilter={typeFilter}
      openCriticalTotal={openCriticalQuery.data?.total ?? 0}
      openHighTotal={openHighQuery.data?.total ?? 0}
      activeRulesTotal={rulesQuery.data?.total ?? 0}
      loading={alertsQuery.isLoading}
      fetching={alertsQuery.isFetching}
      ackPending={ackMutation.isPending}
      onRefresh={handleRefresh}
      onStatusFilterChange={(value) => {
        setStatusFilter(value);
        setPage(1);
      }}
      onSeverityFilterChange={(value) => {
        setSeverityFilter(value);
        setPage(1);
      }}
      onTypeFilterChange={(value) => {
        setTypeFilter(value);
        setPage(1);
      }}
      onResetFilters={resetFilters}
      onAcknowledge={(alertId) => {
        void ackMutation.mutateAsync(alertId);
      }}
      onPrevPage={() => setPage((current) => Math.max(1, current - 1))}
      onNextPage={() => setPage((current) => Math.min(totalPages, current + 1))}
    />
  );
}
