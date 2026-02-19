import { CheckCircle, ClipboardList, RefreshCw } from "lucide-react";

import type { InventoryCountSession } from "../../../types";

type InventoryCountSummary = {
  total: number;
  counted: number;
  recount_required: number;
};

export type InventoryCountActionsPanelProps = {
  selectedSession: InventoryCountSession | null;
  onGenerate: (refresh: boolean) => void;
  generatePending: boolean;
  onComplete: (sessionId: number) => void;
  completePending: boolean;
  summary: InventoryCountSummary | undefined;
};

export function InventoryCountActionsPanel({
  selectedSession,
  onGenerate,
  generatePending,
  onComplete,
  completePending,
  summary,
}: InventoryCountActionsPanelProps) {
  return (
    <article className="subpanel bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 flex items-center gap-2">
        <h3 className="section-title text-zinc-900 dark:text-zinc-100">2. Zählliste und Abschluss</h3>
      </div>

      <div className="p-4 space-y-6 flex-1 flex flex-col">
        {selectedSession ? (
          <>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800/50">
              <p className="text-sm text-blue-800 dark:text-blue-300 flex items-center gap-2" data-testid="inventory-count-selected-session">
                <CheckCircle className="w-4 h-4" />
                Aktive Session: <strong>{selectedSession.session_number}</strong>
                <span className="opacity-75">({selectedSession.status})</span>
              </p>
            </div>

            <div className="actions-cell flex flex-col gap-2">
              <button
                className="btn h-10 w-full rounded-lg bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => onGenerate(false)}
                disabled={generatePending || selectedSession.status === "completed"}
                data-testid="inventory-count-generate-btn"
              >
                <ClipboardList className="w-4 h-4" />
                Zählliste generieren
              </button>
              <button
                className="btn h-10 w-full rounded-lg bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => onGenerate(true)}
                disabled={generatePending || selectedSession.status === "completed"}
                data-testid="inventory-count-regenerate-btn"
              >
                <RefreshCw className="w-4 h-4" />
                Neu generieren
              </button>
              <button
                className="btn h-10 w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => onComplete(selectedSession.id)}
                disabled={completePending || selectedSession.status === "completed"}
                data-testid="inventory-count-complete-btn"
              >
                <CheckCircle className="w-4 h-4" />
                Session abschließen
              </button>
            </div>

            <div className="kpi-grid compact grid grid-cols-3 gap-3 mt-auto">
              <div className="kpi-card p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/30 text-center">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 block mb-1">Positionen</span>
                <strong className="text-lg font-bold text-zinc-900 dark:text-zinc-100" data-testid="inventory-count-summary-total">
                  {summary?.total ?? "-"}
                </strong>
              </div>
              <div className="kpi-card p-3 rounded-lg border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-900/10 text-center">
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 block mb-1">Gezählt</span>
                <strong className="text-lg font-bold text-emerald-700 dark:text-emerald-400" data-testid="inventory-count-summary-counted">
                  {summary?.counted ?? "-"}
                </strong>
              </div>
              <div className="kpi-card p-3 rounded-lg border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-900/10 text-center">
                <span className="text-xs font-medium text-rose-600 dark:text-rose-400 block mb-1">Nachzählung</span>
                <strong className="text-lg font-bold text-rose-700 dark:text-rose-400" data-testid="inventory-count-summary-recount">
                  {summary?.recount_required ?? "-"}
                </strong>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 dark:text-zinc-400 italic py-12">
            <ClipboardList className="w-12 h-12 opacity-20 mb-2" />
            <p>Bitte zuerst eine Session auswählen.</p>
          </div>
        )}
      </div>
    </article>
  );
}
