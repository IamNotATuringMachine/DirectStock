import { AlertCircle, BarChart3, ClipboardList, Save } from "lucide-react";

import type { InventoryCountItem } from "../../../types";

export type InventoryCountItemsTableProps = {
  filteredItems: InventoryCountItem[];
  rowCounts: Record<number, string>;
  onRowCountChange: (itemId: number, value: string) => void;
  onSaveRowCount: (item: InventoryCountItem) => void;
  countActionsDisabled: boolean;
  itemsLoading: boolean;
};

export function InventoryCountItemsTable({
  filteredItems,
  rowCounts,
  onRowCountChange,
  onSaveRowCount,
  countActionsDisabled,
  itemsLoading,
}: InventoryCountItemsTableProps) {
  return (
    <article className="subpanel bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 flex items-center gap-2">
        <div className="p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-md text-zinc-700 dark:text-zinc-300">
          <BarChart3 className="w-4 h-4" />
        </div>
        <h3 className="section-title text-zinc-900 dark:text-zinc-100">4. Zählpositionen</h3>
      </div>

      <div className="table-wrap overflow-x-auto">
        <table className="products-table w-full text-left" data-testid="inventory-count-items-table">
          <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-700">
            <tr>
              <th className="table-head-standard px-6 py-4 text-zinc-500 dark:text-zinc-400">Bin</th>
              <th className="table-head-standard px-6 py-4 text-zinc-500 dark:text-zinc-400">Artikel</th>
              <th className="table-head-standard px-6 py-4 text-zinc-500 dark:text-zinc-400 text-right">Soll</th>
              <th className="table-head-standard px-6 py-4 text-zinc-500 dark:text-zinc-400 text-right w-32">Ist</th>
              <th className="table-head-standard px-6 py-4 text-zinc-500 dark:text-zinc-400 text-right">Differenz</th>
              <th className="table-head-standard px-6 py-4 text-zinc-500 dark:text-zinc-400 text-center">Nachzählung</th>
              <th className="table-head-standard px-6 py-4 text-zinc-500 dark:text-zinc-400 text-right">Aktion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
            {filteredItems.map((item) => (
              <tr
                key={item.id}
                data-testid={`inventory-count-item-row-${item.id}`}
                className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <td className="px-6 py-4 text-sm font-medium text-zinc-900 dark:text-zinc-100 font-mono">{item.bin_code}</td>
                <td className="px-6 py-4 text-sm text-zinc-700 dark:text-zinc-300">
                  <span className="block font-medium text-zinc-900 dark:text-zinc-100">{item.product_number}</span>
                  <small className="text-zinc-500 dark:text-zinc-400">{item.product_name}</small>
                </td>
                <td className="px-6 py-4 text-sm text-zinc-500 dark:text-zinc-400 text-right font-mono" data-testid={`inventory-count-item-snapshot-${item.id}`}>
                  {item.snapshot_quantity}
                </td>
                <td className="px-6 py-4 text-right">
                  <input
                    className="input h-9 w-24 text-right px-2 rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-mono"
                    type="number"
                    min="0"
                    step="0.001"
                    value={rowCounts[item.id] ?? item.counted_quantity ?? ""}
                    onChange={(event) => onRowCountChange(item.id, event.target.value)}
                    disabled={countActionsDisabled}
                    data-testid={`inventory-count-item-qty-${item.id}`}
                  />
                </td>
                <td className="px-6 py-4 text-sm text-right font-mono" data-testid={`inventory-count-item-diff-${item.id}`}>
                  <span
                    className={`${
                      Number(item.difference_quantity) < 0
                        ? "text-rose-600 font-bold"
                        : Number(item.difference_quantity) > 0
                          ? "text-emerald-600 font-bold"
                          : "text-zinc-400"
                    }`}
                  >
                    {item.difference_quantity && Number(item.difference_quantity) > 0 ? "+" : ""}
                    {item.difference_quantity ?? "-"}
                  </span>
                </td>
                <td className="px-6 py-4 text-center" data-testid={`inventory-count-item-recount-${item.id}`}>
                  {item.recount_required ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
                      <AlertCircle className="w-3 h-3 mr-1" /> Ja
                    </span>
                  ) : (
                    <span className="text-zinc-400 text-sm">-</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    className="btn h-8 px-3 rounded-md bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                    onClick={() => onSaveRowCount(item)}
                    disabled={countActionsDisabled}
                    data-testid={`inventory-count-item-save-${item.id}`}
                  >
                    <Save className="w-3.5 h-3.5" />
                    Speichern
                  </button>
                </td>
              </tr>
            ))}
            {filteredItems.length === 0 && !itemsLoading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-zinc-500 dark:text-zinc-400">
                  <div className="flex flex-col items-center gap-2">
                    <ClipboardList className="w-8 h-8 opacity-20" />
                    <p>Keine Inventurpositionen verfügbar.</p>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </article>
  );
}
