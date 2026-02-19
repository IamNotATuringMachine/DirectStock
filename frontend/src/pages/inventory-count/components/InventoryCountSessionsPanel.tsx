import type { FormEvent } from "react";
import { Archive, ChevronRight, FileText, History, Plus, Target } from "lucide-react";

import type { InventoryCountSession, Warehouse } from "../../../types";

export type InventoryCountSessionsPanelProps = {
  sessionType: "snapshot" | "cycle";
  onSessionTypeChange: (value: "snapshot" | "cycle") => void;
  warehouseId: string;
  onWarehouseIdChange: (value: string) => void;
  toleranceQuantity: string;
  onToleranceQuantityChange: (value: string) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  onCreateSession: (event: FormEvent) => void;
  createSessionPending: boolean;
  warehouses: Warehouse[];
  sessions: InventoryCountSession[];
  selectedSessionId: number | null;
  onSelectSession: (sessionId: number) => void;
};

export function InventoryCountSessionsPanel({
  sessionType,
  onSessionTypeChange,
  warehouseId,
  onWarehouseIdChange,
  toleranceQuantity,
  onToleranceQuantityChange,
  notes,
  onNotesChange,
  onCreateSession,
  createSessionPending,
  warehouses,
  sessions,
  selectedSessionId,
  onSelectSession,
}: InventoryCountSessionsPanelProps) {
  return (
    <article className="subpanel bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 flex items-center gap-2">
        <h3 className="section-title text-zinc-900 dark:text-zinc-100">1. Session anlegen</h3>
      </div>

      <div className="p-4 space-y-6 flex-1 flex flex-col">
        <form className="form-grid grid gap-4" onSubmit={onCreateSession} data-testid="inventory-count-create-form">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5 form-label-standard text-zinc-700 dark:text-zinc-300">
              <span className="flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" /> Inventurtyp
              </span>
              <select
                className="input h-10 px-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                value={sessionType}
                onChange={(event) => onSessionTypeChange(event.target.value as "snapshot" | "cycle")}
                data-testid="inventory-count-type-select"
              >
                <option value="snapshot">Stichtag</option>
                <option value="cycle">Permanent</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5 form-label-standard text-zinc-700 dark:text-zinc-300">
              <span className="flex items-center gap-1.5">
                <Archive className="w-3.5 h-3.5" /> Lager
              </span>
              <select
                className="input h-10 px-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                value={warehouseId}
                onChange={(event) => onWarehouseIdChange(event.target.value)}
                data-testid="inventory-count-warehouse-select"
              >
                <option value="">Alle Lager</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.code} - {warehouse.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5 form-label-standard text-zinc-700 dark:text-zinc-300">
              <span className="flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" /> Toleranz
              </span>
              <input
                className="input h-10 px-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                type="number"
                min="0"
                step="0.001"
                value={toleranceQuantity}
                onChange={(event) => onToleranceQuantityChange(event.target.value)}
                data-testid="inventory-count-tolerance-input"
              />
            </label>
            <label className="flex flex-col gap-1.5 form-label-standard text-zinc-700 dark:text-zinc-300">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Notiz
              </span>
              <input
                className="input h-10 px-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                value={notes}
                onChange={(event) => onNotesChange(event.target.value)}
                data-testid="inventory-count-notes-input"
              />
            </label>
          </div>
          <button
            className="btn h-10 w-full rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            type="submit"
            disabled={createSessionPending}
            data-testid="inventory-count-create-btn"
          >
            <Plus className="w-4 h-4" />
            Session erstellen
          </button>
        </form>

        <div
          className="list-stack small flex-1 overflow-y-auto min-h-[150px] border border-zinc-200 dark:border-zinc-700 rounded-lg divide-y divide-zinc-100 dark:divide-zinc-700 bg-zinc-50 dark:bg-zinc-900/30"
          data-testid="inventory-count-session-list"
        >
          {sessions.map((session) => (
            <button
              key={session.id}
              className={`list-item w-full text-left p-3 transition-colors flex items-center justify-between group ${
                selectedSessionId === session.id
                  ? "active bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500"
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-800 border-l-4 border-l-transparent"
              }`}
              onClick={() => onSelectSession(session.id)}
              data-testid={`inventory-count-session-${session.id}`}
            >
              <div className="flex flex-col gap-1">
                <strong className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{session.session_number}</strong>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide ${
                      session.status === "completed"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : session.status === "in_progress"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    {session.status}
                  </span>
                  <span>{session.session_type}</span>
                </span>
              </div>
              {selectedSessionId === session.id ? <ChevronRight className="w-4 h-4 text-blue-500" /> : null}
            </button>
          ))}
          {sessions.length === 0 ? (
            <div className="p-4 text-center text-sm text-zinc-500 dark:text-zinc-400 italic">Keine Sessions gefunden.</div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
