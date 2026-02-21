import { Link } from "react-router-dom";
import type { AlertListResponse, AlertEvent } from "../../../types";
import { Skeleton } from "../../../components/Skeleton";

interface DashboardCriticalAlertsProps {
  data?: AlertListResponse;
  visible: boolean;
  isLoading?: boolean;
}

export function DashboardCriticalAlerts({ data, visible, isLoading }: DashboardCriticalAlertsProps) {
  if (!visible) return null;

  return (
    <article className="subpanel h-full border-l-4 border-l-red-500">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-red-700">Kritische Warnungen</h3>
        <Link to="/alerts" className="text-xs font-semibold text-red-700 hover:underline">
          Alle ansehen
        </Link>
      </div>
      <div className="flex flex-col gap-2">
        {isLoading ? (
          <>
            <Skeleton height={48} className="rounded-lg" />
            <Skeleton height={48} className="rounded-lg" />
            <Skeleton height={48} className="rounded-lg" />
          </>
        ) : (
          (data?.items ?? []).map((alert: AlertEvent) => (
            <div
              key={alert.id}
              className="p-3 rounded-lg bg-red-50 border border-red-100 flex justify-between items-center transition-colors hover:bg-red-100 hover:border-red-200"
            >
              <span className="text-sm font-medium text-red-900 truncate flex-1 mr-2">{alert.title}</span>
              <span className="text-xs text-red-700 font-mono whitespace-nowrap bg-red-100/50 px-2 py-0.5 rounded">
                {new Date(alert.triggered_at).toLocaleTimeString()}
              </span>
            </div>
          ))
        )}
        {!isLoading && (!data?.items || data.items.length === 0) && (
          <p className="text-sm text-zinc-500 italic p-2">Keine kritischen Warnungen.</p>
        )}
      </div>
    </article>
  );
}
