import { Link } from "react-router-dom";

import { Skeleton } from "../../../components/Skeleton";
import type { PurchaseOrder } from "../../../types";

type DashboardOpenPurchaseOrdersProps = {
  data?: PurchaseOrder[];
  visible: boolean;
  isLoading?: boolean;
  canReadPurchasing: boolean;
};

const statusLabels: Record<PurchaseOrder["status"], string> = {
  draft: "Entwurf",
  approved: "Freigegeben",
  ordered: "Bestellt",
  partially_received: "Teilweise erhalten",
  completed: "Abgeschlossen",
  cancelled: "Storniert",
};

export function DashboardOpenPurchaseOrders({
  data,
  visible,
  isLoading,
  canReadPurchasing,
}: DashboardOpenPurchaseOrdersProps) {
  if (!visible) {
    return null;
  }

  const items = data ?? [];

  return (
    <article className="subpanel h-full flex flex-col" data-testid="dashboard-open-purchase-orders-card">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-[var(--ink)]">Offene Bestellungen</h3>
        <Link to="/purchasing" className="text-xs font-semibold text-[var(--accent)] hover:underline">
          Einkauf öffnen
        </Link>
      </div>

      {!canReadPurchasing ? (
        <p className="text-sm text-[var(--muted)] italic">Keine Berechtigung für Einkaufsbestellungen.</p>
      ) : null}

      {canReadPurchasing ? (
        <div className="flex flex-col gap-0 flex-1">
          {isLoading ? (
            <>
              <Skeleton height={56} className="rounded-lg mb-2" />
              <Skeleton height={56} className="rounded-lg mb-2" />
              <Skeleton height={56} className="rounded-lg" />
            </>
          ) : (
            items.slice(0, 6).map((order) => (
              <div
                key={order.id}
                className="py-3 border-b border-[var(--line)] last:border-0 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[var(--ink)] truncate">{order.order_number}</div>
                  <div className="text-xs text-[var(--muted)] truncate">
                    Lieferstatus: {order.supplier_comm_status.replaceAll("_", " ")}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs px-2 py-1 rounded-full bg-[var(--panel-soft)] border border-[var(--line)] text-[var(--ink)]">
                    {statusLabels[order.status]}
                  </span>
                </div>
              </div>
            ))
          )}

          {!isLoading && items.length === 0 ? (
            <p className="text-sm text-[var(--muted)] italic p-4 text-center mt-auto mb-auto">
              Keine offenen Bestellungen.
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
