import type { FormEvent } from "react";
import { ArrowRight, CheckCircle, Plus, ShoppingCart } from "lucide-react";

import type { Product, PurchaseOrder, PurchaseOrderItem } from "../../../types";

export type PurchasingOrderDetailsProps = {
  selectedOrder: PurchaseOrder | null;
  allowedTransitions: PurchaseOrder["status"][];
  onStatusTransition: (orderId: number, nextStatus: PurchaseOrder["status"]) => void;
  statusMutationPending: boolean;
  onAddItem: (event: FormEvent) => void;
  productId: string;
  onProductIdChange: (value: string) => void;
  products: Product[];
  orderedQuantity: string;
  onOrderedQuantityChange: (value: string) => void;
  unitPrice: string;
  onUnitPriceChange: (value: string) => void;
  createItemPending: boolean;
  orderItems: PurchaseOrderItem[];
  orderItemsLoading: boolean;
};

export function PurchasingOrderDetails({
  selectedOrder,
  allowedTransitions,
  onStatusTransition,
  statusMutationPending,
  onAddItem,
  productId,
  onProductIdChange,
  products,
  orderedQuantity,
  onOrderedQuantityChange,
  unitPrice,
  onUnitPriceChange,
  createItemPending,
  orderItems,
  orderItemsLoading,
}: PurchasingOrderDetailsProps) {
  if (!selectedOrder) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-12 text-center border border-dashed border-[var(--line-strong)] rounded-xl bg-[var(--panel)]/50">
        <div className="bg-[var(--panel-strong)] p-4 rounded-full mb-4">
          <ShoppingCart className="w-8 h-8 text-[var(--muted)]" />
        </div>
        <h3 className="text-lg font-medium text-[var(--ink)] mb-1">Keine Bestellung ausgewählt</h3>
        <p className="text-[var(--muted)] max-w-sm">
          Wählen Sie eine Bestellung aus der Liste links aus oder erstellen Sie eine neue, um Details zu sehen.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-[var(--panel)] border border-[var(--line)] rounded-xl shadow-sm p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Bestellung</span>
              <span
                className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                  selectedOrder.status === "completed"
                    ? "bg-green-100 text-green-700"
                    : selectedOrder.status === "cancelled"
                      ? "bg-red-100 text-red-700"
                      : "bg-blue-100 text-blue-700"
                }`}
              >
                {selectedOrder.status}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-[var(--ink)]" data-testid="purchase-order-selected-status">
              {selectedOrder.order_number}
            </h2>
          </div>

          <div className="flex flex-wrap gap-2">
            {allowedTransitions.length > 0 ? (
              allowedTransitions.map((statusName) => (
                <button
                  key={statusName}
                  onClick={() => onStatusTransition(selectedOrder.id, statusName)}
                  disabled={statusMutationPending}
                  className="h-9 px-4 flex items-center gap-2 bg-[var(--panel-soft)] hover:bg-[var(--line)] border border-[var(--line)] text-[var(--ink)] text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  data-testid={`purchase-order-status-${statusName}`}
                >
                  <ArrowRight className="w-4 h-4" />
                  Mark as {statusName}
                </button>
              ))
            ) : (
              <span className="text-sm text-[var(--muted)] italic flex items-center gap-1">
                <CheckCircle className="w-4 h-4" />
                Endstatus erreicht
              </span>
            )}
          </div>
        </div>

        {selectedOrder.status === "draft" ? (
          <div className="bg-[var(--bg)]/50 rounded-lg p-4 border border-[var(--line)] mb-6">
            <h4 className="text-sm font-semibold text-[var(--ink)] mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4" /> Position hinzufügen
            </h4>
            <form
              onSubmit={onAddItem}
              className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end"
              data-testid="purchase-order-item-form"
            >
              <div className="md:col-span-6">
                <label className="block text-xs font-medium text-[var(--muted)] mb-1">Produkt</label>
                <select
                  className="w-full h-9 px-3 bg-[var(--panel)] border border-[var(--line)] rounded-lg text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]"
                  value={productId}
                  onChange={(event) => onProductIdChange(event.target.value)}
                  data-testid="purchase-order-item-product-select"
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

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-[var(--muted)] mb-1">Menge</label>
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  className="w-full h-9 px-3 bg-[var(--panel)] border border-[var(--line)] rounded-lg text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]"
                  value={orderedQuantity}
                  onChange={(event) => onOrderedQuantityChange(event.target.value)}
                  data-testid="purchase-order-item-quantity-input"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-[var(--muted)] mb-1">Preis (Optional)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full h-9 px-3 bg-[var(--panel)] border border-[var(--line)] rounded-lg text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]"
                  value={unitPrice}
                  onChange={(event) => onUnitPriceChange(event.target.value)}
                  placeholder="0.00"
                  data-testid="purchase-order-item-price-input"
                />
              </div>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={createItemPending}
                  className="w-full h-9 flex items-center justify-center gap-2 bg-[var(--ink)] hover:bg-[var(--ink)]/90 text-[var(--bg)] text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  data-testid="purchase-order-item-add-btn"
                >
                  Hinzufügen
                </button>
              </div>
            </form>
          </div>
        ) : null}

        <div className="overflow-x-auto border border-[var(--line)] rounded-lg">
          <table className="w-full text-left text-sm" data-testid="purchase-order-items-list">
            <thead className="bg-[var(--panel-strong)] text-[var(--muted)] font-medium">
              <tr>
                <th className="px-4 py-3">Produkt ID</th>
                <th className="px-4 py-3 text-right">Menge</th>
                <th className="px-4 py-3">Einheit</th>
                <th className="px-4 py-3 text-right">Preis</th>
                <th className="px-4 py-3 text-right">Summe</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--line)]">
              {orderItems.map((item) => (
                <tr key={item.id} className="bg-[var(--panel)] hover:bg-[var(--panel-soft)] transition-colors">
                  <td className="px-4 py-3 font-medium text-[var(--ink)]">#{item.product_id}</td>
                  <td className="px-4 py-3 text-right text-[var(--ink)]">{item.ordered_quantity}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{item.unit}</td>
                  <td className="px-4 py-3 text-right text-[var(--muted)]">
                    {item.unit_price ? Number(item.unit_price).toFixed(2) : "-"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-[var(--ink)]">
                    {item.unit_price ? (Number(item.unit_price) * Number(item.ordered_quantity)).toFixed(2) : "-"}
                  </td>
                </tr>
              ))}

              {!orderItemsLoading && orderItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[var(--muted)]">
                    Keine Positionen in dieser Bestellung.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
