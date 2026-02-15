import { FormEvent } from "react";
import { Layers } from "lucide-react";

import type { WarehouseZoneType } from "../../types";

type BinBatchCreateDialogProps = {
  canWrite: boolean;
  selectedZoneId: number | null;
  batchPrefix: string;
  aisleTo: number;
  shelfTo: number;
  levelTo: number;
  isPending: boolean;
  onBatchPrefixChange: (value: string) => void;
  onAisleToChange: (value: number) => void;
  onShelfToChange: (value: number) => void;
  onLevelToChange: (value: number) => void;
  onSubmit: (event: FormEvent) => Promise<void> | void;
};

const _binType: WarehouseZoneType = "storage";

export default function BinBatchCreateDialog({
  canWrite,
  selectedZoneId,
  batchPrefix,
  aisleTo,
  shelfTo,
  levelTo,
  isPending,
  onBatchPrefixChange,
  onAisleToChange,
  onShelfToChange,
  onLevelToChange,
  onSubmit,
}: BinBatchCreateDialogProps) {
  if (!canWrite || !selectedZoneId) {
    return null;
  }

  return (
    <div className="p-4 bg-purple-50/50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800 rounded-lg animate-in fade-in slide-in-from-top-2" data-testid="warehouse-batch-create-dialog">
      <div className="flex items-center gap-2 mb-3">
        <Layers className="w-4 h-4 text-purple-600" />
        <h4 className="font-semibold text-sm text-purple-900 dark:text-purple-100">Batch-Erstellung</h4>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
        Automatische Erstellung von Lagerplätzen im Format: <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded text-purple-600 font-mono">Prefix-Aisle-Shelf-Level</code>
      </p>

      <form className="grid grid-cols-2 gap-3" onSubmit={(event) => void onSubmit(event)}>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Prefix</label>
          <input
            className="w-full px-2 py-1.5 text-sm border rounded-md dark:bg-zinc-900 dark:border-zinc-700"
            value={batchPrefix}
            onChange={(event) => onBatchPrefixChange(event.target.value)}
            aria-label="Prefix"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Gänge (Aisle)</label>
          <input
            className="w-full px-2 py-1.5 text-sm border rounded-md dark:bg-zinc-900 dark:border-zinc-700"
            type="number"
            min={1}
            value={aisleTo}
            onChange={(event) => onAisleToChange(Number(event.target.value))}
            aria-label="Aisle To"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Regale (Shelf)</label>
          <input
            className="w-full px-2 py-1.5 text-sm border rounded-md dark:bg-zinc-900 dark:border-zinc-700"
            type="number"
            min={1}
            value={shelfTo}
            onChange={(event) => onShelfToChange(Number(event.target.value))}
            aria-label="Shelf To"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Ebenen (Level)</label>
          <input
            className="w-full px-2 py-1.5 text-sm border rounded-md dark:bg-zinc-900 dark:border-zinc-700"
            type="number"
            min={1}
            value={levelTo}
            onChange={(event) => onLevelToChange(Number(event.target.value))}
            aria-label="Level To"
          />
        </div>
        <div className="col-span-2 flex justify-end gap-2 mt-2">
          <button
            className="px-3 py-1.5 text-xs font-medium bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 transition-colors w-full"
            type="submit"
            disabled={isPending}
          >
            {isPending ? "Wird erstellt..." : "Batch anlegen"}
          </button>
        </div>
      </form>
    </div>
  );
}
