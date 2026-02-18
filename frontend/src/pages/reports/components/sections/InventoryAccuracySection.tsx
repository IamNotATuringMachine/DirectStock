import type { ReportInventoryAccuracySessionRow } from "../../../../types";

type InventoryAccuracySectionProps = {
  sessions: ReportInventoryAccuracySessionRow[];
};

export function InventoryAccuracySection({ sessions }: InventoryAccuracySectionProps) {
  return (
    <table className="products-table" data-testid="reports-accuracy-table">
      <thead className="table-head-standard">
        <tr>
          <th>Session</th>
          <th>Abgeschlossen am</th>
          <th>Gezählt / Total</th>
          <th>Exact Match</th>
          <th>Nachzählung</th>
          <th>Genauigkeit</th>
        </tr>
      </thead>
      <tbody>
        {sessions.map((row) => (
          <tr key={row.session_id} className="hover:bg-[var(--panel-soft)]">
            <td className="font-medium">{row.session_number}</td>
            <td>{row.completed_at ? new Date(row.completed_at).toLocaleDateString() : "-"}</td>
            <td>
              {row.counted_items} / {row.total_items}
            </td>
            <td className="text-[var(--success-ink)]">{row.exact_match_items}</td>
            <td className="text-[var(--danger)]">{row.recount_required_items}</td>
            <td>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--accent)]" style={{ width: `${row.accuracy_percent}%` }} />
                </div>
                <span className="text-sm font-medium">{row.accuracy_percent}%</span>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
