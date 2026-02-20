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
    <article className="subpanel h-full">
      <h3 className="text-lg font-semibold mb-4">Letzte Bewegungen</h3>
      <div className="flex flex-col gap-0">
        {isLoading ? (
          <>
            <div className="modern-list-item">
              <div className="flex flex-col w-1/3">
                <Skeleton height={16} width="80%" className="mb-1" />
                <Skeleton height={12} width="60%" />
              </div>
              <div className="flex flex-col items-end gap-1">
                <Skeleton height={20} width={60} className="rounded-full" />
                <Skeleton height={16} width={100} />
              </div>
            </div>
            <div className="modern-list-item">
              <div className="flex flex-col w-1/3">
                <Skeleton height={16} width="70%" className="mb-1" />
                <Skeleton height={12} width="50%" />
              </div>
              <div className="flex flex-col items-end gap-1">
                <Skeleton height={20} width={60} className="rounded-full" />
                <Skeleton height={16} width={80} />
              </div>
            </div>
            <div className="modern-list-item">
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
            <div key={movement.id} className="modern-list-item">
              <div className="flex flex-col">
                <strong className="text-sm">{movement.product_number}</strong>
                <span className="text-xs text-muted-foreground">
                  {new Date(movement.performed_at).toLocaleString()}
                </span>
              </div>

              <div className="flex flex-col items-end gap-1">
                <span
                  className={`movement-type-badge ${
                    movement.movement_type === "goods_receipt"
                      ? "badge-in"
                      : movement.movement_type === "goods_issue"
                      ? "badge-out"
                      : "badge-transfer"
                  }`}
                >
                  {movement.movement_type === "goods_receipt"
                    ? "Eingang"
                    : movement.movement_type === "goods_issue"
                    ? "Ausgang"
                    : "Umlag."}
                </span>
                <span className="text-sm font-medium">
                  {movement.quantity} Stk. ({movement.from_bin_code || "-"} → {movement.to_bin_code || "-"})
                </span>
              </div>
            </div>
          ))
        )}
        {!isLoading && (!data?.items || data.items.length === 0) && (
          <p className="text-sm text-muted-foreground italic p-4">Keine aktuellen Bewegungen.</p>
        )}
      </div>
    </article>
  );
}
