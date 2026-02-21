import type { DashboardRecentMovements } from "../../../types";
import { Skeleton } from "../../../components/Skeleton";

interface DashboardRecentMovementsProps {
  data?: DashboardRecentMovements;
  visible: boolean;
  isLoading?: boolean;
}

export function DashboardRecentMovements({ data, visible, isLoading }: DashboardRecentMovementsProps) {
  if (!visible) return null;

  return (
    <article className="subpanel h-full flex flex-col">
      <h3 className="text-lg font-semibold mb-4 text-zinc-900">Letzte Bewegungen</h3>
      <div className="flex flex-col gap-0 flex-1">
        {isLoading ? (
          <>
            <div className="flex items-center justify-between py-3 border-b border-zinc-100 last:border-0">
              <div className="flex flex-col w-1/3">
                <Skeleton height={16} width="80%" className="mb-1" />
                <Skeleton height={12} width="60%" />
              </div>
              <div className="flex flex-col items-end gap-1">
                <Skeleton height={20} width={60} className="rounded-full" />
                <Skeleton height={16} width={100} />
              </div>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-zinc-100 last:border-0">
              <div className="flex flex-col w-1/3">
                <Skeleton height={16} width="70%" className="mb-1" />
                <Skeleton height={12} width="50%" />
              </div>
              <div className="flex flex-col items-end gap-1">
                <Skeleton height={20} width={60} className="rounded-full" />
                <Skeleton height={16} width={80} />
              </div>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-zinc-100 last:border-0">
              <div className="flex flex-col w-1/3">
                <Skeleton height={16} width="90%" className="mb-1" />
                <Skeleton height={12} width="70%" />
              </div>
              <div className="flex flex-col items-end gap-1">
                <Skeleton height={20} width={60} className="rounded-full" />
                <Skeleton height={16} width={120} />
              </div>
            </div>
          </>
        ) : (
          (data?.items ?? []).map((movement) => (
            <div key={movement.id} className="flex items-center justify-between py-3 border-b border-zinc-100 last:border-0 hover:bg-zinc-50/50 transition-colors -mx-2 px-2 rounded-lg">
              <div className="flex flex-col">
                <strong className="text-sm text-zinc-900">{movement.product_number}</strong>
                <span className="text-xs text-zinc-500">
                  {new Date(movement.performed_at).toLocaleString()}
                </span>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${
                    movement.movement_type === "goods_receipt"
                      ? "bg-zinc-100 text-zinc-800"
                      : movement.movement_type === "goods_issue"
                      ? "bg-zinc-100 text-zinc-800"
                      : "bg-zinc-100 text-zinc-800"
                  }`}
                >
                  {movement.movement_type === "goods_receipt"
                    ? "Eingang"
                    : movement.movement_type === "goods_issue"
                    ? "Ausgang"
                    : "Umlag."}
                </span>
                <span className="text-sm font-medium text-zinc-900">
                  {movement.quantity} Stk. ({movement.from_bin_code || "-"} → {movement.to_bin_code || "-"})
                </span>
              </div>
            </div>
          ))
        )}
        {!isLoading && (!data?.items || data.items.length === 0) && (
          <p className="text-sm text-zinc-500 italic p-4 text-center mt-auto mb-auto">Keine aktuellen Bewegungen.</p>
        )}
      </div>
    </article>
  );
}
