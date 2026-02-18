import type { ReportMovementRow } from "../../../../types";

type MovementsSectionProps = {
  items: ReportMovementRow[];
};

export function MovementsSection({ items }: MovementsSectionProps) {
  return (
    <table className="products-table" data-testid="reports-movements-table">
      <thead className="table-head-standard">
        <tr>
          <th>Zeitpunkt</th>
          <th>Typ</th>
          <th>Artikel</th>
          <th className="text-right">Menge</th>
          <th>Von Lagerplatz</th>
          <th>Nach Lagerplatz</th>
        </tr>
      </thead>
      <tbody>
        {items.map((row) => (
          <tr key={row.id} className="hover:bg-[var(--panel-soft)]">
            <td className="text-sm">{new Date(row.performed_at).toLocaleString()}</td>
            <td>
              <span className="px-2 py-1 rounded text-xs font-medium bg-[var(--panel-soft)] border border-[var(--line)]">
                {row.movement_type}
              </span>
            </td>
            <td>{row.product_number}</td>
            <td className="text-right font-medium">{row.quantity}</td>
            <td className="text-sm text-[var(--muted)]">{row.from_bin_code ?? "-"}</td>
            <td className="text-sm text-[var(--muted)]">{row.to_bin_code ?? "-"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
