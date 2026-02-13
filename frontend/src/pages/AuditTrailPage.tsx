import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

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
    <section className="panel" data-testid="audit-trail-page">
      <header className="panel-header">
        <div>
          <h2>Audit Trail</h2>
          <p className="panel-subtitle">Filterbare Einsicht in mutierende API-Aktionen.</p>
        </div>
      </header>

      <div className="products-toolbar">
        <input
          className="input"
          placeholder="Entity"
          value={entity}
          onChange={(event) => {
            setEntity(event.target.value);
            setPage(1);
          }}
          data-testid="audit-filter-entity"
        />
        <input
          className="input"
          placeholder="Action"
          value={action}
          onChange={(event) => {
            setAction(event.target.value);
            setPage(1);
          }}
          data-testid="audit-filter-action"
        />
      </div>

      <div className="table-wrap">
        <table className="products-table" data-testid="audit-table">
          <thead>
            <tr>
              <th>Zeit</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Endpoint</th>
              <th>Status</th>
              <th>Request ID</th>
            </tr>
          </thead>
          <tbody>
            {(auditQuery.data?.items ?? []).map((row) => (
              <tr key={row.id}>
                <td>{new Date(row.created_at).toLocaleString()}</td>
                <td>{row.action}</td>
                <td>
                  {row.entity}
                  {row.entity_id ? `/${row.entity_id}` : ""}
                </td>
                <td>{row.endpoint ?? "-"}</td>
                <td>{row.status_code}</td>
                <td>{row.request_id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="pagination">
        <button className="btn" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1}>
          Zurück
        </button>
        <span>
          Seite {page} | Gesamt {auditQuery.data?.total ?? 0}
        </span>
        <button
          className="btn"
          onClick={() => setPage((value) => value + 1)}
          disabled={(auditQuery.data?.items.length ?? 0) < 25}
        >
          Weiter
        </button>
      </footer>
    </section>
  );
}
