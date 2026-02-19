import { AlertTriangle, CheckCircle, Clock, Package, Activity, TrendingUp, Truck } from "lucide-react";
import type { DashboardSummary, ReportKpiResponse } from "../../../types";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  dataTestId?: string;
}

function StatCard({ title, value, icon, dataTestId }: StatCardProps) {
  return (
    <div className="stat-card" data-testid={dataTestId}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-content">
        <span className="stat-label">{title}</span>
        <span className="stat-value">{value}</span>
      </div>
    </div>
  );
}

interface DashboardStatsProps {
  summary?: DashboardSummary;
  kpis?: ReportKpiResponse;
  visible: boolean;
}

export function DashboardStats({ summary, kpis, visible }: DashboardStatsProps) {
  if (!visible) return null;

  return (
    <>
      <StatCard
        icon={<Package size={24} />}
        title="Gesamtartikel"
        value={summary?.total_products ?? "-"}
        dataTestId="dashboard-stat-total-products"
      />
      <StatCard
        icon={<Activity size={24} />}
        title="Auslastung"
        value={summary ? `${summary.utilization_percent}%` : "-"}
        dataTestId="dashboard-stat-utilization"
      />
      <StatCard
        icon={<Truck size={24} />}
        title="Offene Aufträge"
        value={summary ? summary.open_goods_receipts + summary.open_goods_issues : "-"}
        dataTestId="dashboard-stat-open-orders"
      />
      <StatCard
        icon={<AlertTriangle size={24} />}
        title="Unter Bestandsgrenze"
        value={summary?.low_stock_count ?? "-"}
        dataTestId="dashboard-stat-low-stock"
      />
      <StatCard
        icon={<TrendingUp size={24} />}
        title="Turnover Rate"
        value={kpis?.turnover_rate ?? "-"}
        dataTestId="dashboard-stat-turnover"
      />
      <StatCard
        icon={<Clock size={24} />}
        title="Dock-to-Stock (h)"
        value={kpis?.dock_to_stock_hours ?? "-"}
        dataTestId="dashboard-stat-dock-to-stock"
      />
      <StatCard
        icon={<CheckCircle size={24} />}
        title="Bestandsgenauigkeit"
        value={kpis ? `${kpis.inventory_accuracy_percent}%` : "-"}
        dataTestId="dashboard-stat-accuracy"
      />
      <StatCard
        icon={<AlertTriangle size={24} />}
        title="Warnungen"
        value={kpis?.alert_count ?? "-"}
        dataTestId="dashboard-stat-alerts"
      />
    </>
  );
}
