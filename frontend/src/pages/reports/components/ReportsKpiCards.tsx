import { AlertCircle, CheckCircle, Clock, Package, RefreshCw } from "lucide-react";

import type { ReportKpi } from "../../../types";

type ReportsKpiCardsProps = {
  kpis?: ReportKpi;
};

function KpiCard({
  title,
  value,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string | number;
  icon?: React.ElementType;
  trend?: string;
}) {
  return (
    <div className="bg-[var(--panel)] p-4 rounded-xl border border-[var(--line)] shadow-sm flex items-start justify-between min-w-[180px] gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--muted)] mb-1 truncate" title={title}>
          {title}
        </p>
        <p className="text-2xl font-bold text-[var(--ink)] tracking-tight truncate">{value}</p>
        {trend ? <p className="text-xs text-[var(--accent)] mt-1 font-medium">{trend}</p> : null}
      </div>
      {Icon ? (
        <div className="p-2 bg-[var(--panel-soft)] rounded-lg text-[var(--muted)] flex-shrink-0">
          <Icon className="w-5 h-5" />
        </div>
      ) : null}
    </div>
  );
}

export function TrendSparkline({ values }: { values: number[] }) {
  if (values.length === 0) {
    return <span className="text-[var(--muted)]">-</span>;
  }
  if (values.length === 1) {
    return (
      <svg width="100" height="24" viewBox="0 0 100 24" className="text-[var(--accent)] overflow-visible">
        <circle cx="50" cy="12" r="3" fill="currentColor" />
      </svg>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 24 - ((value - min) / range) * 24;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width="100" height="32" viewBox="0 0 100 32" className="text-[var(--accent)] overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ReportsKpiCards({ kpis }: ReportsKpiCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 overflow-x-auto pb-2">
      <KpiCard title="Turnover" value={kpis?.turnover_rate ?? "-"} icon={RefreshCw} />
      <KpiCard title="Dock-to-Stock" value={kpis?.dock_to_stock_hours ?? "-"} icon={Clock} />
      <KpiCard title="Genauigkeit" value={kpis ? `${kpis.inventory_accuracy_percent}%` : "-"} icon={CheckCircle} />
      <KpiCard title="Warnungen" value={kpis?.alert_count ?? "-"} icon={AlertCircle} />
      <KpiCard title="Pick Rate" value={kpis ? `${kpis.pick_accuracy_rate}%` : "-"} icon={Package} />
      <KpiCard title="Retouren" value={kpis ? `${kpis.returns_rate}%` : "-"} icon={AlertCircle} />
      <KpiCard title="Genehmigung" value={kpis?.approval_cycle_hours ?? "-"} icon={Clock} />
      <KpiCard title="IWT Transit" value={kpis?.inter_warehouse_transfers_in_transit ?? "-"} icon={Package} />
      <KpiCard title="IWT Menge" value={kpis?.inter_warehouse_transit_quantity ?? "-"} icon={Package} />
    </div>
  );
}
