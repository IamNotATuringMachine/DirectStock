import type { DashboardRecentMovements } from "../../../types";

interface DashboardRecentMovementsProps {
  data?: DashboardRecentMovements;
  visible: boolean;
}

export function DashboardRecentMovements({ data, visible }: DashboardRecentMovementsProps) {
  if (!visible) return null;

  return (
    <article className="subpanel h-full">
      <h3 className="text-lg font-semibold mb-4">Letzte Bewegungen</h3>
      <div className="flex flex-col gap-0">
        {(data?.items ?? []).map((movement) => (
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
        ))}
        {(!data?.items || data.items.length === 0) && (
          <p className="text-sm text-muted-foreground italic p-4">Keine aktuellen Bewegungen.</p>
        )}
      </div>
    </article>
  );
}
