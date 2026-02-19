import { CheckCircle, RefreshCw, XCircle } from "lucide-react";

import type { PurchaseRecommendation } from "../../../types";

export type PurchasingRecommendationsTabProps = {
  items: PurchaseRecommendation[];
  loading: boolean;
  generatePending: boolean;
  convertPending: boolean;
  dismissPending: boolean;
  onGenerate: () => void;
  onConvert: (recommendationId: number) => void;
  onDismiss: (recommendationId: number) => void;
};

export function PurchasingRecommendationsTab({
  items,
  loading,
  generatePending,
  convertPending,
  dismissPending,
  onGenerate,
  onConvert,
  onDismiss,
}: PurchasingRecommendationsTabProps) {
  return (
    <div
      className="bg-[var(--panel)] border border-[var(--line)] rounded-xl shadow-sm overflow-hidden"
      data-testid="purchasing-recommendations-tab"
    >
      <div className="p-5 border-b border-[var(--line)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--panel-soft)]">
        <div>
          <h3 className="text-lg font-semibold text-[var(--ink)]">Bestellvorschläge</h3>
          <p className="text-sm text-[var(--muted)]">
            Automatisch generierte Vorschläge basierend auf Bestandsdefiziten.
          </p>
        </div>
        <button
          onClick={onGenerate}
          disabled={generatePending}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white text-sm font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50"
          data-testid="purchase-recommendations-generate-btn"
        >
          <RefreshCw className={`w-4 h-4 ${generatePending ? "animate-spin" : ""}`} />
          Vorschläge generieren
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm" data-testid="purchase-recommendations-table">
          <thead className="bg-[var(--bg)] text-[var(--muted)] font-medium border-b border-[var(--line)]">
            <tr>
              <th className="px-5 py-3 w-16">ID</th>
              <th className="px-5 py-3">Produkt ID</th>
              <th className="px-5 py-3 text-right">Defizit</th>
              <th className="px-5 py-3 text-right">Empfehlung</th>
              <th className="px-5 py-3 w-24">Status</th>
              <th className="px-5 py-3 text-right w-48">Aktion</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[var(--line)]">
            {items.map((item) => (
              <tr key={item.id} className="bg-[var(--panel)] hover:bg-[var(--panel-soft)] transition-colors">
                <td className="px-5 py-3 text-[var(--muted)]">#{item.id}</td>
                <td className="px-5 py-3 font-medium text-[var(--ink)]">{item.product_id}</td>
                <td className="px-5 py-3 text-right text-red-600 font-medium">{item.deficit_quantity}</td>
                <td className="px-5 py-3 text-right text-[var(--accent-strong)] font-bold">
                  {item.recommended_quantity}
                </td>
                <td className="px-5 py-3">
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                    {item.status}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => onConvert(item.id)}
                      disabled={convertPending || item.status !== "open"}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--panel)] border border-[var(--line)] hover:bg-[var(--bg)] text-[var(--ink)] text-xs font-medium rounded transition-colors disabled:opacity-50"
                      title="In Bestellung umwandeln"
                      data-testid={`purchase-recommendation-convert-${item.id}`}
                    >
                      <CheckCircle className="w-3.5 h-3.5 text-[var(--accent)]" />
                      In PO
                    </button>
                    <button
                      onClick={() => onDismiss(item.id)}
                      disabled={dismissPending || item.status !== "open"}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--panel)] border border-[var(--line)] hover:bg-red-50 text-[var(--ink)] hover:text-red-700 text-xs font-medium rounded transition-colors disabled:opacity-50"
                      title="Verwerfen"
                      data-testid={`purchase-recommendation-dismiss-${item.id}`}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Dismiss
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {!loading && items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-[var(--muted)]">
                  Keine offenen Bestellvorschläge.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
