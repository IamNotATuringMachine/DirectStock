import type { FormEvent } from "react";
import { Package, Truck } from "lucide-react";

import type { BinLocation, Product, ReturnOrder, ReturnOrderItem, Warehouse, WarehouseZone } from "../../../types";
import { decisionLabels, type ReturnDecision, type ReturnRepairMode } from "../model";

function labelForDecision(decision: string | null): string {
  if (!decision) {
    return "-";
  }
  if (decision in decisionLabels) {
    return decisionLabels[decision as ReturnDecision];
  }
  return decision;
}

export type ReturnsItemsPanelProps = {
  selectedOrder: ReturnOrder | null;
  onCreateItem: (event: FormEvent) => void;
  productId: string;
  onProductIdChange: (value: string) => void;
  products: Product[];
  quantity: string;
  onQuantityChange: (value: string) => void;
  decision: ReturnDecision;
  onDecisionChange: (value: ReturnDecision) => void;
  repairMode: ReturnRepairMode;
  onRepairModeChange: (value: ReturnRepairMode) => void;
  externalPartner: string;
  onExternalPartnerChange: (value: string) => void;
  selectedWarehouseId: number | null;
  onSelectedWarehouseIdChange: (value: number | null) => void;
  selectedZoneId: number | null;
  onSelectedZoneIdChange: (value: number | null) => void;
  selectedBinId: string;
  onSelectedBinIdChange: (value: string) => void;
  warehouses: Warehouse[];
  zones: WarehouseZone[];
  bins: BinLocation[];
  createItemPending: boolean;
  items: ReturnOrderItem[];
  onDispatchExternal: (itemId: number) => void;
  dispatchExternalPending: boolean;
  onReceiveExternal: (itemId: number) => void;
  receiveExternalPending: boolean;
};

export function ReturnsItemsPanel({
  selectedOrder,
  onCreateItem,
  productId,
  onProductIdChange,
  products,
  quantity,
  onQuantityChange,
  decision,
  onDecisionChange,
  repairMode,
  onRepairModeChange,
  externalPartner,
  onExternalPartnerChange,
  selectedWarehouseId,
  onSelectedWarehouseIdChange,
  selectedZoneId,
  onSelectedZoneIdChange,
  selectedBinId,
  onSelectedBinIdChange,
  warehouses,
  zones,
  bins,
  createItemPending,
  items,
  onDispatchExternal,
  dispatchExternalPending,
  onReceiveExternal,
  receiveExternalPending,
}: ReturnsItemsPanelProps) {
  return (
    <div className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm flex flex-col h-[calc(100vh-200px)] min-h-[500px]">
      <div className="p-4 border-b border-[var(--line)] bg-[var(--panel-soft)]">
        <h3 className="section-title flex items-center gap-2">
          <Package className="w-4 h-4 text-[var(--muted)]" />
          Positionen
        </h3>
      </div>

      <div className="p-4 flex-1 overflow-hidden flex flex-col">
        {selectedOrder ? (
          <>
            <form
              className="grid grid-cols-1 gap-4 mb-6 p-4 bg-[var(--panel-soft)] rounded-[var(--radius-md)] border border-[var(--line)]"
              onSubmit={onCreateItem}
              data-testid="return-order-item-form"
            >
              <div className="grid grid-cols-1 gap-2">
                <label className="text-sm font-medium text-[var(--muted)]">Produkt</label>
                <select
                  className="input w-full appearance-none"
                  value={productId}
                  onChange={(event) => onProductIdChange(event.target.value)}
                  data-testid="return-order-item-product-select"
                  required
                >
                  <option value="">Produkt wählen...</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.product_number} - {product.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid grid-cols-1 gap-2">
                  <label className="text-sm font-medium text-[var(--muted)]">Menge</label>
                  <input
                    className="input w-full"
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={quantity}
                    onChange={(event) => onQuantityChange(event.target.value)}
                    data-testid="return-order-item-quantity-input"
                    required
                  />
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <label className="text-sm font-medium text-[var(--muted)]">Entscheidung</label>
                  <select
                    className="input w-full appearance-none"
                    value={decision}
                    onChange={(event) => onDecisionChange(event.target.value as ReturnDecision)}
                    data-testid="return-order-item-decision-select"
                  >
                    {Object.entries(decisionLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {decision === "repair" ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid grid-cols-1 gap-2">
                    <label className="text-sm font-medium text-[var(--muted)]">Reparaturmodus</label>
                    <select
                      className="input w-full appearance-none"
                      value={repairMode}
                      onChange={(event) => onRepairModeChange(event.target.value as ReturnRepairMode)}
                      data-testid="return-order-item-repair-mode-select"
                    >
                      <option value="internal">Intern</option>
                      <option value="external">Extern</option>
                    </select>
                  </div>

                  {repairMode === "external" ? (
                    <div className="grid grid-cols-1 gap-2">
                      <label className="text-sm font-medium text-[var(--muted)]">Externer Partner</label>
                      <input
                        className="input w-full"
                        value={externalPartner}
                        onChange={(event) => onExternalPartnerChange(event.target.value)}
                        data-testid="return-order-item-external-partner-input"
                        placeholder="z.B. Spanien Repair"
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="grid grid-cols-3 gap-3">
                <select
                  className="input w-full"
                  value={selectedWarehouseId ?? ""}
                  onChange={(event) => {
                    onSelectedWarehouseIdChange(Number(event.target.value));
                    onSelectedZoneIdChange(null);
                    onSelectedBinIdChange("");
                  }}
                  data-testid="return-order-target-warehouse-select"
                >
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.code}
                    </option>
                  ))}
                </select>
                <select
                  className="input w-full"
                  value={selectedZoneId ?? ""}
                  onChange={(event) => {
                    onSelectedZoneIdChange(Number(event.target.value));
                    onSelectedBinIdChange("");
                  }}
                  data-testid="return-order-target-zone-select"
                >
                  <option value="">Zone...</option>
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.code}
                    </option>
                  ))}
                </select>
                <select
                  className="input w-full"
                  value={selectedBinId}
                  onChange={(event) => onSelectedBinIdChange(event.target.value)}
                  data-testid="return-order-target-bin-select"
                >
                  <option value="">Ziel-Bin...</option>
                  {bins.map((bin) => (
                    <option key={bin.id} value={bin.id}>
                      {bin.code}
                    </option>
                  ))}
                </select>
              </div>

              <button
                className="btn w-full justify-center"
                type="submit"
                disabled={createItemPending}
                data-testid="return-order-item-add-btn"
              >
                Position hinzufügen
              </button>
            </form>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1" data-testid="return-order-items-list">
              {items.length === 0 ? (
                <div className="text-center text-[var(--muted)] py-8 italic text-sm">Noch keine Positionen erfasst.</div>
              ) : (
                items.map((item) => (
                  <div
                    className="p-3 border border-[var(--line)] rounded-[var(--radius-sm)] bg-[var(--bg)] hover:border-[var(--line-strong)] transition-colors min-w-0"
                    key={item.id}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <strong className="text-[var(--ink)] text-sm font-semibold truncate block break-words min-w-0">
                        #{item.product_id}
                      </strong>
                      <span className="text-xs font-mono bg-[var(--panel-soft)] px-1.5 py-0.5 rounded border border-[var(--line)] text-[var(--muted)]">
                        {item.quantity} {item.unit}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--muted)] flex items-center gap-1.5 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]"></span>
                      {labelForDecision(item.decision)}
                    </div>
                    {item.repair_mode ? (
                      <div className="mt-1 text-xs text-[var(--muted)]">Reparaturmodus: {item.repair_mode}</div>
                    ) : null}
                    {item.external_status ? (
                      <div className="mt-1 text-xs text-[var(--muted)]" data-testid={`return-order-item-external-status-${item.id}`}>
                        Externer Status: {item.external_status}
                      </div>
                    ) : null}
                    {item.decision === "repair" && item.repair_mode === "external" ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.external_status === "waiting_external_provider" ? (
                          <button
                            type="button"
                            className="btn btn-ghost text-xs"
                            onClick={() => onDispatchExternal(item.id)}
                            disabled={dispatchExternalPending}
                            data-testid={`return-order-item-dispatch-external-${item.id}`}
                          >
                            An externen Dienstleister senden
                          </button>
                        ) : null}
                        {item.external_status === "at_external_provider" ? (
                          <button
                            type="button"
                            className="btn btn-ghost text-xs"
                            onClick={() => onReceiveExternal(item.id)}
                            disabled={receiveExternalPending || !selectedBinId}
                            data-testid={`return-order-item-receive-external-${item.id}`}
                          >
                            Von extern erhalten
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-[var(--muted)] p-6 text-center">
            <Truck className="w-12 h-12 mb-3 opacity-20" />
            <p>Wählen Sie einen Auftrag aus, um Positionen zu bearbeiten.</p>
          </div>
        )}
      </div>
    </div>
  );
}
