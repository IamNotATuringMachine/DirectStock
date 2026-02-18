import { Download, RefreshCw } from "lucide-react";

type ReportsHeaderProps = {
  isDownloading: boolean;
  onDownloadCsv: () => Promise<void>;
};

export function ReportsHeader({ isDownloading, onDownloadCsv }: ReportsHeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="page-title">Berichte & Analysen</h1>
        <p className="section-subtitle mt-1">
          Umfassende Einblicke in Bestände, Bewegungen und Lagerleistung.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => void onDownloadCsv()}
          disabled={isDownloading}
          className="btn btn-primary shadow-sm"
          data-testid="reports-download-csv-btn"
        >
          {isDownloading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          CSV Export
        </button>
      </div>
    </div>
  );
}
