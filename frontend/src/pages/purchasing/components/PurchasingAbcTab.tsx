import { RefreshCw } from "lucide-react";

import type { AbcClassification } from "../../../types";

export type PurchasingAbcTabProps = {
  items: AbcClassification[];
  loading: boolean;
  recomputePending: boolean;
  onRecompute: () => void;
};

export function PurchasingAbcTab({ items, loading, recomputePending, onRecompute }: PurchasingAbcTabProps) {
  return (
    <div
      className="bg-[var(--panel)] border border-[var(--line)] rounded-xl shadow-sm overflow-hidden"
      data-testid="purchasing-abc-tab"
    >
      <div className="p-5 border-b border-[var(--line)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--panel-soft)]">
        <div>
          <h3 className="text-lg font-semibold text-[var(--ink)]">ABC-Klassifizierung</h3>
          <p className="text-sm text-[var(--muted)]">Analyse basierend auf Outbound-Mengen.</p>
        </div>
        <button
          onClick={onRecompute}
          disabled={recomputePending}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--panel)] border border-[var(--line)] hover:bg-[var(--bg)] text-[var(--ink)] text-sm font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50"
          data-testid="abc-recompute-btn"
        >
          <RefreshCw className={`w-4 h-4 ${recomputePending ? "animate-spin" : ""}`} />
          Neu berechnen
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm" data-testid="abc-table">
          <thead className="bg-[var(--bg)] text-[var(--muted)] font-medium border-b border-[var(--line)]">
            <tr>
              <th className="px-5 py-3 w-20">Rank</th>
              <th className="px-5 py-3">Produkt</th>
              <th className="px-5 py-3 text-right">Outbound</th>
              <th className="px-5 py-3 text-right">Anteil</th>
              <th className="px-5 py-3 text-right">Kumulativ</th>
              <th className="px-5 py-3 w-24 text-center">Klasse</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[var(--line)]">
            {items.map((row) => (
              <tr key={row.id} className="bg-[var(--panel)] hover:bg-[var(--panel-soft)] transition-colors">
                <td className="px-5 py-3 text-[var(--muted)]">#{row.rank}</td>
                <td className="px-5 py-3 font-medium text-[var(--ink)]">{row.product_number}</td>
                <td className="px-5 py-3 text-right text-[var(--ink)]">{row.outbound_quantity}</td>
                <td className="px-5 py-3 text-right text-[var(--muted)]">{row.share_percent}%</td>
                <td className="px-5 py-3 text-right text-[var(--muted)]">{row.cumulative_share_percent}%</td>
                <td className="px-5 py-3 text-center">
                  <span
                    className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-xs ${
                      row.category === "A"
                        ? "bg-green-100 text-green-700 border border-green-200"
                        : row.category === "B"
                          ? "bg-yellow-100 text-yellow-800 border border-yellow-200"
                          : "bg-gray-100 text-gray-700 border border-gray-200"
                    }`}
                  >
                    {row.category}
                  </span>
                </td>
              </tr>
            ))}

            {!loading && items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-[var(--muted)]">
                  Keine Daten vorhanden. Bitte Berechnung starten.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
