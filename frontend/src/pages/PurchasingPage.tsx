import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
import { fetchProducts } from "../services/productsApi";
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
    queryFn: () => fetchProducts({ page: 1, pageSize: 200 }),
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
    <section className="panel" data-testid="purchasing-page">
      <header className="panel-header">
        <div>
          <h2>Einkauf / Bestellwesen</h2>
          <p className="panel-subtitle">Bestellungen, ABC-Klassifizierung und Bestellvorschlaege.</p>
        </div>
      </header>

      <div className="actions-cell" style={{ marginBottom: 12 }}>
        <button className={`btn ${tab === "orders" ? "active" : ""}`} onClick={() => setTab("orders")} data-testid="purchasing-tab-orders">
          Bestellungen
        </button>
        <button className={`btn ${tab === "abc" ? "active" : ""}`} onClick={() => setTab("abc")} data-testid="purchasing-tab-abc">
          ABC
        </button>
        <button
          className={`btn ${tab === "recommendations" ? "active" : ""}`}
          onClick={() => setTab("recommendations")}
          data-testid="purchasing-tab-recommendations"
        >
          Bestellvorschlaege
        </button>
      </div>

      {tab === "orders" ? (
        <div className="warehouse-grid">
          <article className="subpanel">
            <h3>1. Bestellung anlegen</h3>
            <form className="form-grid" onSubmit={(event) => void onCreateOrder(event)} data-testid="purchase-order-create-form">
              <label>
                Lieferant
                <select
                  className="input"
                  value={supplierId}
                  onChange={(event) => setSupplierId(event.target.value)}
                  data-testid="purchase-order-supplier-select"
                >
                  <option value="">Kein Lieferant</option>
                  {(suppliersQuery.data?.items ?? []).map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.supplier_number} - {supplier.company_name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Notiz
                <input
                  className="input"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Optional"
                  data-testid="purchase-order-notes-input"
                />
              </label>
              <button className="btn" type="submit" disabled={createOrderMutation.isPending} data-testid="purchase-order-create-btn">
                Bestellung erstellen
              </button>
            </form>

            <div className="list-stack small" data-testid="purchase-order-list">
              {(ordersQuery.data ?? []).map((order) => (
                <button
                  key={order.id}
                  className={`list-item ${selectedOrderId === order.id ? "active" : ""}`}
                  onClick={() => setSelectedOrderId(order.id)}
                  data-testid={`purchase-order-item-${order.id}`}
                >
                  <strong>{order.order_number}</strong>
                  <span>Status: {order.status}</span>
                </button>
              ))}
              {!ordersQuery.isLoading && (ordersQuery.data?.length ?? 0) === 0 ? <p>Keine Bestellungen vorhanden.</p> : null}
            </div>
          </article>

          <article className="subpanel">
            <h3>2. Positionen</h3>
            {selectedOrder ? (
              <>
                <p data-testid="purchase-order-selected-status">
                  Aktive Bestellung: <strong>{selectedOrder.order_number}</strong> ({selectedOrder.status})
                </p>

                <form className="form-grid" onSubmit={(event) => void onAddItem(event)} data-testid="purchase-order-item-form">
                  <label>
                    Produkt
                    <select
                      className="input"
                      value={productId}
                      onChange={(event) => setProductId(event.target.value)}
                      data-testid="purchase-order-item-product-select"
                      required
                    >
                      <option value="">Produkt wählen</option>
                      {(productsQuery.data?.items ?? []).map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.product_number} - {product.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Menge
                    <input
                      className="input"
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={orderedQuantity}
                      onChange={(event) => setOrderedQuantity(event.target.value)}
                      data-testid="purchase-order-item-quantity-input"
                      required
                    />
                  </label>

                  <label>
                    Einzelpreis
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={unitPrice}
                      onChange={(event) => setUnitPrice(event.target.value)}
                      placeholder="Optional"
                      data-testid="purchase-order-item-price-input"
                    />
                  </label>

                  <button
                    className="btn"
                    type="submit"
                    disabled={createItemMutation.isPending || !selectedOrder || selectedOrder.status !== "draft"}
                    data-testid="purchase-order-item-add-btn"
                  >
                    Position hinzufügen
                  </button>
                </form>

                <div className="list-stack small" data-testid="purchase-order-items-list">
                  {(orderItemsQuery.data ?? []).map((item) => (
                    <div key={item.id} className="list-item static-item">
                      <strong>Produkt #{item.product_id}</strong>
                      <span>
                        Menge: {item.ordered_quantity} {item.unit}
                        {item.unit_price ? ` | Preis: ${item.unit_price}` : ""}
                      </span>
                    </div>
                  ))}
                  {!orderItemsQuery.isLoading && (orderItemsQuery.data?.length ?? 0) === 0 ? <p>Keine Positionen vorhanden.</p> : null}
                </div>
              </>
            ) : (
              <p>Bitte zuerst eine Bestellung auswählen.</p>
            )}
          </article>

          <article className="subpanel">
            <h3>3. Statusworkflow</h3>
            {!selectedOrder ? <p>Bitte Bestellung auswählen.</p> : null}
            {selectedOrder ? (
              <div className="list-stack">
                <p>
                  Aktueller Status: <strong>{selectedOrder.status}</strong>
                </p>
                <div className="actions-cell">
                  {allowedTransitions.map((statusName) => (
                    <button
                      key={statusName}
                      className="btn"
                      onClick={() =>
                        void statusMutation.mutateAsync({
                          orderId: selectedOrder.id,
                          nextStatus: statusName,
                        })
                      }
                      disabled={statusMutation.isPending}
                      data-testid={`purchase-order-status-${statusName}`}
                    >
                      {statusName}
                    </button>
                  ))}
                </div>
                {allowedTransitions.length === 0 ? <p>Keine weiteren Statusübergänge möglich.</p> : null}
              </div>
            ) : null}
          </article>
        </div>
      ) : null}

      {tab === "abc" ? (
        <div className="subpanel" data-testid="purchasing-abc-tab">
          <div className="actions-cell" style={{ marginBottom: 12 }}>
            <button
              className="btn"
              onClick={() => void recomputeAbcMutation.mutateAsync()}
              disabled={recomputeAbcMutation.isPending}
              data-testid="abc-recompute-btn"
            >
              ABC neu berechnen
            </button>
          </div>
          <div className="table-wrap">
            <table className="products-table" data-testid="abc-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Produkt</th>
                  <th>Outbound</th>
                  <th>Share</th>
                  <th>Kumulativ</th>
                  <th>Klasse</th>
                </tr>
              </thead>
              <tbody>
                {(abcQuery.data?.items ?? []).map((row) => (
                  <tr key={row.id}>
                    <td>{row.rank}</td>
                    <td>{row.product_number}</td>
                    <td>{row.outbound_quantity}</td>
                    <td>{row.share_percent}%</td>
                    <td>{row.cumulative_share_percent}%</td>
                    <td>{row.category}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "recommendations" ? (
        <div className="subpanel" data-testid="purchasing-recommendations-tab">
          <div className="actions-cell" style={{ marginBottom: 12 }}>
            <button
              className="btn"
              onClick={() => void generateRecommendationsMutation.mutateAsync()}
              disabled={generateRecommendationsMutation.isPending}
              data-testid="purchase-recommendations-generate-btn"
            >
              Bestellvorschlaege erzeugen
            </button>
          </div>

          <div className="table-wrap">
            <table className="products-table" data-testid="purchase-recommendations-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Produkt</th>
                  <th>Defizit</th>
                  <th>Empfehlung</th>
                  <th>Status</th>
                  <th>Aktion</th>
                </tr>
              </thead>
              <tbody>
                {(recommendationsQuery.data?.items ?? []).map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.product_id}</td>
                    <td>{item.deficit_quantity}</td>
                    <td>{item.recommended_quantity}</td>
                    <td>{item.status}</td>
                    <td>
                      <div className="actions-cell">
                        <button
                          className="btn"
                          onClick={() => void convertRecommendationMutation.mutateAsync(item.id)}
                          disabled={convertRecommendationMutation.isPending || item.status !== "open"}
                          data-testid={`purchase-recommendation-convert-${item.id}`}
                        >
                          In PO
                        </button>
                        <button
                          className="btn"
                          onClick={() => void dismissRecommendationMutation.mutateAsync(item.id)}
                          disabled={dismissRecommendationMutation.isPending || item.status !== "open"}
                          data-testid={`purchase-recommendation-dismiss-${item.id}`}
                        >
                          Dismiss
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
