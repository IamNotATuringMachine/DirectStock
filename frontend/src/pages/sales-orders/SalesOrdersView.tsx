import { ChevronRight, CheckCircle, Clock, FileText, Plus, ShoppingCart, Truck } from "lucide-react";
import type { FormEvent } from "react";

import type { Customer, CustomerLocation, Product, SalesOrder, SalesOrderDetail } from "../../types";

type SalesOrdersViewProps = {
  orders: SalesOrder[];
  selectedOrderId: number | null;
  onSelectOrder: (orderId: number) => void;
  onConfirmOrder: (orderId: number) => void;
  onDeliverOrder: (orderId: number) => void;
  customers: Customer[];
  customerLocations: CustomerLocation[];
  customerId: string;
  onCustomerIdChange: (value: string) => void;
  customerLocationId: string;
  onCustomerLocationIdChange: (value: string) => void;
  onCreateOrder: (event: FormEvent<HTMLFormElement>) => void;
  createOrderPending: boolean;
  selectedOrder: SalesOrderDetail | null;
  products: Product[];
  productId: string;
  onProductIdChange: (value: string) => void;
  quantity: string;
  onQuantityChange: (value: string) => void;
  disableAddItem: boolean;
  addItemPending: boolean;
  onAddItem: () => void;
};

export function SalesOrdersView({
  orders,
  selectedOrderId,
  onSelectOrder,
  onConfirmOrder,
  onDeliverOrder,
  customers,
  customerLocations,
  customerId,
  onCustomerIdChange,
  customerLocationId,
  onCustomerLocationIdChange,
  onCreateOrder,
  createOrderPending,
  selectedOrder,
  products,
  productId,
  onProductIdChange,
  quantity,
  onQuantityChange,
  disableAddItem,
  addItemPending,
  onAddItem,
}: SalesOrdersViewProps) {
  return (
    <section className="page flex flex-col gap-6" data-testid="sales-orders-page">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="page-title">Verkaufsaufträge</h2>
          <p className="section-subtitle mt-1">Aufträge mit Produktpositionen verwalten.</p>
        </div>
      </header>

      <article className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] p-6 shadow-sm">
        <h3 className="section-title mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-[var(--accent)]" />
          Neuen Auftrag erstellen
        </h3>
        <form className="flex flex-col gap-4 sm:flex-row sm:items-end w-full max-w-2xl" onSubmit={onCreateOrder}>
          <div className="flex-1 space-y-1.5">
            <label htmlFor="customer-select" className="block text-sm font-medium text-[var(--ink)]">
              Kunde
            </label>
            <div className="relative">
              <select
                id="customer-select"
                className="input w-full appearance-none"
                value={customerId}
                onChange={(event) => onCustomerIdChange(event.target.value)}
              >
                <option value="">Ohne Kunde (Barverkauf)</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.company_name}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--muted)]">
                <ChevronRight className="w-4 h-4 rotate-90" />
              </div>
            </div>
          </div>
          {customerId ? (
            <div className="flex-1 space-y-1.5">
              <label htmlFor="customer-location-select" className="block text-sm font-medium text-[var(--ink)]">
                Standort
              </label>
              <div className="relative">
                <select
                  id="customer-location-select"
                  className="input w-full appearance-none"
                  value={customerLocationId}
                  onChange={(event) => onCustomerLocationIdChange(event.target.value)}
                >
                  <option value="">Kein Standort</option>
                  {customerLocations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.location_code} - {location.name}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--muted)]">
                  <ChevronRight className="w-4 h-4 rotate-90" />
                </div>
              </div>
            </div>
          ) : null}
          <button className="btn btn-primary" type="submit" disabled={createOrderPending}>
            Auftrag anlegen
          </button>
        </form>
      </article>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {orders.map((order) => (
          <div
            key={order.id}
            className={`relative flex flex-col justify-between overflow-hidden rounded-[var(--radius-md)] border transition-all duration-200 p-4
                  ${
                    selectedOrderId === order.id
                      ? "bg-[var(--panel-strong)] border-[var(--accent)] shadow-md ring-1 ring-[var(--accent)]"
                      : "bg-[var(--panel)] border-[var(--line)] hover:border-[var(--line-strong)] hover:shadow-sm"
                  }`}
          >
            <div className="mb-4 min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-sm font-bold text-[var(--ink)] flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-[var(--muted)] opacity-70" />
                    {order.order_number}
                  </h4>
                  <p className="mt-1 truncate text-xs text-[var(--muted)]">
                    {order.customer_id ? `Kunde #${order.customer_id}` : "Ohne Kunde"}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border
                       ${
                         order.status === "confirmed"
                           ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800"
                           : "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700"
                       }`}
                >
                  {order.status === "confirmed" ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                  {order.status}
                </span>
              </div>
            </div>

            <div className="mt-auto grid grid-cols-2 gap-2 border-t border-[var(--line)] pt-3">
              <button type="button" onClick={() => onSelectOrder(order.id)} className="btn h-8 text-xs w-full justify-center">
                Details
              </button>
              <div className="col-span-1 flex gap-2">
                {order.status !== "confirmed" ? (
                  <button
                    type="button"
                    onClick={() => onConfirmOrder(order.id)}
                    className="btn btn-primary h-8 text-xs w-full justify-center"
                  >
                    Bestätigen
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onDeliverOrder(order.id)}
                    className="btn h-8 text-xs w-full justify-center text-[var(--ink)] hover:text-[var(--accent)]"
                    title="Lieferschein erstellen"
                  >
                    <Truck className="w-3.5 h-3.5 mr-1" />
                    Liefern
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedOrder && (
        <article className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] p-6 shadow-sm animate-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between mb-6 border-b border-[var(--line)] pb-4">
            <h3 className="text-xl font-bold text-[var(--ink)] flex items-center gap-2">
              <FileText className="w-5 h-5 text-[var(--accent)]" />
              Auftrag {selectedOrder.order.order_number}
            </h3>
            <div className="text-xs px-2.5 py-1 bg-[var(--bg)] border border-[var(--line)] rounded-md text-[var(--muted)] font-mono">
              ID: {selectedOrder.order.id}
            </div>
          </div>

          <div className="bg-[var(--bg)] p-4 rounded-[var(--radius-md)] border border-[var(--line)] mb-8">
            <h4 className="section-title uppercase tracking-wider mb-3">Position hinzufügen</h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
              <div className="space-y-1.5 lg:col-span-2">
                <label className="text-xs font-medium text-[var(--ink)]">Produkt</label>
                <div className="relative">
                  <select
                    className="input w-full appearance-none"
                    value={productId}
                    onChange={(event) => onProductIdChange(event.target.value)}
                  >
                    <option value="">Produkt wählen...</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.product_number} | {product.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--muted)]">
                    <ChevronRight className="w-4 h-4 rotate-90" />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 lg:col-span-1">
                <label className="text-xs font-medium text-[var(--ink)]">Menge</label>
                <input
                  className="input w-full"
                  value={quantity}
                  onChange={(event) => onQuantityChange(event.target.value)}
                  placeholder="Menge"
                />
              </div>

              <div className="lg:col-span-1">
                <button
                  className="btn btn-primary w-full justify-center"
                  type="button"
                  disabled={disableAddItem || addItemPending}
                  onClick={onAddItem}
                >
                  Hinzufügen
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[var(--radius-sm)] border border-[var(--line)]">
            <table className="w-full text-left collapse">
              <thead>
                <tr className="bg-[var(--panel-strong)] text-xs font-semibold text-[var(--muted)] uppercase tracking-wider border-b border-[var(--line)]">
                  <th className="px-4 py-3 w-16 text-center">#</th>
                  <th className="px-4 py-3">Typ</th>
                  <th className="px-4 py-3">Referenz ID</th>
                  <th className="px-4 py-3 text-right">Menge</th>
                  <th className="px-4 py-3 text-right">Invoiced</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)] bg-[var(--panel)]">
                {selectedOrder.items.map((item) => (
                  <tr key={item.id} className="hover:bg-[var(--panel-soft)] transition-colors">
                    <td className="px-4 py-3 text-center text-[var(--muted)] font-mono text-sm">{item.line_no}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium border bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800">
                        {item.item_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--ink)] font-mono">{item.product_id}</td>
                    <td className="px-4 py-3 text-right text-sm text-[var(--ink)] font-semibold">{item.quantity}</td>
                    <td className="px-4 py-3 text-right text-sm text-[var(--muted)]">{item.invoiced_quantity}</td>
                  </tr>
                ))}
                {selectedOrder.items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-[var(--muted)] italic text-sm">
                      Keine Positionen vorhanden.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      )}
    </section>
  );
}
