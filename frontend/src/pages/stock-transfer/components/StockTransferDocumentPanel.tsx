import type { FormEvent } from "react";
import { CheckCircle, X } from "lucide-react";

import type { StockTransfer } from "../../../types";

type StockTransferDocumentPanelProps = {
  notes: string;
  setNotes: (value: string) => void;
  transfers: StockTransfer[];
  selectedTransferId: number | null;
  selectedTransfer: StockTransfer | null;
  onSelectTransfer: (id: number) => void;
  onCreateTransfer: (event: FormEvent) => void;
  createTransferPending: boolean;
  onComplete: () => void;
  completePending: boolean;
  onCancel: () => void;
  cancelPending: boolean;
};

export function StockTransferDocumentPanel({
  notes,
  setNotes,
  transfers,
  selectedTransferId,
  selectedTransfer,
  onSelectTransfer,
  onCreateTransfer,
  createTransferPending,
  onComplete,
  completePending,
  onCancel,
  cancelPending,
}: StockTransferDocumentPanelProps) {
  return (
    <section className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-[var(--line)] bg-[var(--panel-soft)]">
        <h3 className="section-title flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[var(--accent)] text-white text-xs font-bold">1</div>
          Belegverwaltung
        </h3>
      </div>

      <div className="p-4 space-y-6 flex-1 overflow-y-auto">
        <form className="space-y-3" onSubmit={onCreateTransfer}>
          <div className="space-y-1.5">
            <label className="form-label-standard uppercase tracking-wider">Notiz (Optional)</label>
            <input
              className="input w-full"
              placeholder="z.B. Monatliche Umlagerung"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
          <button className="btn btn-primary w-full justify-center" type="submit" disabled={createTransferPending}>
            {createTransferPending ? "Erstelle..." : "Neuen Beleg erstellen"}
          </button>
        </form>

        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Offene Transfers</h4>
          <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {transfers.length === 0 ? (
              <p className="text-sm text-[var(--muted)] italic py-2">Keine offenen Transfers.</p>
            ) : (
              transfers.map((transfer) => (
                <button
                  key={transfer.id}
                  className={`w-full text-left p-3 rounded-[var(--radius-sm)] border text-sm transition-all hover:shadow-sm ${selectedTransferId === transfer.id
                    ? "bg-[var(--panel-strong)] border-[var(--accent)] ring-1 ring-[var(--accent)]"
                    : "bg-[var(--panel)] border-[var(--line)] hover:bg-[var(--panel-soft)]"
                    }`}
                  onClick={() => onSelectTransfer(transfer.id)}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold font-mono text-[var(--accent)] truncate min-w-0 flex-1 mr-2">
                      {transfer.transfer_number}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider border
                               ${transfer.status === "completed"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800"
                        : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800"
                      }
                            `}>
                      {transfer.status}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-[var(--muted)]">
                    <span className="truncate min-w-0">{transfer.notes || "Keine Notiz"}</span>
                    <span>#{transfer.id}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {selectedTransfer && (
          <div className="pt-4 border-t border-[var(--line)] mt-auto grid grid-cols-2 gap-3">
            <button
              className="btn w-full justify-center text-xs hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400 dark:hover:border-emerald-800"
              disabled={selectedTransfer.status !== "draft" || completePending}
              onClick={onComplete}
            >
              <CheckCircle className="w-3.5 h-3.5 mr-1" />
              Abschließen
            </button>
            <button
              className="btn w-full justify-center text-xs hover:bg-red-50 hover:text-red-700 hover:border-red-200 dark:hover:bg-red-900/20 dark:hover:text-red-400 dark:hover:border-red-800"
              disabled={selectedTransfer.status !== "draft" || cancelPending}
              onClick={onCancel}
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Stornieren
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
