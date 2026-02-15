import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ShoppingCart,
  Plus,
  Save,
  Trash2,
  CheckCircle,
  XCircle,
  ArrowRight,
  RefreshCw,
  FileText,
  Package,
  AlertCircle,
  Search,
  Filter
} from "lucide-react";

import { fetchAbcClassification, recomputeAbcClassification } from "../services/abcApi";
import {
  convertPurchaseRecommendation,
  dismissPurchaseRecommendation,
  fetchPurchaseRecommendations,
  generatePurchaseRecommendations,
} from "../services/purchaseRecommendationsApi";
import {
  createPurchaseOrder,
  createPurchaseOrderItem,
  fetchPurchaseOrderItems,
  fetchPurchaseOrders,
  updatePurchaseOrderStatus,
} from "../services/purchasingApi";
import { fetchAllProducts } from "../services/productsApi";
import { fetchSuppliers } from "../services/suppliersApi";
import type { PurchaseOrder } from "../types";

const transitionTargets: Record<PurchaseOrder["status"], PurchaseOrder["status"][]> = {
  draft: ["approved", "cancelled"],
  approved: ["ordered", "cancelled"],
  ordered: ["partially_received", "completed", "cancelled"],
  partially_received: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

type PurchasingTab = "orders" | "abc" | "recommendations";

export default function PurchasingPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<PurchasingTab>("orders");

  const [supplierId, setSupplierId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  const [productId, setProductId] = useState<string>("");
  const [orderedQuantity, setOrderedQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");

  const suppliersQuery = useQuery({
    queryKey: ["suppliers", "purchasing"],
    queryFn: () => fetchSuppliers({ page: 1, pageSize: 200, isActive: true }),
    enabled: tab === "orders" || tab === "recommendations",
  });

  const productsQuery = useQuery({
    queryKey: ["products", "purchasing-picker"],
    queryFn: () => fetchAllProducts(),
    enabled: tab === "orders",
  });

  const ordersQuery = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: () => fetchPurchaseOrders(),
    enabled: tab === "orders",
  });

  const orderItemsQuery = useQuery({
    queryKey: ["purchase-order-items", selectedOrderId],
    queryFn: () => fetchPurchaseOrderItems(selectedOrderId as number),
    enabled: tab === "orders" && selectedOrderId !== null,
  });

  const abcQuery = useQuery({
    queryKey: ["abc-classification"],
    queryFn: () => fetchAbcClassification(),
    enabled: tab === "abc",
  });

  const recommendationsQuery = useQuery({
    queryKey: ["purchase-recommendations"],
    queryFn: () => fetchPurchaseRecommendations({ status: "open" }),
    enabled: tab === "recommendations",
  });

  const createOrderMutation = useMutation({
    mutationFn: createPurchaseOrder,
    onSuccess: async (order) => {
      setNotes("");
      setSupplierId("");
      await queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      setSelectedOrderId(order.id);
    },
  });

  const createItemMutation = useMutation({
    mutationFn: ({
      orderId,
      payload,
    }: {
      orderId: number;
      payload: Parameters<typeof createPurchaseOrderItem>[1];
    }) => createPurchaseOrderItem(orderId, payload),
    onSuccess: async () => {
      setOrderedQuantity("1");
      setUnitPrice("");
      await queryClient.invalidateQueries({ queryKey: ["purchase-order-items", selectedOrderId] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ orderId, nextStatus }: { orderId: number; nextStatus: PurchaseOrder["status"] }) =>
      updatePurchaseOrderStatus(orderId, nextStatus),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["purchase-order-items", selectedOrderId] });
    },
  });

  const recomputeAbcMutation = useMutation({
    mutationFn: () => recomputeAbcClassification(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["abc-classification"] });
    },
  });

  const generateRecommendationsMutation = useMutation({
    mutationFn: () => generatePurchaseRecommendations(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["purchase-recommendations"] });
    },
  });

  const convertRecommendationMutation = useMutation({
    mutationFn: (recommendationId: number) => convertPurchaseRecommendation(recommendationId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["purchase-recommendations"] }),
        queryClient.invalidateQueries({ queryKey: ["purchase-orders"] }),
      ]);
    },
  });

  const dismissRecommendationMutation = useMutation({
    mutationFn: (recommendationId: number) => dismissPurchaseRecommendation(recommendationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["purchase-recommendations"] });
    },
  });

  const selectedOrder = useMemo(
    () => ordersQuery.data?.find((order) => order.id === selectedOrderId) ?? null,
    [ordersQuery.data, selectedOrderId]
  );

  const allowedTransitions = selectedOrder ? transitionTargets[selectedOrder.status] : [];

  const onCreateOrder = async (event: FormEvent) => {
    event.preventDefault();
    await createOrderMutation.mutateAsync({
      supplier_id: supplierId ? Number(supplierId) : null,
      notes: notes.trim() || undefined,
    });
  };

  const onAddItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedOrderId || !productId) {
      return;
    }

    await createItemMutation.mutateAsync({
      orderId: selectedOrderId,
      payload: {
        product_id: Number(productId),
        ordered_quantity: orderedQuantity,
        unit: "piece",
        unit_price: unitPrice.trim() ? unitPrice.trim() : null,
      },
    });
  };

  return (
    <div className="space-y-6" data-testid="purchasing-page">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[var(--line)] pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)] flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-[var(--accent)]" />
            Einkauf / Bestellwesen
          </h1>
          <p className="text-[var(--muted)] mt-1 text-sm max-w-2xl">
            Verwalten Sie Bestellungen, ABC-Klassifizierungen und erhalten Sie intelligente Bestellvorschläge.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[var(--line)]">
        <button
          onClick={() => setTab("orders")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            tab === "orders"
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-transparent text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--line-strong)]"
          }`}
          data-testid="purchasing-tab-orders"
        >
          <FileText className="w-4 h-4" />
          Bestellungen
        </button>
        <button
          onClick={() => setTab("abc")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            tab === "abc"
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-transparent text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--line-strong)]"
          }`}
          data-testid="purchasing-tab-abc"
        >
          <Filter className="w-4 h-4" />
          ABC-Analyse
        </button>
        <button
          onClick={() => setTab("recommendations")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            tab === "recommendations"
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-transparent text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--line-strong)]"
          }`}
          data-testid="purchasing-tab-recommendations"
        >
          <AlertCircle className="w-4 h-4" />
          Bestellvorschläge
        </button>
      </div>

      {/* Tab Content: Orders */}
      {tab === "orders" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Order List & Create Order */}
          <div className="lg:col-span-4 space-y-6">
            {/* Create Order Card */}
            <div className="bg-[var(--panel)] border border-[var(--line)] rounded-xl shadow-sm p-5">
              <h3 className="text-lg font-semibold text-[var(--ink)] mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4 text-[var(--accent)]" /> Neue Bestellung
              </h3>
              <form onSubmit={(event) => void onCreateOrder(event)} className="space-y-4" data-testid="purchase-order-create-form">
                <div>
                  <label className="block text-sm font-medium text-[var(--ink)] mb-1.5">Lieferant</label>
                  <div className="relative">
                    <select
                      className="w-full h-10 px-3 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] transition-all"
                      value={supplierId}
                      onChange={(event) => setSupplierId(event.target.value)}
                      data-testid="purchase-order-supplier-select"
                    >
                      <option value="">Kein Lieferant ausgewählt</option>
                      {(suppliersQuery.data?.items ?? []).map((supplier) => (
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
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Optional, z.B. Kommissionsnummer"
                    data-testid="purchase-order-notes-input"
                  />
                </div>
                <button
                  type="submit"
                  disabled={createOrderMutation.isPending}
                  className="w-full h-10 flex items-center justify-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  data-testid="purchase-order-create-btn"
                >
                  {createOrderMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Bestellung erstellen
                </button>
              </form>
            </div>

            {/* Order List Card */}
            <div className="bg-[var(--panel)] border border-[var(--line)] rounded-xl shadow-sm flex flex-col h-[calc(100vh-24rem)] min-h-[400px]">
              <div className="p-4 border-b border-[var(--line)]">
                <h3 className="text-lg font-semibold text-[var(--ink)] flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[var(--muted)]" />
                  Alle Bestellungen
                </h3>
              </div>
              <div className="overflow-y-auto flex-1 p-2 space-y-1" data-testid="purchase-order-list">
                {(ordersQuery.data ?? []).map((order) => (
                  <button
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                    className={`w-full p-3 rounded-lg text-left transition-all group flex items-start gap-3 ${
                      selectedOrderId === order.id
                        ? "bg-[var(--accent)]/10 border border-[var(--accent)]/30 ring-1 ring-[var(--accent)]/20"
                        : "hover:bg-[var(--bg)] border border-transparent hover:border-[var(--line)]"
                    }`}
                    data-testid={`purchase-order-item-${order.id}`}
                  >
                     <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        selectedOrderId === order.id ? "bg-[var(--accent)] text-white" : "bg-[var(--panel-soft)] text-[var(--muted)]"
                     }`}>
                        <FileText className="w-4 h-4" />
                     </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-0.5">
                        <span className={`font-semibold text-sm truncate ${selectedOrderId === order.id ? "text-[var(--accent-strong)]" : "text-[var(--ink)]"}`}>
                          {order.order_number}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                          order.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          order.status === 'cancelled' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                          'bg-[var(--panel-strong)] text-[var(--muted)]'
                        }`}>
                          {order.status}
                        </span>
                      </div>
                       <p className="text-xs text-[var(--muted)] truncate">
                         {order.supplier_id ? `Lieferant: ${order.supplier_id}` : "Kein Lieferant"}
                       </p>
                    </div>
                  </button>
                ))}
                {!ordersQuery.isLoading && (ordersQuery.data?.length ?? 0) === 0 && (
                  <div className="text-center py-12 px-4">
                     <div className="bg-[var(--bg)] w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Package className="w-6 h-6 text-[var(--muted)]" />
                     </div>
                    <p className="text-[var(--muted)] text-sm">Keine Bestellungen vorhanden.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Details & Items */}
          <div className="lg:col-span-8 space-y-6">
            {selectedOrder ? (
              <div className="space-y-6">
                 {/* Detail Header & Actions */}
                <div className="bg-[var(--panel)] border border-[var(--line)] rounded-xl shadow-sm p-6">
                   <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                      <div>
                         <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Bestellung</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                                selectedOrder.status === 'completed' ? 'bg-green-100 text-green-700' :
                                selectedOrder.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                'bg-blue-100 text-blue-700'
                            }`}>
                               {selectedOrder.status}
                            </span>
                         </div>
                         <h2 className="text-2xl font-bold text-[var(--ink)]" data-testid="purchase-order-selected-status">
                            {selectedOrder.order_number}
                         </h2>
                      </div>

                      {/* Status Workflow Actions */}
                      <div className="flex flex-wrap gap-2">
                        {allowedTransitions.length > 0 ? (
                           allowedTransitions.map((statusName) => (
                              <button
                                 key={statusName}
                                 onClick={() =>
                                    void statusMutation.mutateAsync({
                                       orderId: selectedOrder.id,
                                       nextStatus: statusName,
                                    })
                                 }
                                 disabled={statusMutation.isPending}
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

                   {/* Add Item Form (Only if Draft) */}
                   {selectedOrder.status === "draft" && (
                      <div className="bg-[var(--bg)]/50 rounded-lg p-4 border border-[var(--line)] mb-6">
                         <h4 className="text-sm font-semibold text-[var(--ink)] mb-3 flex items-center gap-2">
                            <Plus className="w-4 h-4" /> Position hinzufügen
                         </h4>
                         <form onSubmit={(event) => void onAddItem(event)} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end" data-testid="purchase-order-item-form">
                            <div className="md:col-span-6">
                               <label className="block text-xs font-medium text-[var(--muted)] mb-1">Produkt</label>
                               <select
                                  className="w-full h-9 px-3 bg-[var(--panel)] border border-[var(--line)] rounded-lg text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]"
                                  value={productId}
                                  onChange={(event) => setProductId(event.target.value)}
                                  data-testid="purchase-order-item-product-select"
                                  required
                               >
                                  <option value="">Produkt wählen...</option>
                                  {(productsQuery.data?.items ?? []).map((product) => (
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
                                  onChange={(event) => setOrderedQuantity(event.target.value)}
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
                                  onChange={(event) => setUnitPrice(event.target.value)}
                                  placeholder="0.00"
                                  data-testid="purchase-order-item-price-input"
                               />
                            </div>
                            <div className="md:col-span-2">
                               <button
                                  type="submit"
                                  disabled={createItemMutation.isPending}
                                  className="w-full h-9 flex items-center justify-center gap-2 bg-[var(--ink)] hover:bg-[var(--ink)]/90 text-[var(--bg)] text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                                  data-testid="purchase-order-item-add-btn"
                               >
                                  Hinzufügen
                               </button>
                            </div>
                         </form>
                      </div>
                   )}

                   {/* Items Table */}
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
                            {(orderItemsQuery.data ?? []).map((item) => (
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
                            {!orderItemsQuery.isLoading && (orderItemsQuery.data?.length ?? 0) === 0 && (
                               <tr>
                                  <td colSpan={5} className="px-4 py-8 text-center text-[var(--muted)]">
                                     Keine Positionen in dieser Bestellung.
                                  </td>
                               </tr>
                            )}
                         </tbody>
                      </table>
                   </div>
                </div>
              </div>
            ) : (
               <div className="h-full flex flex-col items-center justify-center p-12 text-center border border-dashed border-[var(--line-strong)] rounded-xl bg-[var(--panel)]/50">
                  <div className="bg-[var(--panel-strong)] p-4 rounded-full mb-4">
                     <ShoppingCart className="w-8 h-8 text-[var(--muted)]" />
                  </div>
                  <h3 className="text-lg font-medium text-[var(--ink)] mb-1">Keine Bestellung ausgewählt</h3>
                  <p className="text-[var(--muted)] max-w-sm">Wählen Sie eine Bestellung aus der Liste links aus oder erstellen Sie eine neue, um Details zu sehen.</p>
               </div>
            )}
          </div>
        </div>
      )}

      {/* Tab Content: ABC */}
      {tab === "abc" && (
        <div className="bg-[var(--panel)] border border-[var(--line)] rounded-xl shadow-sm overflow-hidden" data-testid="purchasing-abc-tab">
           <div className="p-5 border-b border-[var(--line)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--panel-soft)]">
              <div>
                 <h3 className="text-lg font-semibold text-[var(--ink)]">ABC-Klassifizierung</h3>
                 <p className="text-sm text-[var(--muted)]">Analyse basierend auf Outbound-Mengen.</p>
              </div>
              <button
                 onClick={() => void recomputeAbcMutation.mutateAsync()}
                 disabled={recomputeAbcMutation.isPending}
                 className="flex items-center gap-2 px-4 py-2 bg-[var(--panel)] border border-[var(--line)] hover:bg-[var(--bg)] text-[var(--ink)] text-sm font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50"
                 data-testid="abc-recompute-btn"
              >
                 <RefreshCw className={`w-4 h-4 ${recomputeAbcMutation.isPending ? "animate-spin" : ""}`} />
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
                    {(abcQuery.data?.items ?? []).map((row) => (
                       <tr key={row.id} className="bg-[var(--panel)] hover:bg-[var(--panel-soft)] transition-colors">
                          <td className="px-5 py-3 text-[var(--muted)]">#{row.rank}</td>
                          <td className="px-5 py-3 font-medium text-[var(--ink)]">{row.product_number}</td>
                          <td className="px-5 py-3 text-right text-[var(--ink)]">{row.outbound_quantity}</td>
                          <td className="px-5 py-3 text-right text-[var(--muted)]">{row.share_percent}%</td>
                          <td className="px-5 py-3 text-right text-[var(--muted)]">{row.cumulative_share_percent}%</td>
                          <td className="px-5 py-3 text-center">
                             <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-xs ${
                                row.category === 'A' ? 'bg-green-100 text-green-700 border border-green-200' :
                                row.category === 'B' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                                'bg-gray-100 text-gray-700 border border-gray-200'
                             }`}>
                                {row.category}
                             </span>
                          </td>
                       </tr>
                    ))}
                    {!abcQuery.isLoading && (abcQuery.data?.items ?? []).length === 0 && (
                       <tr>
                          <td colSpan={6} className="px-5 py-12 text-center text-[var(--muted)]">
                             Keine Daten vorhanden. Bitte Berechnung starten.
                          </td>
                       </tr>
                    )}
                 </tbody>
              </table>
           </div>
        </div>
      )}

      {/* Tab Content: Recommendations */}
      {tab === "recommendations" && (
        <div className="bg-[var(--panel)] border border-[var(--line)] rounded-xl shadow-sm overflow-hidden" data-testid="purchasing-recommendations-tab">
           <div className="p-5 border-b border-[var(--line)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--panel-soft)]">
              <div>
                 <h3 className="text-lg font-semibold text-[var(--ink)]">Bestellvorschläge</h3>
                 <p className="text-sm text-[var(--muted)]">Automatisch generierte Vorschläge basierend auf Bestandsdefiziten.</p>
              </div>
              <button
                 onClick={() => void generateRecommendationsMutation.mutateAsync()}
                 disabled={generateRecommendationsMutation.isPending}
                 className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white text-sm font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50"
                 data-testid="purchase-recommendations-generate-btn"
              >
                 <RefreshCw className={`w-4 h-4 ${generateRecommendationsMutation.isPending ? "animate-spin" : ""}`} />
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
                    {(recommendationsQuery.data?.items ?? []).map((item) => (
                       <tr key={item.id} className="bg-[var(--panel)] hover:bg-[var(--panel-soft)] transition-colors">
                          <td className="px-5 py-3 text-[var(--muted)]">#{item.id}</td>
                          <td className="px-5 py-3 font-medium text-[var(--ink)]">{item.product_id}</td>
                          <td className="px-5 py-3 text-right text-red-600 font-medium">{item.deficit_quantity}</td>
                          <td className="px-5 py-3 text-right text-[var(--accent-strong)] font-bold">{item.recommended_quantity}</td>
                          <td className="px-5 py-3">
                             <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                                {item.status}
                             </span>
                          </td>
                          <td className="px-5 py-3">
                             <div className="flex justify-end gap-2">
                                <button
                                   onClick={() => void convertRecommendationMutation.mutateAsync(item.id)}
                                   disabled={convertRecommendationMutation.isPending || item.status !== "open"}
                                   className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--panel)] border border-[var(--line)] hover:bg-[var(--bg)] text-[var(--ink)] text-xs font-medium rounded transition-colors disabled:opacity-50"
                                   title="In Bestellung umwandeln"
                                   data-testid={`purchase-recommendation-convert-${item.id}`}
                                >
                                   <CheckCircle className="w-3.5 h-3.5 text-[var(--accent)]" />
                                   In PO
                                </button>
                                <button
                                   onClick={() => void dismissRecommendationMutation.mutateAsync(item.id)}
                                   disabled={dismissRecommendationMutation.isPending || item.status !== "open"}
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
                    {!recommendationsQuery.isLoading && (recommendationsQuery.data?.items ?? []).length === 0 && (
                       <tr>
                          <td colSpan={6} className="px-5 py-12 text-center text-[var(--muted)]">
                             Keine offenen Bestellvorschläge.
                          </td>
                       </tr>
                    )}
                 </tbody>
              </table>
           </div>
        </div>
      )}
    </div>
  );
}
