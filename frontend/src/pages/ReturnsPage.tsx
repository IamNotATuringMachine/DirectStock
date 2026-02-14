import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchAllProducts } from "../services/productsApi";
import {
  createReturnOrder,
  createReturnOrderItem,
  fetchReturnOrderItems,
  fetchReturnOrders,
  updateReturnOrderStatus,
} from "../services/returnsApi";
import type { ReturnOrder } from "../types";

const transitionTargets: Record<string, Array<"received" | "inspected" | "resolved" | "cancelled">> = {
  registered: ["received", "cancelled"],
  received: ["inspected", "cancelled"],
  inspected: ["resolved", "cancelled"],
  resolved: [],
  cancelled: [],
};

export default function ReturnsPage() {
  const queryClient = useQueryClient();
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [decision, setDecision] = useState<"restock" | "repair" | "scrap" | "return_supplier">("restock");

  const ordersQuery = useQuery({
    queryKey: ["return-orders"],
    queryFn: fetchReturnOrders,
  });

  const productsQuery = useQuery({
    queryKey: ["products", "returns-picker"],
    queryFn: () => fetchAllProducts(),
  });

  const itemsQuery = useQuery({
    queryKey: ["return-order-items", selectedOrderId],
    queryFn: () => fetchReturnOrderItems(selectedOrderId as number),
    enabled: selectedOrderId !== null,
  });

  const createOrderMutation = useMutation({
    mutationFn: createReturnOrder,
    onSuccess: async (order) => {
      await queryClient.invalidateQueries({ queryKey: ["return-orders"] });
      setSelectedOrderId(order.id);
      setNotes("");
    },
  });

  const createItemMutation = useMutation({
    mutationFn: ({
      orderId,
      payload,
    }: {
      orderId: number;
      payload: Parameters<typeof createReturnOrderItem>[1];
    }) => createReturnOrderItem(orderId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["return-order-items", selectedOrderId] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: number; status: "registered" | "received" | "inspected" | "resolved" | "cancelled" }) =>
      updateReturnOrderStatus(orderId, status),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["return-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["return-order-items", selectedOrderId] }),
      ]);
    },
  });

  const selectedOrder = useMemo(
    () => ordersQuery.data?.find((order) => order.id === selectedOrderId) ?? null,
    [ordersQuery.data, selectedOrderId]
  );

  const allowedTransitions = selectedOrder ? transitionTargets[selectedOrder.status] ?? [] : [];

  const onCreateOrder = async (event: FormEvent) => {
    event.preventDefault();
    await createOrderMutation.mutateAsync({ notes: notes.trim() || undefined });
  };

  const onCreateItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedOrderId || !productId) {
      return;
    }
    await createItemMutation.mutateAsync({
      orderId: selectedOrderId,
      payload: {
        product_id: Number(productId),
        quantity,
        unit: "piece",
        decision,
      },
    });
  };

  return (
    <section className="panel" data-testid="returns-page">
      <header className="panel-header">
        <div>
          <h2>Retouren</h2>
          <p className="panel-subtitle">Retouren erfassen, Entscheidungen treffen und Status steuern.</p>
        </div>
      </header>

      <div className="warehouse-grid">
        <article className="subpanel">
          <h3>1. Retourenauftrag</h3>
          <form className="form-grid" onSubmit={(event) => void onCreateOrder(event)} data-testid="return-order-create-form">
            <label>
              Notiz
              <input
                className="input"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                data-testid="return-order-notes-input"
              />
            </label>
            <button className="btn" type="submit" disabled={createOrderMutation.isPending} data-testid="return-order-create-btn">
              Retoure anlegen
            </button>
          </form>

          <div className="list-stack small" data-testid="return-order-list">
            {(ordersQuery.data ?? []).map((order) => (
              <button
                key={order.id}
                className={`list-item ${selectedOrderId === order.id ? "active" : ""}`}
                onClick={() => setSelectedOrderId(order.id)}
                data-testid={`return-order-item-${order.id}`}
              >
                <strong>{order.return_number}</strong>
                <span>Status: {order.status}</span>
              </button>
            ))}
          </div>
        </article>

        <article className="subpanel">
          <h3>2. Positionen</h3>
          {selectedOrder ? (
            <>
              <form className="form-grid" onSubmit={(event) => void onCreateItem(event)} data-testid="return-order-item-form">
                <label>
                  Produkt
                  <select
                    className="input"
                    value={productId}
                    onChange={(event) => setProductId(event.target.value)}
                    data-testid="return-order-item-product-select"
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
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    data-testid="return-order-item-quantity-input"
                    required
                  />
                </label>
                <label>
                  Entscheidung
                  <select
                    className="input"
                    value={decision}
                    onChange={(event) => setDecision(event.target.value as typeof decision)}
                    data-testid="return-order-item-decision-select"
                  >
                    <option value="restock">restock</option>
                    <option value="repair">repair</option>
                    <option value="scrap">scrap</option>
                    <option value="return_supplier">return_supplier</option>
                  </select>
                </label>
                <button className="btn" type="submit" disabled={createItemMutation.isPending} data-testid="return-order-item-add-btn">
                  Position hinzufügen
                </button>
              </form>

              <div className="list-stack small" data-testid="return-order-items-list">
                {(itemsQuery.data ?? []).map((item) => (
                  <div className="list-item static-item" key={item.id}>
                    <strong>Produkt #{item.product_id}</strong>
                    <span>
                      Menge: {item.quantity} {item.unit} | Entscheidung: {item.decision ?? "-"}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p>Bitte zuerst einen Retourenauftrag auswählen.</p>
          )}
        </article>

        <article className="subpanel">
          <h3>3. Statusworkflow</h3>
          {!selectedOrder ? <p>Bitte Retourenauftrag auswählen.</p> : null}
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
                        status: statusName,
                      })
                    }
                    disabled={statusMutation.isPending}
                    data-testid={`return-order-status-${statusName}`}
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
    </section>
  );
}
