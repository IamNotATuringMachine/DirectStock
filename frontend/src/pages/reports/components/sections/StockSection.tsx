import type { ReportStockRow } from "../../../../types";

type StockSectionProps = {
  items: ReportStockRow[];
};

export function StockSection({ items }: StockSectionProps) {
  return (
    <table className="products-table" data-testid="reports-stock-table">
      <thead className="table-head-standard">
        <tr>
          <th className="w-48">Artikelnr.</th>
          <th>Name</th>
          <th className="text-right">Gesamt</th>
          <th className="text-right">Reserviert</th>
          <th className="text-right">Verfügbar</th>
          <th className="w-24 text-center">Einheit</th>
        </tr>
      </thead>
      <tbody>
        {items.map((row) => (
          <tr key={row.product_id} className="hover:bg-[var(--panel-soft)]">
            <td className="font-medium text-[var(--ink)]">{row.product_number}</td>
            <td>{row.product_name}</td>
            <td className="text-right font-medium">{row.total_quantity}</td>
            <td className="text-right text-[var(--muted)]">{row.reserved_quantity}</td>
            <td className="text-right font-bold text-[var(--success-ink)]">{row.available_quantity}</td>
            <td className="text-center text-[var(--muted)] text-sm">{row.unit}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
