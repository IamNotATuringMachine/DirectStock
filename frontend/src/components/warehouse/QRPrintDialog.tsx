import { FileText, Printer } from "lucide-react";

import type { BinLocation } from "../../types";

type QRPrintDialogProps = {
  bins: BinLocation[];
  downloadingPdf: boolean;
  onDownloadZonePdf: () => Promise<void> | void;
};

export default function QRPrintDialog({ bins, downloadingPdf, onDownloadZonePdf }: QRPrintDialogProps) {
  if (bins.length === 0) {
    return null;
  }

  return (
    <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg flex items-center justify-between" data-testid="warehouse-qr-print-dialog">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
          <Printer className="w-4 h-4" />
        </div>
        <div>
          <h4 className="font-medium text-sm text-zinc-900 dark:text-zinc-100">Etiketten drucken</h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">PDF-Export (2x5/A4) für {bins.length} Plätze</p>
        </div>
      </div>
      <button
        onClick={() => void onDownloadZonePdf()}
        disabled={downloadingPdf || bins.length === 0}
        className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 p-2 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        title="PDF herunterladen"
        data-testid="warehouse-zone-qr-pdf"
      >
        {downloadingPdf ? (
          <div className="w-4 h-4 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          <FileText className="w-5 h-5" />
        )}
      </button>
    </div>
  );
}
