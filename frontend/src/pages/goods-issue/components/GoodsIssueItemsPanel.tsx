import type { FormEvent } from "react";
import { Package } from "lucide-react";

import type { BinLocation, GoodsIssue, GoodsIssueItem, Product, Warehouse } from "../../../types";

type GoodsIssueItemsPanelProps = {
  issueItems: GoodsIssueItem[];
  onAddItem: (event: FormEvent) => void;
  selectedProductId: string;
  setSelectedProductId: (value: string) => void;
  products: Product[];
  selectedWarehouseId: number | null;
  setSelectedWarehouseId: (value: number) => void;
  setSelectedZoneId: (value: number | null) => void;
  setSelectedBinId: (value: string) => void;
  warehouses: Warehouse[];
  selectedBinId: string;
  bins: BinLocation[];
  requestedQuantity: string;
  setRequestedQuantity: (value: string) => void;
  selectedIssueId: number | null;
  selectedIssue: GoodsIssue | null;
  createItemPending: boolean;
};

export function GoodsIssueItemsPanel({
  issueItems,
  onAddItem,
  selectedProductId,
  setSelectedProductId,
  products,
  selectedWarehouseId,
  setSelectedWarehouseId,
  setSelectedZoneId,
  setSelectedBinId,
  warehouses,
  selectedBinId,
  bins,
  requestedQuantity,
  setRequestedQuantity,
  selectedIssueId,
  selectedIssue,
  createItemPending,
}: GoodsIssueItemsPanelProps) {
  return (
    <div className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm flex flex-col h-[calc(100vh-200px)] min-h-[500px] overflow-hidden">
      <div className="p-4 border-b border-[var(--line)] bg-[var(--panel-soft)]">
        <h3 className="section-title flex items-center gap-2">
          <Package className="w-4 h-4 text-[var(--muted)]" />
          3. Positionen
        </h3>
      </div>

      <div className="p-4 flex-1 overflow-y-auto space-y-3">
        <div className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-2 px-1">
          Erfasste Artikel
        </div>

        {issueItems.length === 0 ? (
          <div className="text-center text-[var(--muted)] py-8 italic text-sm border border-dashed border-[var(--line)] rounded-[var(--radius-md)]">
            Noch keine Positionen erfasst.
          </div>
        ) : (
          issueItems.map((item) => (
            <div key={item.id} className="p-3 border border-[var(--line)] rounded-[var(--radius-sm)] bg-[var(--bg)] min-w-0 hover:border-[var(--line-strong)] transition-colors">
              <div className="flex justify-between items-start mb-1">
                <strong className="text-[var(--ink)] text-sm font-semibold truncate block break-words min-w-0 pr-2">
                  #{item.product_id}
                </strong>
                <span className="text-xs font-mono bg-[var(--panel-soft)] px-1.5 py-0.5 rounded border border-[var(--line)] text-[var(--ink)] shrink-0">
                  {item.requested_quantity}
                </span>
              </div>
              <div className="text-xs text-[var(--muted)] flex items-center gap-2 truncate">
                <span className="truncate">Quelle: Bin #{item.source_bin_id}</span>
              </div>
            </div>
          ))
        )}

        <div className="mt-8 pt-4 border-t border-[var(--line)]">
          <details className="group">
            <summary className="list-none cursor-pointer flex items-center gap-2 text-xs font-semibold text-[var(--muted)] hover:text-[var(--accent)] transition-colors">
              <span className="transition-transform group-open:rotate-90">▶</span>
              MANUELLE ERFASSUNG (FALLBACK)
            </summary>

            <form className="mt-4 space-y-3 p-3 bg-[var(--panel-soft)] rounded-[var(--radius-md)] border border-[var(--line)]" onSubmit={onAddItem}>
              <select className="input w-full text-sm" value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)} required>
                <option value="">Artikel wählen...</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.product_number} - {product.name}
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-2 gap-2">
                <select
                  className="input w-full text-sm"
                  value={selectedWarehouseId ?? ""}
                  onChange={(event) => {
                    setSelectedWarehouseId(Number(event.target.value));
                    setSelectedZoneId(null);
                    setSelectedBinId("");
                  }}
                >
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.code}
                    </option>
                  ))}
                </select>
                <select className="input w-full text-sm" value={selectedBinId} onChange={(event) => setSelectedBinId(event.target.value)}>
                  <option value="">Lagerplatz...</option>
                  {bins.map((bin) => (
                    <option key={bin.id} value={bin.id}>
                      {bin.code}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <input
                  className="input w-full text-sm"
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={requestedQuantity}
                  onChange={(event) => setRequestedQuantity(event.target.value)}
                  placeholder="Menge"
                  required
                />
                <button className="btn btn-sm shrink-0" type="submit" disabled={!selectedIssueId || selectedIssue?.status !== "draft" || createItemPending}>
                  +
                </button>
              </div>
            </form>
          </details>
        </div>
      </div>
    </div>
  );
}
