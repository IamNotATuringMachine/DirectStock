import { CheckCircle, FileText } from "lucide-react";

import type { ReturnOrder } from "../../../types";
import type { ReturnOrderStatus } from "../model";

export type ReturnsWorkflowPanelProps = {
  selectedOrder: ReturnOrder | null;
  allowedTransitions: ReturnOrderStatus[];
  onStatusTransition: (status: ReturnOrderStatus) => void;
  statusPending: boolean;
};

export function ReturnsWorkflowPanel({
  selectedOrder,
  allowedTransitions,
  onStatusTransition,
  statusPending,
}: ReturnsWorkflowPanelProps) {
  return (
    <div className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm h-auto lg:h-[calc(100vh-200px)] lg:min-h-[500px]">
      <div className="p-4 border-b border-[var(--line)] bg-[var(--panel-soft)]">
        <h3 className="section-title flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-[var(--muted)]" />
          Workflow
        </h3>
      </div>

      <div className="p-6">
        {!selectedOrder ? (
          <div className="flex flex-col items-center justify-center text-[var(--muted)] py-12 text-center">
            <FileText className="w-12 h-12 mb-3 opacity-20" />
            <p>Kein Auftrag ausgewählt.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <span className="text-xs uppercase tracking-wider text-[var(--muted)] font-bold block mb-2">
                Aktueller Status
              </span>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--panel-strong)] border border-[var(--line)] text-[var(--ink)] font-medium text-sm">
                <span
                  className={`w-2 h-2 rounded-full ${selectedOrder.status === "resolved" ? "bg-emerald-500" : "bg-blue-500"}`}
                ></span>
                {selectedOrder.status.toUpperCase()}
              </div>
            </div>

            <div className="border-t border-[var(--line)] pt-6">
              <span className="text-xs uppercase tracking-wider text-[var(--muted)] font-bold block mb-4">
                Aktionen
              </span>

              {allowedTransitions.length > 0 ? (
                <div className="grid grid-cols-1 gap-3">
                  {allowedTransitions.map((statusName) => (
                    <button
                      key={statusName}
                      className="btn w-full justify-start relative group"
                      onClick={() => onStatusTransition(statusName)}
                      disabled={statusPending}
                      data-testid={`return-order-status-${statusName}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full border border-[var(--line-strong)] flex items-center justify-center bg-[var(--panel)] group-hover:border-[var(--accent)] transition-colors">
                          <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        </div>
                        <span className="font-medium">Status setzen: {statusName}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-[var(--bg)] border border-[var(--line)] rounded-[var(--radius-sm)] text-center">
                  <CheckCircle className="w-8 h-8 mx-auto text-emerald-500 mb-2 opacity-80" />
                  <p className="text-sm text-[var(--ink)] font-medium">Vorgang abgeschlossen</p>
                  <p className="text-xs text-[var(--muted)]">Keine weiteren Aktionen möglich.</p>
                </div>
              )}
            </div>

            {selectedOrder.notes ? (
              <div className="border-t border-[var(--line)] pt-6">
                <span className="text-xs uppercase tracking-wider text-[var(--muted)] font-bold block mb-2">Notizen</span>
                <p className="text-sm text-[var(--ink)] bg-[var(--bg)] p-3 rounded-[var(--radius-sm)] border border-[var(--line)] text-wrap break-words min-w-0">
                  {selectedOrder.notes}
                </p>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
