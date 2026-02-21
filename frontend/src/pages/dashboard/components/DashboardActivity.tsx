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
    <div className="lg:col-span-4">
      <article className="subpanel">
        <h3 className="text-lg font-semibold mb-4 text-zinc-900">Aktivität heute</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 flex flex-col gap-1.5 transition-colors hover:bg-zinc-100">
            <div className="text-3xl font-bold text-zinc-900">
              {isLoading ? (
                <Skeleton height={36} width="40%" className="mx-auto" />
              ) : (
                data?.movements_today ?? "-"
              )}
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Bewegungen
            </div>
          </div>
          <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 flex flex-col gap-1.5 transition-colors hover:bg-zinc-100">
            <div className="text-3xl font-bold text-zinc-900">
              {isLoading ? (
                <Skeleton height={36} width="40%" className="mx-auto" />
              ) : (
                data?.completed_goods_receipts_today ?? "-"
              )}
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Wareneingänge
            </div>
          </div>
          <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 flex flex-col gap-1.5 transition-colors hover:bg-zinc-100">
            <div className="text-3xl font-bold text-zinc-900">
              {isLoading ? (
                <Skeleton height={36} width="40%" className="mx-auto" />
              ) : (
                data?.completed_goods_issues_today ?? "-"
              )}
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Warenausgänge
            </div>
          </div>
          <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 flex flex-col gap-1.5 transition-colors hover:bg-zinc-100">
            <div className="text-3xl font-bold text-zinc-900">
              {isLoading ? (
                <Skeleton height={36} width="40%" className="mx-auto" />
              ) : (
                data?.completed_stock_transfers_today ?? "-"
              )}
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Umlagerungen
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
