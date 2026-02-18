import type { ReportAbcRow } from "../../../../types";

type AbcSectionProps = {
  items: ReportAbcRow[];
};

export function AbcSection({ items }: AbcSectionProps) {
  return (
    <table className="products-table" data-testid="reports-abc-table">
      <thead className="table-head-standard">
        <tr>
          <th className="w-16 text-center">Rank</th>
          <th>Artikel</th>
          <th className="text-right">Outbound Qty</th>
          <th className="text-right">Anteil</th>
          <th className="text-right">Kumulativ</th>
          <th className="w-24 text-center">Klasse</th>
        </tr>
      </thead>
      <tbody>
        {items.map((row) => (
          <tr key={row.product_id} className="hover:bg-[var(--panel-soft)]">
            <td className="text-center font-medium text-[var(--muted)]">#{row.rank}</td>
            <td>{row.product_number}</td>
            <td className="text-right">{row.outbound_quantity}</td>
            <td className="text-right">{row.share_percent}%</td>
            <td className="text-right text-[var(--muted)]">{row.cumulative_share_percent}%</td>
            <td className="text-center">
              <span
                className={`px-2 py-0.5 rounded text-xs font-bold border ${
                  row.category === "A"
                    ? "bg-green-100 text-green-800 border-green-200"
                    : row.category === "B"
                      ? "bg-yellow-100 text-yellow-800 border-yellow-200"
                      : "bg-gray-100 text-gray-800 border-gray-200"
                }`}
              >
                {row.category}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
