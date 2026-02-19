import { Calculator, Hash, Search } from "lucide-react";

import type { InventoryCountItem } from "../../../types";

export type InventoryCountQuickCapturePanelProps = {
  scanBin: string;
  onScanBinChange: (value: string) => void;
  scanProduct: string;
  onScanProductChange: (value: string) => void;
  focusedQuickItem: InventoryCountItem | null;
  quickQuantity: string;
  onQuickQuantityChange: (value: string) => void;
  onSaveQuickCount: () => void;
  countActionsDisabled: boolean;
};

export function InventoryCountQuickCapturePanel({
  scanBin,
  onScanBinChange,
  scanProduct,
  onScanProductChange,
  focusedQuickItem,
  quickQuantity,
  onQuickQuantityChange,
  onSaveQuickCount,
  countActionsDisabled,
}: InventoryCountQuickCapturePanelProps) {
  return (
    <article className="subpanel bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 flex items-center gap-2">
        <h3 className="section-title text-zinc-900 dark:text-zinc-100">3. Scan-/Schnellerfassung</h3>
      </div>

      <div className="p-4 space-y-6 flex-1">
        <div className="products-toolbar grid gap-4">
          <div className="relative">
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              className="input input-leading-icon w-full h-10 pl-9 pr-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              placeholder="Bin scannen oder eingeben"
              value={scanBin}
              onChange={(event) => onScanBinChange(event.target.value)}
              data-testid="inventory-count-scan-bin-input"
            />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              className="input input-leading-icon w-full h-10 pl-9 pr-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              placeholder="Artikelnummer scannen oder eingeben"
              value={scanProduct}
              onChange={(event) => onScanProductChange(event.target.value)}
              data-testid="inventory-count-scan-product-input"
            />
          </div>
        </div>

        {focusedQuickItem ? (
          <div
            className="workflow-block p-4 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 space-y-4"
            data-testid="inventory-count-quick-capture"
          >
            <div>
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Treffer</span>
              <p className="mt-1 text-zinc-800 dark:text-zinc-200">
                <strong className="text-blue-700 dark:text-blue-300">{focusedQuickItem.bin_code}</strong>
                <span className="mx-2 text-zinc-400">|</span>
                {focusedQuickItem.product_number}
                <br />
                <span className="text-sm text-zinc-500 dark:text-zinc-400">{focusedQuickItem.product_name}</span>
              </p>
            </div>

            <div className="actions-cell grid grid-cols-2 gap-2">
              <div className="relative">
                <Calculator className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  className="input input-leading-icon w-full h-10 pl-9 pr-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-mono font-medium"
                  type="number"
                  min="0"
                  step="0.001"
                  value={quickQuantity}
                  onChange={(event) => onQuickQuantityChange(event.target.value)}
                  disabled={countActionsDisabled}
                  data-testid="inventory-count-quick-quantity-input"
                />
              </div>
              <button
                className="btn h-10 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={onSaveQuickCount}
                disabled={countActionsDisabled}
                data-testid="inventory-count-quick-save-btn"
              >
                Speichern
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/30 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700">
            <Search className="w-8 h-8 opacity-20 mx-auto mb-2" />
            <p className="text-sm">Kein passender Treffer für aktuelle Scan-Filter.</p>
          </div>
        )}
      </div>
    </article>
  );
}
