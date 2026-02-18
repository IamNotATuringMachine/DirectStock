import type { ReportInboundOutboundRow } from "../../../../types";

type InboundOutboundSectionProps = {
  items: ReportInboundOutboundRow[];
};

export function InboundOutboundSection({ items }: InboundOutboundSectionProps) {
  return (
    <table className="products-table" data-testid="reports-inbound-outbound-table">
      <thead className="table-head-standard">
        <tr>
          <th>Datum</th>
          <th className="text-right text-green-700">Inbound</th>
          <th className="text-right text-blue-700">Outbound</th>
          <th className="text-right">Transfer</th>
          <th className="text-right">Adjustment</th>
          <th className="text-right">Total Moves</th>
        </tr>
      </thead>
      <tbody>
        {items.map((row) => (
          <tr key={row.day} className="hover:bg-[var(--panel-soft)]">
            <td className="font-medium">{row.day}</td>
            <td className="text-right text-green-700 font-medium">+{row.inbound_quantity}</td>
            <td className="text-right text-blue-700 font-medium">-{row.outbound_quantity}</td>
            <td className="text-right">{row.transfer_quantity}</td>
            <td className="text-right">{row.adjustment_quantity}</td>
            <td className="text-right text-[var(--muted)]">{row.movement_count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
