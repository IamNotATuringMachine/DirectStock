import type { BinLocation } from "../../types";

type QRPrintDialogProps = {
  bins: BinLocation[];
  downloadingPdf: boolean;
  onDownloadZonePdf: () => Promise<void> | void;
};

export default function QRPrintDialog({ bins, downloadingPdf, onDownloadZonePdf }: QRPrintDialogProps) {
  return (
    <div className="subpanel" data-testid="warehouse-qr-print-dialog">
      <h4>QR-Export</h4>
      <p className="panel-subtitle">Etiketten-PDF (2x5 pro A4) für alle Lagerplätze der aktiven Zone.</p>
      <button
        className="btn"
        onClick={() => void onDownloadZonePdf()}
        disabled={downloadingPdf || bins.length === 0}
        data-testid="warehouse-zone-qr-pdf"
      >
        {downloadingPdf ? "PDF wird erstellt..." : "QR-PDF für Zone"}
      </button>
    </div>
  );
}
