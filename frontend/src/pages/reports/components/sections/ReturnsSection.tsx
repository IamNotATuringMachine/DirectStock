import type { ReportReturnsRow } from "../../../../types";

type ReturnsSectionProps = {
  items: ReportReturnsRow[];
};

export function ReturnsSection({ items }: ReturnsSectionProps) {
  return (
    <table className="products-table" data-testid="reports-returns-table">
      <thead className="table-head-standard">
        <tr>
          <th>Retoure</th>
          <th>Status</th>
          <th>Items</th>
          <th>Menge</th>
          <th>Restock</th>
          <th>Repair Intern</th>
          <th>Repair Extern</th>
          <th>Scrap</th>
          <th>Supplier</th>
        </tr>
      </thead>
      <tbody>
        {items.map((row) => (
          <tr key={row.return_order_id} className="hover:bg-[var(--panel-soft)]">
            <td className="font-medium">{row.return_number}</td>
            <td>{row.status}</td>
            <td>{row.total_items}</td>
            <td>{row.total_quantity}</td>
            <td>{row.restock_items}</td>
            <td>{row.internal_repair_items}</td>
            <td>{row.external_repair_items}</td>
            <td>{row.scrap_items}</td>
            <td>{row.return_supplier_items}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
