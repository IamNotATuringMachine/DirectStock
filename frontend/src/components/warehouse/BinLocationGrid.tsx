import { QrCode, Trash2 } from "lucide-react";

import type { BinLocation } from "../../types";

type BinLocationGridProps = {
  bins: BinLocation[];
  canWrite: boolean;
  downloadingBinId: number | null;
  deletingBinId: number | null;
  onDownloadQr: (bin: BinLocation) => Promise<void> | void;
  onDeleteBin: (bin: BinLocation) => Promise<void> | void;
};

export default function BinLocationGrid({
  bins,
  canWrite,
  downloadingBinId,
  deletingBinId,
  onDownloadQr,
  onDeleteBin,
}: BinLocationGridProps) {
  if (bins.length === 0) {
    return <p className="text-sm text-zinc-500 text-center py-8">Keine Lagerplätze in dieser Zone vorhanden.</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3" data-testid="warehouse-bin-grid">
      {bins.map((bin) => (
        <div
          key={bin.id}
          className={`relative group p-3 rounded-lg border flex flex-col gap-2 transition-all min-w-0 ${
            bin.is_occupied
              ? "bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800/50"
              : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <div className="font-mono font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate" title={bin.code}>
                {bin.code}
              </div>
              <div
                className="text-[10px] text-zinc-400 font-mono break-all leading-tight"
                title={bin.qr_code_data ?? undefined}
              >
                {bin.qr_code_data}
              </div>
            </div>
            <div
              className={`w-2 h-2 rounded-full shrink-0 ml-2 ${
                bin.is_occupied ? "bg-amber-500 ring-2 ring-amber-100 dark:ring-amber-900" : "bg-emerald-500 ring-2 ring-emerald-100 dark:ring-emerald-900"
              }`}
            />
          </div>

          <div className="flex items-center justify-between mt-1">
            <span
              className={`text-xs font-medium min-w-0 truncate ${
                bin.is_occupied ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"
              }`}
              title={bin.is_occupied ? `Belegt (${bin.occupied_quantity})` : "Leer"}
            >
              {bin.is_occupied ? `Belegt (${bin.occupied_quantity})` : "Leer"}
            </span>

            <div className="flex items-center gap-1">
              <button
                onClick={() => void onDownloadQr(bin)}
                disabled={downloadingBinId === bin.id}
                className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                title="QR-Code herunterladen"
                data-testid={`warehouse-bin-qr-${bin.id}`}
              >
                {downloadingBinId === bin.id ? (
                  <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <QrCode className="w-4 h-4" />
                )}
              </button>
              {canWrite && (
                <button
                  onClick={() => void onDeleteBin(bin)}
                  disabled={deletingBinId === bin.id}
                  className="text-zinc-400 hover:text-rose-600 dark:hover:text-rose-300 p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-60"
                  title="Lagerplatz löschen"
                  data-testid={`warehouse-bin-delete-${bin.id}`}
                >
                  {deletingBinId === bin.id ? (
                    <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
