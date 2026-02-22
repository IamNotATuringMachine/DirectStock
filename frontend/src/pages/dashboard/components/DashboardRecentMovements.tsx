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
      <h3 className="text-lg font-semibold mb-4 text-[var(--ink)]">Letzte Bewegungen</h3>
      <div className="flex flex-col gap-0 flex-1">
        {isLoading ? (
          <>
            <div className="flex items-center justify-between py-3 border-b border-[var(--line)] last:border-0">
              <div className="flex flex-col w-1/3">
                <Skeleton height={16} width="80%" className="mb-1" />
                <Skeleton height={12} width="60%" />
              </div>
              <div className="flex flex-col items-end gap-1">
                <Skeleton height={20} width={60} className="rounded-full" />
                <Skeleton height={16} width={100} />
              </div>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-[var(--line)] last:border-0">
              <div className="flex flex-col w-1/3">
                <Skeleton height={16} width="70%" className="mb-1" />
                <Skeleton height={12} width="50%" />
              </div>
              <div className="flex flex-col items-end gap-1">
                <Skeleton height={20} width={60} className="rounded-full" />
                <Skeleton height={16} width={80} />
              </div>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-[var(--line)] last:border-0">
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
          (data?.items ?? []).map((movement) => {
            const movementBadgeClass =
              movement.movement_type === "goods_receipt"
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                : movement.movement_type === "goods_issue"
                  ? "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                  : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200";

            return (
              <div key={movement.id} className="flex items-center justify-between py-3 border-b border-[var(--line)] last:border-0 hover:bg-[var(--panel-soft)] transition-colors -mx-2 px-2 rounded-lg">
                <div className="flex flex-col">
                  <strong className="text-sm text-[var(--ink)]">{movement.product_number}</strong>
                  <span className="text-xs text-[var(--muted)]">
                    {new Date(movement.performed_at).toLocaleString()}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${movementBadgeClass}`}
                  >
                    {movement.movement_type === "goods_receipt"
                      ? "Eingang"
                      : movement.movement_type === "goods_issue"
                        ? "Ausgang"
                        : "Umlag."}
                  </span>
                  <span className="text-sm font-medium text-[var(--ink)]">
                    {movement.quantity} Stk. ({movement.from_bin_code || "-"} → {movement.to_bin_code || "-"})
                  </span>
                </div>
              </div>
            );
          })
        )}
        {!isLoading && (!data?.items || data.items.length === 0) && (
          <p className="text-sm text-[var(--muted)] italic p-4 text-center mt-auto mb-auto">Keine aktuellen Bewegungen.</p>
        )}
      </div>
    </article>
  );
}
