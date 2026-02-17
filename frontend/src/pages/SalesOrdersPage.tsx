import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, ChevronRight, CheckCircle, Clock, Truck, FileText, ShoppingCart } from "lucide-react";

import { fetchCustomerLocations, fetchCustomers } from "../services/customersApi";
import { fetchAllProducts } from "../services/productsApi";
import { fetchServices } from "../services/servicesApi";
import {
  addSalesOrderItem,
  createDeliveryNote,
  createSalesOrder,
  fetchSalesOrder,
  fetchSalesOrders,
  updateSalesOrder,
} from "../services/salesOrdersApi";

export default function SalesOrdersPage() {
  const queryClient = useQueryClient();
  const [customerId, setCustomerId] = useState<string>("");
  const [customerLocationId, setCustomerLocationId] = useState<string>("");
  const [itemType, setItemType] = useState<"product" | "service">("product");
  const [productId, setProductId] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>("");
  const [quantity, setQuantity] = useState("1");
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  const ordersQuery = useQuery({
    queryKey: ["sales-orders"],
    queryFn: () => fetchSalesOrders({ page: 1, pageSize: 200 }),
  });
  const customersQuery = useQuery({
    queryKey: ["customers", "sales-order"],
    queryFn: () => fetchCustomers({ page: 1, pageSize: 200, isActive: true }),
  });
  const customerLocationsQuery = useQuery({
    queryKey: ["customer-locations", "sales-order", customerId],
    queryFn: () => fetchCustomerLocations(Number(customerId), { isActive: true }),
    enabled: Boolean(customerId),
  });
  const productsQuery = useQuery({
    queryKey: ["products", "sales-order"],
    queryFn: () => fetchAllProducts(),
  });
  const servicesQuery = useQuery({
    queryKey: ["services", "sales-order"],
    queryFn: () => fetchServices({ page: 1, pageSize: 200, status: "active" }),
  });

  const selectedOrderQuery = useQuery({
    queryKey: ["sales-order", selectedOrderId],
    queryFn: () => fetchSalesOrder(selectedOrderId as number),
    enabled: selectedOrderId !== null,
  });

  const createMutation = useMutation({
    mutationFn: createSalesOrder,
    onSuccess: async (detail) => {
      setSelectedOrderId(detail.order.id);
      await queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
    },
  });

  const addItemMutation = useMutation({
    mutationFn: ({ orderId }: { orderId: number }) =>
      addSalesOrderItem(orderId, {
        item_type: itemType,
        product_id: itemType === "product" ? Number(productId) : undefined,
        service_id: itemType === "service" ? Number(serviceId) : undefined,
        quantity,
        unit: "piece",
      }),
    onSuccess: async () => {
      if (selectedOrderId !== null) {
        await queryClient.invalidateQueries({ queryKey: ["sales-order", selectedOrderId] });
      }
      await queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: number; status: string }) => updateSalesOrder(orderId, { status }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      if (selectedOrderId !== null) {
        await queryClient.invalidateQueries({ queryKey: ["sales-order", selectedOrderId] });
      }
    },
  });

  const deliveryNoteMutation = useMutation({
    mutationFn: (orderId: number) => createDeliveryNote(orderId),
  });

  const onCreateOrder = async (event: FormEvent) => {
    event.preventDefault();
    await createMutation.mutateAsync({
      customer_id: customerId ? Number(customerId) : undefined,
      customer_location_id: customerLocationId ? Number(customerLocationId) : undefined,
      items: [],
    });
  };

  useEffect(() => {
    setCustomerLocationId("");
  }, [customerId]);

  const selectedOrder = selectedOrderQuery.data;

  const disableAddItem = useMemo(() => {
    if (selectedOrderId === null) {
      return true;
    }
    if (itemType === "product") {
      return !productId;
    }
    return !serviceId;
  }, [itemType, productId, selectedOrderId, serviceId]);

  return (
    <section className="page flex flex-col gap-6" data-testid="sales-orders-page">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="page-title">Verkaufsaufträge</h2>
          <p className="section-subtitle mt-1">Aufträge mit Produkt- und Servicepositionen verwalten.</p>
        </div>
      </header>

      {/* Quick Creation Panel */}
      <article className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] p-6 shadow-sm">
        <h3 className="section-title mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-[var(--accent)]" />
          Neuen Auftrag erstellen
        </h3>
        <form className="flex flex-col gap-4 sm:flex-row sm:items-end w-full max-w-2xl" onSubmit={(event) => void onCreateOrder(event)}>
          <div className="flex-1 space-y-1.5">
            <label htmlFor="customer-select" className="block text-sm font-medium text-[var(--ink)]">
              Kunde
            </label>
            <div className="relative">
              <select
                id="customer-select"
                className="input w-full appearance-none"
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
              >
                <option value="">Ohne Kunde (Barverkauf)</option>
                {(customersQuery.data?.items ?? []).map((customer) => (
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
                  onChange={(event) => setCustomerLocationId(event.target.value)}
                >
                  <option value="">Kein Standort</option>
                  {(customerLocationsQuery.data ?? []).map((location) => (
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
          <button
            className="btn btn-primary"
            type="submit"
            disabled={createMutation.isPending}
          >
            Auftrag anlegen
          </button>
        </form>
      </article>

      {/* Orders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {(ordersQuery.data?.items ?? []).map((order) => (
          <div
            key={order.id}
            className={`relative flex flex-col justify-between overflow-hidden rounded-[var(--radius-md)] border transition-all duration-200 p-4 
                  ${selectedOrderId === order.id
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
                       ${order.status === "confirmed"
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
              <button
                type="button"
                onClick={() => setSelectedOrderId(order.id)}
                className="btn h-8 text-xs w-full justify-center"
              >
                Details
              </button>
              <div className="col-span-1 flex gap-2">
                {order.status !== "confirmed" ? (
                  <button
                    type="button"
                    onClick={() => void updateMutation.mutateAsync({ orderId: order.id, status: "confirmed" })}
                    className="btn btn-primary h-8 text-xs w-full justify-center"
                  >
                    Bestätigen
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void deliveryNoteMutation.mutateAsync(order.id)}
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 items-end">
              <div className="space-y-1.5 lg:col-span-1">
                <label className="text-xs font-medium text-[var(--ink)]">Typ</label>
                <div className="relative">
                  <select
                    className="input w-full appearance-none"
                    value={itemType}
                    onChange={(event) => setItemType(event.target.value as "product" | "service")}
                  >
                    <option value="product">Produkt</option>
                    <option value="service">Service</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--muted)]">
                    <ChevronRight className="w-4 h-4 rotate-90" />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 lg:col-span-2">
                <label className="text-xs font-medium text-[var(--ink)]">
                  {itemType === "product" ? "Produkt" : "Service"}
                </label>
                <div className="relative">
                  {itemType === "product" ? (
                    <select
                      className="input w-full appearance-none"
                      value={productId}
                      onChange={(event) => setProductId(event.target.value)}
                    >
                      <option value="">Produkt wählen...</option>
                      {(productsQuery.data?.items ?? []).map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.product_number} | {product.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      className="input w-full appearance-none"
                      value={serviceId}
                      onChange={(event) => setServiceId(event.target.value)}
                    >
                      <option value="">Service wählen...</option>
                      {(servicesQuery.data?.items ?? []).map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.service_number} | {service.name}
                        </option>
                      ))}
                    </select>
                  )}
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
                  onChange={(event) => setQuantity(event.target.value)}
                  placeholder="Menge"
                />
              </div>

              <div className="lg:col-span-1">
                <button
                  className="btn btn-primary w-full justify-center"
                  type="button"
                  disabled={disableAddItem || addItemMutation.isPending}
                  onClick={() => selectedOrderId !== null && void addItemMutation.mutateAsync({ orderId: selectedOrderId })}
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
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border
                               ${item.item_type === 'product'
                          ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800"
                          : "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800"
                        }
                            `}>
                        {item.item_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--ink)] font-mono">
                      {item.item_type === "product" ? item.product_id : item.service_id}
                    </td>
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
