import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { acknowledgeAlert, fetchAlerts, fetchAlertRules } from "../services/alertsApi";

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

  const rulesQuery = useQuery({
    queryKey: ["alert-rules", "active-count"],
    queryFn: () => fetchAlertRules({ page: 1, pageSize: 1, isActive: true }),
    refetchInterval: 60000,
  });

  const ackMutation = useMutation({
    mutationFn: acknowledgeAlert,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });

  const totalPages = useMemo(() => {
    const total = alertsQuery.data?.total ?? 0;
    return Math.max(1, Math.ceil(total / pageSize));
  }, [alertsQuery.data?.total]);

  return (
    <section className="panel" data-testid="alerts-page">
      <header className="panel-header">
        <div>
          <h2>Alerts</h2>
          <p className="panel-subtitle">Kritische Lagerereignisse mit Quittierung und Filterung.</p>
        </div>
      </header>

      <div className="kpi-grid">
        <div className="kpi-card" data-testid="alerts-kpi-open-count">
          <span>Offene Alerts</span>
          <strong>{alertsQuery.data?.total ?? "-"}</strong>
        </div>
        <div className="kpi-card" data-testid="alerts-kpi-active-rules">
          <span>Aktive Regeln</span>
          <strong>{rulesQuery.data?.total ?? "-"}</strong>
        </div>
      </div>

      <div className="products-toolbar">
        <select
          className="input"
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            setPage(1);
          }}
          data-testid="alerts-status-filter"
        >
          <option value="">Alle Stati</option>
          <option value="open">open</option>
          <option value="acknowledged">acknowledged</option>
        </select>

        <select
          className="input"
          value={severityFilter}
          onChange={(event) => {
            setSeverityFilter(event.target.value);
            setPage(1);
          }}
          data-testid="alerts-severity-filter"
        >
          <option value="">Alle Prioritäten</option>
          <option value="low">low</option>
          <option value="medium">medium</option>
          <option value="high">high</option>
          <option value="critical">critical</option>
        </select>

        <select
          className="input"
          value={typeFilter}
          onChange={(event) => {
            setTypeFilter(event.target.value);
            setPage(1);
          }}
          data-testid="alerts-type-filter"
        >
          <option value="">Alle Typen</option>
          <option value="low_stock">low_stock</option>
          <option value="zero_stock">zero_stock</option>
          <option value="expiry_window">expiry_window</option>
        </select>
      </div>

      <div className="table-wrap">
        <table className="products-table" data-testid="alerts-table">
          <thead>
            <tr>
              <th>Zeit</th>
              <th>Severity</th>
              <th>Typ</th>
              <th>Titel</th>
              <th>Status</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {(alertsQuery.data?.items ?? []).map((alert) => (
              <tr key={alert.id} data-testid={`alerts-row-${alert.id}`}>
                <td>{new Date(alert.triggered_at).toLocaleString()}</td>
                <td>{alert.severity}</td>
                <td>{alert.alert_type}</td>
                <td>
                  <strong>{alert.title}</strong>
                  <div>{alert.message}</div>
                </td>
                <td>{alert.status}</td>
                <td>
                  <button
                    className="btn"
                    onClick={() => void ackMutation.mutateAsync(alert.id)}
                    disabled={ackMutation.isPending || alert.status !== "open"}
                    data-testid={`alerts-ack-${alert.id}`}
                  >
                    Ack
                  </button>
                </td>
              </tr>
            ))}
            {!alertsQuery.isLoading && (alertsQuery.data?.items.length ?? 0) === 0 ? (
              <tr>
                <td colSpan={6}>Keine Alerts vorhanden.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="actions-cell">
        <button
          className="btn"
          onClick={() => setPage((value) => Math.max(1, value - 1))}
          disabled={page <= 1}
          data-testid="alerts-page-prev"
        >
          Zurück
        </button>
        <span data-testid="alerts-page-indicator">
          Seite {page} / {totalPages}
        </span>
        <button
          className="btn"
          onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
          disabled={page >= totalPages}
          data-testid="alerts-page-next"
        >
          Weiter
        </button>
      </div>
    </section>
  );
}
