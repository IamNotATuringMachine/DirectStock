import type { FormEvent } from "react";
import { FileText, Package, Plus, RefreshCw, Save } from "lucide-react";

import type { PurchaseOrder, Supplier } from "../../../types";

export type PurchasingOrdersSidebarProps = {
  supplierId: string;
  onSupplierIdChange: (value: string) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  onCreateOrder: (event: FormEvent) => void;
  createOrderPending: boolean;
  suppliers: Supplier[];
  orders: PurchaseOrder[];
  selectedOrderId: number | null;
  onSelectOrder: (orderId: number) => void;
  ordersLoading: boolean;
};

export function PurchasingOrdersSidebar({
  supplierId,
  onSupplierIdChange,
  notes,
  onNotesChange,
  onCreateOrder,
  createOrderPending,
  suppliers,
  orders,
  selectedOrderId,
  onSelectOrder,
  ordersLoading,
}: PurchasingOrdersSidebarProps) {
  return (
    <div className="lg:col-span-4 space-y-6">
      <div className="bg-[var(--panel)] border border-[var(--line)] rounded-xl shadow-sm p-5">
        <h3 className="section-title mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-[var(--accent)]" /> Neue Bestellung
        </h3>

        <form onSubmit={onCreateOrder} className="space-y-4" data-testid="purchase-order-create-form">
          <div>
            <label className="block text-sm font-medium text-[var(--ink)] mb-1.5">Lieferant</label>
            <div className="relative">
              <select
                className="w-full h-10 px-3 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] transition-all"
                value={supplierId}
                onChange={(event) => onSupplierIdChange(event.target.value)}
                data-testid="purchase-order-supplier-select"
              >
                <option value="">Kein Lieferant ausgewählt</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.supplier_number} - {supplier.company_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--ink)] mb-1.5">Notiz</label>
            <input
              className="w-full h-10 px-3 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] transition-all placeholder:text-[var(--muted)]/60"
              value={notes}
              onChange={(event) => onNotesChange(event.target.value)}
              placeholder="Optional, z.B. Kommissionsnummer"
              data-testid="purchase-order-notes-input"
            />
          </div>

          <button
            type="submit"
            disabled={createOrderPending}
            className="w-full h-10 flex items-center justify-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            data-testid="purchase-order-create-btn"
          >
            {createOrderPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Bestellung erstellen
          </button>
        </form>
      </div>

      <div className="bg-[var(--panel)] border border-[var(--line)] rounded-xl shadow-sm flex flex-col h-[calc(100vh-24rem)] min-h-[400px]">
        <div className="p-4 border-b border-[var(--line)]">
          <h3 className="text-lg font-semibold text-[var(--ink)] flex items-center gap-2">
            <FileText className="w-4 h-4 text-[var(--muted)]" />
            Alle Bestellungen
          </h3>
        </div>

        <div className="overflow-y-auto flex-1 p-2 space-y-1" data-testid="purchase-order-list">
          {orders.map((order) => {
            const isSelected = selectedOrderId === order.id;
            return (
              <button
                key={order.id}
                onClick={() => onSelectOrder(order.id)}
                className={`w-full p-3 rounded-lg text-left transition-all group flex items-start gap-3 ${
                  isSelected
                    ? "bg-[var(--accent)]/10 border border-[var(--accent)]/30 ring-1 ring-[var(--accent)]/20"
                    : "hover:bg-[var(--bg)] border border-transparent hover:border-[var(--line)]"
                }`}
                data-testid={`purchase-order-item-${order.id}`}
              >
                <div
                  className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isSelected ? "bg-[var(--accent)] text-white" : "bg-[var(--panel-soft)] text-[var(--muted)]"
                  }`}
                >
                  <FileText className="w-4 h-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-0.5">
                    <span
                      className={`font-semibold text-sm truncate ${
                        isSelected ? "text-[var(--accent-strong)]" : "text-[var(--ink)]"
                      }`}
                    >
                      {order.order_number}
                    </span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        order.status === "completed"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : order.status === "cancelled"
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-[var(--panel-strong)] text-[var(--muted)]"
                      }`}
                    >
                      {order.status}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--muted)] truncate">
                    {order.supplier_id ? `Lieferant: ${order.supplier_id}` : "Kein Lieferant"}
                  </p>
                </div>
              </button>
            );
          })}

          {!ordersLoading && orders.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="bg-[var(--bg)] w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                <Package className="w-6 h-6 text-[var(--muted)]" />
              </div>
              <p className="text-[var(--muted)] text-sm">Keine Bestellungen vorhanden.</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
