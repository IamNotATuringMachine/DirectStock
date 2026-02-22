import type { DashboardLowStock } from "../../../types";
import { Skeleton } from "../../../components/Skeleton";

interface DashboardLowStockProps {
  data?: DashboardLowStock;
  visible: boolean;
  isLoading?: boolean;
}

export function DashboardLowStock({ data, visible, isLoading }: DashboardLowStockProps) {
  if (!visible) return null;

  return (
    <article className="subpanel h-full flex flex-col">
      <h3 className="text-lg font-semibold mb-4 text-[var(--ink)]">Niedrige Bestände</h3>
      <div className="flex flex-col gap-0 flex-1">
        {isLoading ? (
          <>
            <div className="flex items-center justify-between py-3 border-b border-[var(--line)] last:border-0">
              <div className="flex flex-col w-1/2">
                <Skeleton height={16} width="80%" className="mb-1" />
                <Skeleton height={12} width="40%" />
              </div>
              <div className="flex items-center gap-4">
                <Skeleton height={20} width={40} />
                <Skeleton height={20} width={40} />
              </div>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-[var(--line)] last:border-0">
              <div className="flex flex-col w-1/2">
                <Skeleton height={16} width="70%" className="mb-1" />
                <Skeleton height={12} width="30%" />
              </div>
              <div className="flex items-center gap-4">
                <Skeleton height={20} width={40} />
                <Skeleton height={20} width={40} />
              </div>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-[var(--line)] last:border-0">
              <div className="flex flex-col w-1/2">
                <Skeleton height={16} width="90%" className="mb-1" />
                <Skeleton height={12} width="50%" />
              </div>
              <div className="flex items-center gap-4">
                <Skeleton height={20} width={40} />
                <Skeleton height={20} width={40} />
              </div>
            </div>
          </>
        ) : (
          (data?.items ?? []).map((item) => (
            <div key={`${item.product_id}-${item.warehouse_id}`} className="flex items-center justify-between py-3 border-b border-[var(--line)] last:border-0 hover:bg-[var(--panel-soft)] transition-colors -mx-2 px-2 rounded-lg">
              <div className="flex flex-col">
                <strong className="text-sm text-[var(--ink)]">{item.product_number}</strong>
                <span className="text-xs text-[var(--muted)]">{item.warehouse_code}</span>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right flex flex-col items-end">
                  <span className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-0.5">Bestand</span>
                  <strong className="text-sm text-red-700 bg-red-50 px-2 py-0.5 rounded-md border border-red-200 dark:text-red-300 dark:bg-red-950/40 dark:border-red-900/60">{item.on_hand}</strong>
                </div>
                <div className="text-right flex flex-col items-end">
                  <span className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-0.5">Min</span>
                  <strong className="text-sm text-[var(--ink)] px-2 py-0.5">{item.threshold}</strong>
                </div>
              </div>
            </div>
          ))
        )}
        {!isLoading && (!data?.items || data.items.length === 0) && (
          <p className="text-sm text-[var(--muted)] italic p-4 text-center mt-auto mb-auto">Alle Bestände im Soll-Bereich.</p>
        )}
      </div>
    </article>
  );
}
