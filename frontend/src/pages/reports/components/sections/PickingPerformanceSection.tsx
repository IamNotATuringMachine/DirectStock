import type { ReportPickingPerformanceRow } from "../../../../types";

type PickingPerformanceSectionProps = {
  items: ReportPickingPerformanceRow[];
};

export function PickingPerformanceSection({ items }: PickingPerformanceSectionProps) {
  return (
    <table className="products-table" data-testid="reports-picking-performance-table">
      <thead className="table-head-standard">
        <tr>
          <th>Wave</th>
          <th>Status</th>
          <th>Total</th>
          <th>Picked</th>
          <th>Skipped</th>
          <th>Open</th>
          <th>Accuracy</th>
        </tr>
      </thead>
      <tbody>
        {items.map((row) => (
          <tr key={row.wave_id} className="hover:bg-[var(--panel-soft)]">
            <td className="font-medium">{row.wave_number}</td>
            <td>{row.status}</td>
            <td>{row.total_tasks}</td>
            <td>{row.picked_tasks}</td>
            <td>{row.skipped_tasks}</td>
            <td>{row.open_tasks}</td>
            <td>{row.pick_accuracy_percent}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
