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
    <article className="subpanel h-full">
      <h3 className="text-lg font-semibold mb-4">Niedrige Bestände</h3>
      <div className="flex flex-col gap-0">
        {isLoading ? (
          <>
            <div className="modern-list-item">
              <div className="flex flex-col w-1/2">
                <Skeleton height={16} width="80%" className="mb-1" />
                <Skeleton height={12} width="40%" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton height={20} width={40} />
                <Skeleton height={20} width={40} />
              </div>
            </div>
            <div className="modern-list-item">
              <div className="flex flex-col w-1/2">
                <Skeleton height={16} width="70%" className="mb-1" />
                <Skeleton height={12} width="30%" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton height={20} width={40} />
                <Skeleton height={20} width={40} />
              </div>
            </div>
            <div className="modern-list-item">
              <div className="flex flex-col w-1/2">
                <Skeleton height={16} width="90%" className="mb-1" />
                <Skeleton height={12} width="50%" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton height={20} width={40} />
                <Skeleton height={20} width={40} />
              </div>
            </div>
          </>
        ) : (
          (data?.items ?? []).map((item) => (
            <div key={`${item.product_id}-${item.warehouse_id}`} className="modern-list-item">
              <div className="flex flex-col">
                <strong className="text-sm">{item.product_number}</strong>
                <span className="text-xs text-muted-foreground">{item.warehouse_code}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="block text-xs text-muted-foreground">Bestand</span>
                  <strong className="text-sm text-red-600">{item.on_hand}</strong>
                </div>
                <div className="text-right">
                  <span className="block text-xs text-muted-foreground">Min</span>
                  <strong className="text-sm">{item.threshold}</strong>
                </div>
              </div>
            </div>
          ))
        )}
        {!isLoading && (!data?.items || data.items.length === 0) && (
          <p className="text-sm text-muted-foreground italic p-4">Alle Bestände im Soll-Bereich.</p>
        )}
      </div>
    </article>
  );
}
