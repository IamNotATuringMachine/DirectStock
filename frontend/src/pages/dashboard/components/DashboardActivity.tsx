import type { DashboardActivityToday } from "../../../types";
import { Skeleton } from "../../../components/Skeleton";

interface DashboardActivityProps {
  data?: DashboardActivityToday;
  visible: boolean;
  isLoading?: boolean;
}

export function DashboardActivity({ data, visible, isLoading }: DashboardActivityProps) {
  if (!visible) return null;

  return (
    <div className="dashboard-full-width">
      <article className="subpanel">
        <h3 className="text-lg font-semibold mb-4">Aktivität heute</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="dashboard-activity-card">
            <div className="text-2xl font-bold">
              {isLoading ? (
                <Skeleton height={32} width="40%" className="mx-auto" />
              ) : (
                data?.movements_today ?? "-"
              )}
            </div>
            <div className="dashboard-activity-label">Bewegungen</div>
          </div>
          <div className="dashboard-activity-card">
            <div className="text-2xl font-bold">
              {isLoading ? (
                <Skeleton height={32} width="40%" className="mx-auto" />
              ) : (
                data?.completed_goods_receipts_today ?? "-"
              )}
            </div>
            <div className="dashboard-activity-label">Wareneingänge</div>
          </div>
          <div className="dashboard-activity-card">
            <div className="text-2xl font-bold">
              {isLoading ? (
                <Skeleton height={32} width="40%" className="mx-auto" />
              ) : (
                data?.completed_goods_issues_today ?? "-"
              )}
            </div>
            <div className="dashboard-activity-label">Warenausgänge</div>
          </div>
          <div className="dashboard-activity-card">
            <div className="text-2xl font-bold">
              {isLoading ? (
                <Skeleton height={32} width="40%" className="mx-auto" />
              ) : (
                data?.completed_stock_transfers_today ?? "-"
              )}
            </div>
            <div className="dashboard-activity-label">Umlagerungen</div>
          </div>
        </div>
      </article>
    </div>
  );
}
