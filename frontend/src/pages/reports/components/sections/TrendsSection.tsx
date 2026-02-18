import { TrendingUp } from "lucide-react";

import { TrendSparkline } from "../ReportsKpiCards";

type TrendSparklineRow = {
  product_id: number;
  product_number: string;
  product_name: string;
  values: number[];
  total: number;
};

type TrendsSectionProps = {
  items: TrendSparklineRow[];
};

export function TrendsSection({ items }: TrendsSectionProps) {
  return (
    <>
      <div className="p-4 bg-[var(--panel-soft)] border-b border-[var(--line)]">
        <h3 className="text-sm font-semibold text-[var(--ink)] flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Top Movers (Sparklines)
        </h3>
      </div>
      <table className="products-table" data-testid="reports-trends-table">
        <thead className="table-head-standard">
          <tr>
            <th>Artikel</th>
            <th className="text-right">Gesamt Outbound</th>
            <th className="w-48">Trend Verlauf</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.product_id} className="hover:bg-[var(--panel-soft)]">
              <td>
                <div className="flex flex-col">
                  <span className="font-medium text-[var(--ink)]">{row.product_number}</span>
                  <span className="text-xs text-[var(--muted)]">{row.product_name}</span>
                </div>
              </td>
              <td className="text-right font-medium">{row.total.toFixed(0)}</td>
              <td className="py-2">
                <TrendSparkline values={row.values} />
              </td>
            </tr>
          ))}
          {items.length === 0 ? (
            <tr>
              <td colSpan={3} className="py-8 text-center text-[var(--muted)]">
                Keine Trenddaten für diesen Zeitraum.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </>
  );
}
