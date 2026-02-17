import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, ArrowLeft, ArrowRight } from "lucide-react";

import { fetchAuditLog } from "../services/auditApi";

export default function AuditTrailPage() {
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);

  const auditQuery = useQuery({
    queryKey: ["audit-log", entity, action, page],
    queryFn: () =>
      fetchAuditLog({
        entity: entity || undefined,
        action: action || undefined,
        page,
        page_size: 25,
      }),
  });

  return (
    <section className="page flex flex-col gap-6" data-testid="audit-trail-page">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="page-title">Audit-Trail</h2>
          <p className="section-subtitle mt-1 max-w-2xl">
            Transparente Einsicht in alle mutierenden Systemaktionen und Änderungen.
          </p>
        </div>
      </header>

      {/* Main Panel */}
      <div className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] overflow-hidden flex flex-col h-[calc(100vh-180px)] min-h-[500px] shadow-sm">

        {/* Toolbar */}
        <div className="p-4 border-b border-[var(--line)] bg-[var(--panel-soft)] flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
            <input
              className="input w-full md:w-64"
              placeholder="Filter nach Entität..."
              value={entity}
              onChange={(event) => {
                setEntity(event.target.value);
                setPage(1);
              }}
              data-testid="audit-filter-entity"
            />
            <input
              className="input w-full md:w-48"
              placeholder="Filter nach Aktion..."
              value={action}
              onChange={(event) => {
                setAction(event.target.value);
                setPage(1);
              }}
              data-testid="audit-filter-action"
            />
          </div>
          <div className="text-xs text-[var(--muted)] font-mono whitespace-nowrap">
            {auditQuery.data?.total ?? 0} Einträge gefunden
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-[var(--bg)]" data-testid="audit-table">
          {/* Desktop Headers */}
          <div className="table-head-standard hidden md:grid grid-cols-12 gap-4 px-4 py-3 border-b border-[var(--line)] bg-[var(--panel)] sticky top-0 z-10">
            <div className="col-span-2">Zeitpunkt</div>
            <div className="col-span-1">Aktion</div>
            <div className="col-span-3">Entität</div>
            <div className="col-span-3">Details / ID</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-2 text-right">User / Request</div>
          </div>

          <div className="divide-y divide-[var(--line)]">
            {(auditQuery.data?.items ?? []).map((row) => (
              <div
                key={row.id}
                className="group md:grid md:grid-cols-12 md:gap-4 p-4 hover:bg-[var(--panel-soft)] transition-colors items-start relative text-sm"
              >
                {/* Mobile: Header Line */}
                <div className="md:hidden flex justify-between items-start mb-2">
                  <div className="flex flex-col">
                    <span className="font-medium text-[var(--ink)]">{new Date(row.created_at).toLocaleString()}</span>
                    <span className="text-xs text-[var(--muted)] font-mono mt-0.5">{row.request_id?.slice(0, 8)}...</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium border border-[var(--line-strong)] ${row.status_code && row.status_code >= 400 ? 'bg-red-500/10 text-red-600 border-red-500/20' :
                    row.status_code && row.status_code >= 200 && row.status_code < 300 ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                      'bg-[var(--panel)] text-[var(--muted)]'
                    }`}>
                    {row.status_code || 'N/A'}
                  </span>
                </div>

                {/* Desktop: Time */}
                <div className="hidden md:block col-span-2 font-mono text-xs text-[var(--muted)] truncate">
                  {new Date(row.created_at).toLocaleString()}
                </div>

                {/* Shared: Action Badge */}
                <div className="md:col-span-1 mb-2 md:mb-0">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide bg-[var(--panel-strong)] text-[var(--ink)] border border-[var(--line)]">
                    {row.action}
                  </span>
                </div>

                {/* Shared: Entity */}
                <div className="md:col-span-3 mb-1 md:mb-0 min-w-0">
                  <div className="text-[var(--ink)] font-medium truncate" title={row.entity}>
                    {row.entity}
                  </div>
                </div>

                {/* Shared: Entity ID / Endpoint */}
                <div className="md:col-span-3 mb-2 md:mb-0 min-w-0 flex flex-col gap-0.5">
                  {row.entity_id && (
                    <div className="font-mono text-xs text-[var(--accent)] truncate" title={row.entity_id}>
                      #{row.entity_id}
                    </div>
                  )}
                  <div className="text-xs text-[var(--muted)] truncate" title={row.endpoint || ''}>
                    {row.endpoint || '-'}
                  </div>
                </div>

                {/* Desktop: Status */}
                <div className="hidden md:block col-span-1">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${row.status_code && row.status_code >= 400 ? 'bg-red-500/10 text-red-600 border-red-500/20' :
                    row.status_code && row.status_code >= 200 && row.status_code < 300 ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                      'bg-[var(--panel)] text-[var(--muted)] border-[var(--line-strong)]'
                    }`}>
                    {row.status_code || 'N/A'}
                  </span>
                </div>

                {/* Desktop: Request ID / User Info */}
                <div className="hidden md:block col-span-2 text-right">
                  <div className="font-mono text-xs text-[var(--muted)] truncate" title={row.request_id}>
                    {row.request_id?.slice(0, 12)}...
                  </div>
                </div>
              </div>
            ))}

            {(!auditQuery.data?.items || auditQuery.data.items.length === 0) && (
              <div className="p-12 text-center text-[var(--muted)]">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--panel-soft)] mb-4">
                  <FileText className="w-6 h-6 opacity-20" />
                </div>
                <p>Keine Audit-Einträge gefunden.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer / Pagination */}
        <div className="p-4 border-t border-[var(--line)] bg-[var(--panel)] flex items-center justify-between">
          <button
            className="btn btn-ghost text-xs gap-2"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            <ArrowLeft className="w-4 h-4" />
            Zurück
          </button>
          <span className="text-xs font-medium text-[var(--muted)]">
            Seite {page}
          </span>
          <button
            className="btn btn-ghost text-xs gap-2"
            onClick={() => setPage((p) => p + 1)}
            disabled={(auditQuery.data?.items.length ?? 0) < 25}
          >
            Weiter
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
