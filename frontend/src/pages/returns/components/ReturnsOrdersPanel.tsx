import type { FormEvent } from "react";
import { ArrowRight, ClipboardList } from "lucide-react";

import type { ReturnOrder } from "../../../types";

export type ReturnsOrdersPanelProps = {
  orders: ReturnOrder[];
  selectedOrderId: number | null;
  onSelectOrder: (orderId: number) => void;
  sourceType: "customer" | "technician";
  onSourceTypeChange: (value: "customer" | "technician") => void;
  sourceReference: string;
  onSourceReferenceChange: (value: string) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  onCreateOrder: (event: FormEvent) => void;
  createOrderPending: boolean;
};

export function ReturnsOrdersPanel({
  orders,
  selectedOrderId,
  onSelectOrder,
  sourceType,
  onSourceTypeChange,
  sourceReference,
  onSourceReferenceChange,
  notes,
  onNotesChange,
  onCreateOrder,
  createOrderPending,
}: ReturnsOrdersPanelProps) {
  return (
    <div className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm flex flex-col h-[calc(100vh-200px)] min-h-[500px]">
      <div className="p-4 border-b border-[var(--line)] bg-[var(--panel-soft)]">
        <h3 className="section-title flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-[var(--muted)]" />
          Auftraege
        </h3>
      </div>

      <div className="p-4 flex-1 overflow-hidden flex flex-col gap-4">
        <form onSubmit={onCreateOrder} data-testid="return-order-create-form" className="flex flex-col gap-3">
          <select
            className="input w-full"
            value={sourceType}
            onChange={(event) => onSourceTypeChange(event.target.value as "customer" | "technician")}
            data-testid="return-order-source-type-select"
          >
            <option value="customer">Kunde</option>
            <option value="technician">Techniker</option>
          </select>

          <input
            className="input w-full"
            placeholder="Quelle Referenz (optional)"
            value={sourceReference}
            onChange={(event) => onSourceReferenceChange(event.target.value)}
            data-testid="return-order-source-reference-input"
          />

          <div className="flex gap-2">
            <input
              className="input w-full min-w-0"
              placeholder="Notiz / Referenz (Optional)"
              value={notes}
              onChange={(event) => onNotesChange(event.target.value)}
              data-testid="return-order-notes-input"
            />
            <button
              className="btn btn-primary shrink-0"
              type="submit"
              disabled={createOrderPending}
              data-testid="return-order-create-btn"
            >
              Neu
            </button>
          </div>
        </form>

        <div
          className="flex-1 overflow-y-auto border border-[var(--line)] rounded-[var(--radius-sm)] bg-[var(--bg)]"
          data-testid="return-order-list"
        >
          {orders.length === 0 ? (
            <div className="p-8 text-center text-[var(--muted)] italic text-sm">Keine Retouren gefunden.</div>
          ) : (
            <div className="divide-y divide-[var(--line)]">
              {orders.map((order) => (
                <button
                  key={order.id}
                  className={`w-full text-left p-3 hover:bg-[var(--panel-soft)] transition-colors flex items-center justify-between gap-3 group
                    ${selectedOrderId === order.id ? "bg-[var(--panel-strong)] border-l-4 border-l-[var(--accent)] pl-[calc(0.75rem-4px)]" : "border-l-4 border-l-transparent"}`}
                  onClick={() => onSelectOrder(order.id)}
                  data-testid={`return-order-item-${order.id}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-[var(--ink)] truncate">{order.return_number}</div>
                    <div className="text-xs text-[var(--muted)] flex items-center gap-1.5 mt-0.5">
                      <span
                        className={`inline-block w-2 h-2 rounded-full
                        ${order.status === "resolved" ? "bg-emerald-500" : order.status === "cancelled" ? "bg-red-500" : order.status === "registered" ? "bg-blue-500" : "bg-amber-500"}`}
                      ></span>
                      {order.status}
                    </div>
                  </div>
                  <ArrowRight
                    className={`w-4 h-4 text-[var(--muted)] transition-transform ${selectedOrderId === order.id ? "opacity-100" : "opacity-0 group-hover:opacity-50"}`}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
