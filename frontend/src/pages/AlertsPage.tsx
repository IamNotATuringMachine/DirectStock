import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CheckCircle,
  AlertTriangle,
  Filter,
  RefreshCw,
  X,
  AlertCircle,
  Info,
  Clock,
} from "lucide-react";

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

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-[color-mix(in_srgb,var(--danger)_12%,var(--panel)_88%)] text-[var(--danger)] border-[color:color-mix(in_srgb,var(--danger)_38%,var(--line)_62%)]">
            <AlertCircle className="w-3.5 h-3.5" />
            Kritisch
          </span>
        );
      case "high":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-[var(--warning-bg)] text-[var(--warning-ink)] border-[color:color-mix(in_srgb,var(--warning-ink)_36%,var(--line)_64%)]">
            <AlertTriangle className="w-3.5 h-3.5" />
            Hoch
          </span>
        );
      case "medium":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-[color-mix(in_srgb,var(--warning-bg)_75%,var(--panel)_25%)] text-[var(--warning-ink)] border-[color:color-mix(in_srgb,var(--warning-ink)_32%,var(--line)_68%)]">
            <Info className="w-3.5 h-3.5" />
            Mittel
          </span>
        );
      case "low":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-[var(--panel-soft)] text-[var(--muted)] border-[var(--line)]">
            <Info className="w-3.5 h-3.5" />
            Niedrig
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
            {severity}
          </span>
        );
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "low_stock":
        return "Niedriger Bestand";
      case "zero_stock":
        return "Kein Bestand";
      case "expiry_window":
        return "Ablaufdatum";
      default:
        return type;
    }
  };

  return (
    <div className="page space-y-6 animate-fade-in" data-testid="alerts-page">
      {/* Header Section */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Benachrichtigungen</h1>
          <p className="section-subtitle mt-1">
            Überwachung kritischer Lagerereignisse und Systemmeldungen.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="btn bg-[var(--panel)] hover:bg-[var(--panel-soft)] text-[var(--ink)] border border-[var(--line)] shadow-sm transition-all"
            title="Aktualisieren"
          >
            <RefreshCw className={`w-4 h-4 ${alertsQuery.isFetching ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Aktualisieren</span>
          </button>
        </div>
      </header>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[var(--panel)] p-5 rounded-[var(--radius-lg)] border border-[var(--line)] shadow-sm hover:shadow-md transition-shadow">
          <div>
            <p className="text-sm font-medium text-[var(--muted)]">Kritische Warnungen</p>
            <h3 className="text-2xl font-bold text-[var(--danger)] mt-2">
              {openCriticalQuery.data?.total ?? 0}
            </h3>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_12%,var(--panel)_88%)] border border-[color:color-mix(in_srgb,var(--danger)_38%,var(--line)_62%)] px-2 py-1 rounded w-fit">
            <span className="font-medium">Priorität: Kritisch</span>
          </div>
        </div>

        <div className="bg-[var(--panel)] p-5 rounded-[var(--radius-lg)] border border-[var(--line)] shadow-sm hover:shadow-md transition-shadow">
          <div>
            <p className="text-sm font-medium text-[var(--muted)]">Hohe Priorität</p>
            <h3 className="text-2xl font-bold text-[var(--warning-ink)] mt-2">
              {openHighQuery.data?.total ?? 0}
            </h3>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-[var(--warning-ink)] bg-[var(--warning-bg)] border border-[color:color-mix(in_srgb,var(--warning-ink)_36%,var(--line)_64%)] px-2 py-1 rounded w-fit">
            <span className="font-medium">Priorität: Hoch</span>
          </div>
        </div>

        <div className="bg-[var(--panel)] p-5 rounded-[var(--radius-lg)] border border-[var(--line)] shadow-sm hover:shadow-md transition-shadow">
          <div>
            <p className="text-sm font-medium text-[var(--muted)]">Aktive Regeln</p>
            <h3 className="text-2xl font-bold text-[var(--accent)] mt-2">
              {rulesQuery.data?.total ?? 0}
            </h3>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-[var(--success-ink)] bg-[var(--success-bg)] border border-[color:color-mix(in_srgb,var(--success-ink)_30%,var(--line)_70%)] px-2 py-1 rounded w-fit">
            <span className="font-medium">Systemüberwachung aktiv</span>
          </div>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="bg-[var(--panel)] rounded-[var(--radius-lg)] border border-[var(--line)] shadow-sm p-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 justify-between">
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <div className="flex items-center gap-2 px-3 py-2 bg-[var(--panel-soft)] rounded-[var(--radius-sm)] border border-[var(--line)] text-sm text-[var(--muted)]">
              <Filter className="w-4 h-4" />
              <span className="font-medium">Filter:</span>
            </div>
            
            <div className="relative min-w-[140px] flex-1 lg:flex-none">
              <select
                className="w-full appearance-none pl-3 pr-8 py-2 bg-[var(--panel)] text-[var(--ink)] border border-[var(--line)] rounded-[var(--radius-sm)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] transition-all"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Alle Status</option>
                <option value="open">Offen</option>
                <option value="acknowledged">Quittiert</option>
                <option value="closed">Geschlossen</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-[var(--muted)]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>

            <div className="relative min-w-[140px] flex-1 lg:flex-none">
              <select
                className="w-full appearance-none pl-3 pr-8 py-2 bg-[var(--panel)] text-[var(--ink)] border border-[var(--line)] rounded-[var(--radius-sm)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] transition-all"
                value={severityFilter}
                onChange={(e) => {
                  setSeverityFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Alle Prioritäten</option>
                <option value="critical">Kritisch</option>
                <option value="high">Hoch</option>
                <option value="medium">Mittel</option>
                <option value="low">Niedrig</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-[var(--muted)]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>

            <div className="relative min-w-[140px] flex-1 lg:flex-none">
              <select
                className="w-full appearance-none pl-3 pr-8 py-2 bg-[var(--panel)] text-[var(--ink)] border border-[var(--line)] rounded-[var(--radius-sm)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] transition-all"
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Alle Typen</option>
                <option value="low_stock">Niedriger Bestand</option>
                <option value="zero_stock">Kein Bestand</option>
                <option value="expiry_window">Ablaufdatum</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-[var(--muted)]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>

            {(statusFilter !== "open" || severityFilter || typeFilter) && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--panel-soft)] rounded-[var(--radius-sm)] transition-colors"
              >
                <X className="w-4 h-4" />
                Filter zurücksetzen
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-[var(--panel)] rounded-[var(--radius-lg)] border border-[var(--line)] shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--panel-soft)] border-b border-[var(--line)]">
                <th className="table-head-standard px-6 py-4">Zeitpunkt</th>
                <th className="table-head-standard px-6 py-4">Priorität</th>
                <th className="table-head-standard px-6 py-4">Typ</th>
                <th className="table-head-standard px-6 py-4">Details</th>
                <th className="table-head-standard px-6 py-4">Status</th>
                <th className="table-head-standard px-6 py-4 text-right">Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {(alertsQuery.data?.items ?? []).map((alert) => (
                <tr 
                  key={alert.id} 
                  className={`hover:bg-[var(--panel-strong)] transition-colors ${alert.status === 'open' ? 'bg-[var(--panel)]' : 'bg-[var(--panel-soft)]'}`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-sm text-[var(--ink)]">
                      <Clock className="w-4 h-4 text-[var(--muted)]" />
                      {new Date(alert.triggered_at).toLocaleString('de-DE', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getSeverityBadge(alert.severity)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-[var(--ink)]">
                      {getTypeLabel(alert.alert_type)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-[var(--ink)]">{alert.title}</span>
                      <span className="text-sm text-[var(--muted)]">{alert.message}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                      alert.status === 'open' 
                        ? 'bg-[color-mix(in_srgb,#2563eb_16%,var(--panel)_84%)] text-[color:color-mix(in_srgb,#2563eb_78%,var(--ink)_22%)] border-[color:color-mix(in_srgb,#2563eb_42%,var(--line)_58%)]'
                        : 'bg-[var(--success-bg)] text-[var(--success-ink)] border-[color:color-mix(in_srgb,var(--success-ink)_30%,var(--line)_70%)]'
                    }`}>
                      {alert.status === 'open' ? 'Offen' : 'Quittiert'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    {alert.status === "open" && (
                      <button
                        onClick={() => void ackMutation.mutateAsync(alert.id)}
                        disabled={ackMutation.isPending}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-[var(--panel)] border border-[var(--line)] hover:border-[var(--accent)] hover:text-[var(--accent)] text-[var(--muted)] text-xs font-medium rounded-[var(--radius-sm)] transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Als gelesen markieren"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Quittieren
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!alertsQuery.isLoading && (alertsQuery.data?.items.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[var(--muted)]">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="p-3 bg-[var(--panel-soft)] rounded-full border border-[var(--line)]">
                        <Bell className="w-8 h-8 text-[var(--muted)]" />
                      </div>
                      <p>Keine Warnungen gefunden.</p>
                      {(statusFilter !== "open" || severityFilter || typeFilter) && (
                        <button 
                          onClick={resetFilters}
                          className="text-sm text-[var(--accent)] hover:underline"
                        >
                          Filter zurücksetzen
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-[var(--line)] bg-[var(--panel-soft)] px-6 py-4 flex items-center justify-between">
            <span className="text-sm text-[var(--muted)]">
              Seite <span className="font-medium text-[var(--ink)]">{page}</span> von <span className="font-medium text-[var(--ink)]">{totalPages}</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                className="px-3 py-1.5 text-sm font-medium text-[var(--ink)] bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-sm)] hover:bg-[var(--panel-soft)] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Zurück
              </button>
              <button
                className="px-3 py-1.5 text-sm font-medium text-[var(--ink)] bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-sm)] hover:bg-[var(--panel-soft)] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Weiter
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
