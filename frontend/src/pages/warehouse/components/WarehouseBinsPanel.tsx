import type { FormEvent } from "react";
import { Map as MapIcon, Plus } from "lucide-react";

import BinBatchCreateDialog from "../../../components/warehouse/BinBatchCreateDialog";
import BinLocationGrid from "../../../components/warehouse/BinLocationGrid";
import QRPrintDialog from "../../../components/warehouse/QRPrintDialog";
import type { BinLocation } from "../../../types";

export type WarehouseBinsPanelProps = {
  canWrite: boolean;
  selectedZoneId: number | null;
  isCreatingBatch: boolean;
  onToggleCreateBatch: () => void;
  onCloseCreateBatch: () => void;
  batchPrefix: string;
  aisleTo: number;
  shelfTo: number;
  levelTo: number;
  batchPending: boolean;
  onBatchPrefixChange: (value: string) => void;
  onAisleToChange: (value: number) => void;
  onShelfToChange: (value: number) => void;
  onLevelToChange: (value: number) => void;
  onCreateBatch: (event: FormEvent) => void;
  bins: BinLocation[];
  downloadingPdf: boolean;
  onDownloadZonePdf: () => void;
  downloadingBinId: number | null;
  deletingBinId: number | null;
  onDownloadBinQr: (bin: BinLocation) => void;
  onDeleteBin: (bin: BinLocation) => void;
};

export function WarehouseBinsPanel({
  canWrite,
  selectedZoneId,
  isCreatingBatch,
  onToggleCreateBatch,
  onCloseCreateBatch,
  batchPrefix,
  aisleTo,
  shelfTo,
  levelTo,
  batchPending,
  onBatchPrefixChange,
  onAisleToChange,
  onShelfToChange,
  onLevelToChange,
  onCreateBatch,
  bins,
  downloadingPdf,
  onDownloadZonePdf,
  downloadingBinId,
  deletingBinId,
  onDownloadBinQr,
  onDeleteBin,
}: WarehouseBinsPanelProps) {
  return (
    <section className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm overflow-hidden flex flex-col h-[calc(100vh-12rem)] min-h-[500px]">
      <div className="p-4 border-b border-[var(--line)] bg-[var(--panel-soft)] flex items-center justify-between sticky top-0 z-10">
        <h3 className="section-title">Lagerplätze</h3>
        <div className="flex items-center gap-1">
          {canWrite && selectedZoneId ? (
            <button
              onClick={onToggleCreateBatch}
              className={`text-sm p-1.5 rounded-md transition-colors ${
                isCreatingBatch
                  ? "bg-purple-100 text-purple-700"
                  : "text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--panel-strong)]"
              }`}
              title="Batch erstellen"
            >
              <Plus className="w-4 h-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4 bg-[var(--panel)]">
        {!selectedZoneId ? (
          <div className="h-full flex flex-col items-center justify-center text-[var(--muted)] p-4 text-center">
            <MapIcon className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-sm">Wähle eine Zone aus, um Lagerplätze zu sehen.</p>
          </div>
        ) : (
          <>
            <BinBatchCreateDialog
              canWrite={canWrite && isCreatingBatch}
              selectedZoneId={selectedZoneId}
              batchPrefix={batchPrefix}
              aisleTo={aisleTo}
              shelfTo={shelfTo}
              levelTo={levelTo}
              isPending={batchPending}
              onBatchPrefixChange={onBatchPrefixChange}
              onAisleToChange={onAisleToChange}
              onShelfToChange={onShelfToChange}
              onLevelToChange={onLevelToChange}
              onSubmit={(event) => {
                onCreateBatch(event);
                onCloseCreateBatch();
              }}
            />

            <QRPrintDialog bins={bins} downloadingPdf={downloadingPdf} onDownloadZonePdf={onDownloadZonePdf} />

            <BinLocationGrid
              bins={bins}
              canWrite={canWrite}
              downloadingBinId={downloadingBinId}
              deletingBinId={deletingBinId}
              onDownloadQr={onDownloadBinQr}
              onDeleteBin={onDeleteBin}
            />
          </>
        )}
      </div>
    </section>
  );
}
