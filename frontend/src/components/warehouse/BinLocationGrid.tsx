import type { BinLocation } from "../../types";

type BinLocationGridProps = {
  bins: BinLocation[];
  downloadingBinId: number | null;
  onDownloadQr: (bin: BinLocation) => Promise<void> | void;
};

export default function BinLocationGrid({ bins, downloadingBinId, onDownloadQr }: BinLocationGridProps) {
  if (bins.length === 0) {
    return <p>Keine Lagerplätze vorhanden.</p>;
  }

  return (
    <div className="bin-grid" data-testid="warehouse-bin-grid">
      {bins.map((bin) => (
        <div
          key={bin.id}
          className={`list-item static-item bin-card ${bin.is_occupied ? "bin-occupied" : "bin-empty"}`}
        >
          <strong>{bin.code}</strong>
          <span>{bin.qr_code_data}</span>
          <span className="bin-occupancy">
            {bin.is_occupied ? `Belegt (${bin.occupied_quantity})` : "Leer"}
          </span>
          <button
            className="btn"
            onClick={() => void onDownloadQr(bin)}
            disabled={downloadingBinId === bin.id}
            data-testid={`warehouse-bin-qr-${bin.id}`}
          >
            {downloadingBinId === bin.id ? "Lade..." : "QR PNG"}
          </button>
        </div>
      ))}
    </div>
  );
}
