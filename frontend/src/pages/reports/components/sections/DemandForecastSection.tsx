import type { ForecastRow } from "../../../../types";

type DemandForecastSectionProps = {
  items: ForecastRow[];
};

export function DemandForecastSection({ items }: DemandForecastSectionProps) {
  return (
    <table className="products-table" data-testid="reports-demand-forecast-table">
      <thead className="table-head-standard">
        <tr>
          <th>Run</th>
          <th>Produkt</th>
          <th>Hist. Mean</th>
          <th>Slope</th>
          <th>Confidence</th>
          <th>History</th>
          <th>Fc 7</th>
          <th>Fc 30</th>
          <th>Fc 90</th>
        </tr>
      </thead>
      <tbody>
        {items.map((row) => (
          <tr key={`${row.run_id}-${row.product_id}`} className="hover:bg-[var(--panel-soft)]">
            <td>{row.run_id}</td>
            <td>
              <div className="flex flex-col">
                <span className="font-medium">{row.product_number}</span>
                <span className="text-xs text-[var(--muted)]">{row.product_name}</span>
              </div>
            </td>
            <td>{row.historical_mean}</td>
            <td>{row.trend_slope}</td>
            <td>{(Number(row.confidence_score) * 100).toFixed(0)}%</td>
            <td>{row.history_days_used}d</td>
            <td className="font-medium">{row.forecast_qty_7}</td>
            <td className="font-medium">{row.forecast_qty_30}</td>
            <td className="font-medium">{row.forecast_qty_90}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
