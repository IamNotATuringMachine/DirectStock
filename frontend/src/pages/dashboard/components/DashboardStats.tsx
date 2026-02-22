import { AlertTriangle, CheckCircle, Clock, Package, Activity, TrendingUp, Truck } from "lucide-react";
import type { DashboardSummary, ReportKpi } from "../../../types";
import { Skeleton } from "../../../components/Skeleton";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  dataTestId?: string;
  isLoading?: boolean;
}

function StatCard({ title, value, icon, dataTestId, isLoading }: StatCardProps) {
  return (
    <div
      className="bg-[var(--panel)] border border-[var(--line)] rounded-xl p-5 flex items-center gap-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-[var(--line-strong)]"
      data-testid={dataTestId}
    >
      <div className="w-12 h-12 rounded-lg bg-[var(--panel-soft)] text-[var(--muted)] flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex flex-col w-full overflow-hidden">
        <span className="text-sm text-[var(--muted)] font-medium truncate">{title}</span>
        {isLoading ? (
          <Skeleton height={28} width="60%" className="mt-1" />
        ) : (
          <span className="text-2xl font-bold text-[var(--ink)] leading-tight truncate mt-0.5">{value}</span>
        )}
      </div>
    </div>
  );
}

interface DashboardStatsProps {
  summary?: DashboardSummary;
  kpis?: ReportKpi;
  visible: boolean;
  summaryLoading?: boolean;
  kpisLoading?: boolean;
}

export function DashboardStats({
  summary,
  kpis,
  visible,
  summaryLoading,
  kpisLoading,
}: DashboardStatsProps) {
  if (!visible) return null;

  return (
    <>
      <StatCard
        icon={<Package size={24} />}
        title="Gesamtartikel"
        value={summary?.total_products ?? "-"}
        dataTestId="dashboard-stat-total-products"
        isLoading={summaryLoading}
      />
      <StatCard
        icon={<Activity size={24} />}
        title="Auslastung"
        value={summary ? `${summary.utilization_percent}%` : "-"}
        dataTestId="dashboard-stat-utilization"
        isLoading={summaryLoading}
      />
      <StatCard
        icon={<Truck size={24} />}
        title="Offene Aufträge"
        value={summary ? summary.open_goods_receipts + summary.open_goods_issues : "-"}
        dataTestId="dashboard-stat-open-orders"
        isLoading={summaryLoading}
      />
      <StatCard
        icon={<AlertTriangle size={24} />}
        title="Unter Bestandsgrenze"
        value={summary?.low_stock_count ?? "-"}
        dataTestId="dashboard-stat-low-stock"
        isLoading={summaryLoading}
      />
      <StatCard
        icon={<TrendingUp size={24} />}
        title="Turnover Rate"
        value={kpis?.turnover_rate ?? "-"}
        dataTestId="dashboard-stat-turnover"
        isLoading={kpisLoading}
      />
      <StatCard
        icon={<Clock size={24} />}
        title="Dock-to-Stock (h)"
        value={kpis?.dock_to_stock_hours ?? "-"}
        dataTestId="dashboard-stat-dock-to-stock"
        isLoading={kpisLoading}
      />
      <StatCard
        icon={<CheckCircle size={24} />}
        title="Bestandsgenauigkeit"
        value={kpis ? `${kpis.inventory_accuracy_percent}%` : "-"}
        dataTestId="dashboard-stat-accuracy"
        isLoading={kpisLoading}
      />
      <StatCard
        icon={<AlertTriangle size={24} />}
        title="Warnungen"
        value={kpis?.alert_count ?? "-"}
        dataTestId="dashboard-stat-alerts"
        isLoading={kpisLoading}
      />
    </>
  );
}
