import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Package,
  ClipboardList,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Truck,
  FileText
} from "lucide-react";

import { fetchAllProducts } from "../services/productsApi";
import {
  createReturnOrder,
  createReturnOrderItem,
  dispatchReturnOrderItemExternal,
  fetchReturnOrderItems,
  fetchReturnOrders,
  receiveReturnOrderItemExternal,
  updateReturnOrderStatus,
} from "../services/returnsApi";
import { downloadDocumentBlob } from "../services/documentsApi";
import { fetchBins, fetchWarehouses, fetchZones } from "../services/warehousesApi";
// import type { ReturnOrder } from "../types"; // Unused import

const transitionTargets: Record<string, Array<"received" | "inspected" | "resolved" | "cancelled">> = {
  registered: ["received", "cancelled"],
  received: ["inspected", "cancelled"],
  inspected: ["resolved", "cancelled"],
  resolved: [],
  cancelled: [],
};

const decisionLabels: Record<string, string> = {
  restock: "Ins Lager (Restock)",
  repair: "Reparatur",
  scrap: "Verschrotten",
  return_supplier: "Rücksendung (Lieferant)",
};

export default function ReturnsPage() {
  const queryClient = useQueryClient();
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [sourceType, setSourceType] = useState<"customer" | "technician">("customer");
  const [sourceReference, setSourceReference] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [decision, setDecision] = useState<"restock" | "repair" | "scrap" | "return_supplier">("restock");
  const [repairMode, setRepairMode] = useState<"internal" | "external">("internal");
  const [externalPartner, setExternalPartner] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [selectedBinId, setSelectedBinId] = useState("");

  const ordersQuery = useQuery({
    queryKey: ["return-orders"],
    queryFn: fetchReturnOrders,
  });

  const productsQuery = useQuery({
    queryKey: ["products", "returns-picker"],
    queryFn: () => fetchAllProducts(),
  });

  const warehousesQuery = useQuery({
    queryKey: ["warehouses", "returns-picker"],
    queryFn: fetchWarehouses,
  });

  const zonesQuery = useQuery({
    queryKey: ["zones", "returns-picker", selectedWarehouseId],
    queryFn: () => fetchZones(selectedWarehouseId as number),
    enabled: selectedWarehouseId !== null,
  });

  const binsQuery = useQuery({
    queryKey: ["bins", "returns-picker", selectedZoneId],
    queryFn: () => fetchBins(selectedZoneId as number),
    enabled: selectedZoneId !== null,
  });

  const itemsQuery = useQuery({
    queryKey: ["return-order-items", selectedOrderId],
    queryFn: () => fetchReturnOrderItems(selectedOrderId as number),
    enabled: selectedOrderId !== null,
  });

  useEffect(() => {
    if (!selectedWarehouseId && warehousesQuery.data && warehousesQuery.data.length > 0) {
      setSelectedWarehouseId(warehousesQuery.data[0].id);
    }
  }, [selectedWarehouseId, warehousesQuery.data]);

  useEffect(() => {
    if (!selectedZoneId && zonesQuery.data && zonesQuery.data.length > 0) {
      setSelectedZoneId(zonesQuery.data[0].id);
    }
  }, [selectedZoneId, zonesQuery.data]);

  useEffect(() => {
    if (!selectedBinId && binsQuery.data && binsQuery.data.length > 0) {
      setSelectedBinId(String(binsQuery.data[0].id));
    }
  }, [selectedBinId, binsQuery.data]);

  const createOrderMutation = useMutation({
    mutationFn: createReturnOrder,
    onSuccess: async (order) => {
      await queryClient.invalidateQueries({ queryKey: ["return-orders"] });
      setSelectedOrderId(order.id);
      setNotes("");
      setSourceReference("");
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

  const dispatchExternalMutation = useMutation({
    mutationFn: ({
      orderId,
      itemId,
      externalPartner,
    }: {
      orderId: number;
      itemId: number;
      externalPartner?: string;
    }) =>
      dispatchReturnOrderItemExternal(orderId, itemId, {
        external_partner: externalPartner?.trim() || undefined,
      }),
    onSuccess: async (payload) => {
      await queryClient.invalidateQueries({ queryKey: ["return-order-items", selectedOrderId] });
      if (payload.document_id) {
        const blob = await downloadDocumentBlob(payload.document_id);
        const objectUrl = URL.createObjectURL(blob);
        window.open(objectUrl, "_blank", "noopener,noreferrer");
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      }
    },
  });

  const receiveExternalMutation = useMutation({
    mutationFn: ({
      orderId,
      itemId,
      targetBinId,
    }: {
      orderId: number;
      itemId: number;
      targetBinId: number;
    }) => receiveReturnOrderItemExternal(orderId, itemId, { target_bin_id: targetBinId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["return-order-items", selectedOrderId] });
    },
  });

  const selectedOrder = useMemo(
    () => ordersQuery.data?.find((order) => order.id === selectedOrderId) ?? null,
    [ordersQuery.data, selectedOrderId]
  );

  const allowedTransitions = selectedOrder ? transitionTargets[selectedOrder.status] ?? [] : [];

  const onCreateOrder = async (event: FormEvent) => {
    event.preventDefault();
    await createOrderMutation.mutateAsync({
      source_type: sourceType,
      source_reference: sourceReference.trim() || undefined,
      notes: notes.trim() || undefined,
    });
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
        repair_mode: decision === "repair" ? repairMode : undefined,
        external_partner:
          decision === "repair" && repairMode === "external" ? externalPartner.trim() || undefined : undefined,
        target_bin_id: selectedBinId ? Number(selectedBinId) : undefined,
      },
    });
  };

  return (
    <section className="page flex flex-col gap-6" data-testid="returns-page">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="page-title">Retourenmanagement</h2>
          <p className="section-subtitle mt-1 max-w-2xl">
            Erfassen und verwalten Sie Kundenretouren, steuern Sie den Prüfprozess und legen Sie die weitere Verwendung fest.
          </p>
        </div>
      </header>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* Panel 1: Retourenaufträge (List) */}
        <div className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm flex flex-col h-[calc(100vh-200px)] min-h-[500px]">
          <div className="p-4 border-b border-[var(--line)] bg-[var(--panel-soft)]">
            <h3 className="section-title flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-[var(--muted)]" />
              Aufträge
            </h3>
          </div>

          <div className="p-4 flex-1 overflow-hidden flex flex-col gap-4">
            {/* Create Form */}
            <form onSubmit={(event) => void onCreateOrder(event)} data-testid="return-order-create-form" className="flex flex-col gap-3">
              <select
                className="input w-full"
                value={sourceType}
                onChange={(event) => setSourceType(event.target.value as "customer" | "technician")}
                data-testid="return-order-source-type-select"
              >
                <option value="customer">Kunde</option>
                <option value="technician">Techniker</option>
              </select>

              <input
                className="input w-full"
                placeholder="Quelle Referenz (optional)"
                value={sourceReference}
                onChange={(event) => setSourceReference(event.target.value)}
                data-testid="return-order-source-reference-input"
              />

              <div className="flex gap-2">
                <input
                  className="input w-full min-w-0"
                  placeholder="Notiz / Referenz (Optional)"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  data-testid="return-order-notes-input"
                />
                <button
                  className="btn btn-primary shrink-0"
                  type="submit"
                  disabled={createOrderMutation.isPending}
                  data-testid="return-order-create-btn"
                >
                  Neu
                </button>
              </div>
            </form>

            {/* List */}
            <div className="flex-1 overflow-y-auto border border-[var(--line)] rounded-[var(--radius-sm)] bg-[var(--bg)]" data-testid="return-order-list">
              {(ordersQuery.data ?? []).length === 0 ? (
                <div className="p-8 text-center text-[var(--muted)] italic text-sm">
                  Keine Retouren gefunden.
                </div>
              ) : (
                <div className="divide-y divide-[var(--line)]">
                  {(ordersQuery.data ?? []).map((order) => (
                    <button
                      key={order.id}
                      className={`w-full text-left p-3 hover:bg-[var(--panel-soft)] transition-colors flex items-center justify-between gap-3 group
                        ${selectedOrderId === order.id ? "bg-[var(--panel-strong)] border-l-4 border-l-[var(--accent)] pl-[calc(0.75rem-4px)]" : "border-l-4 border-l-transparent"}
                      `}
                      onClick={() => setSelectedOrderId(order.id)}
                      data-testid={`return-order-item-${order.id}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-[var(--ink)] truncate">{order.return_number}</div>
                        <div className="text-xs text-[var(--muted)] flex items-center gap-1.5 mt-0.5">
                          <span className={`inline-block w-2 h-2 rounded-full 
                            ${order.status === 'resolved' ? 'bg-emerald-500' :
                              order.status === 'cancelled' ? 'bg-red-500' :
                                order.status === 'registered' ? 'bg-blue-500' : 'bg-amber-500'}
                          `}></span>
                          {order.status}
                        </div>
                      </div>
                      <ArrowRight className={`w-4 h-4 text-[var(--muted)] transition-transform ${selectedOrderId === order.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Panel 2: Positionen (Items) */}
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
                <form className="grid grid-cols-1 gap-4 mb-6 p-4 bg-[var(--panel-soft)] rounded-[var(--radius-md)] border border-[var(--line)]" onSubmit={(event) => void onCreateItem(event)} data-testid="return-order-item-form">
                  <div className="grid grid-cols-1 gap-2">
                    <label className="text-sm font-medium text-[var(--muted)]">Produkt</label>
                    <select
                      className="input w-full appearance-none"
                      value={productId}
                      onChange={(event) => setProductId(event.target.value)}
                      data-testid="return-order-item-product-select"
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

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid grid-cols-1 gap-2">
                      <label className="text-sm font-medium text-[var(--muted)]">Menge</label>
                      <input
                        className="input w-full"
                        type="number"
                        min="0.001"
                        step="0.001"
                        value={quantity}
                        onChange={(event) => setQuantity(event.target.value)}
                        data-testid="return-order-item-quantity-input"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      <label className="text-sm font-medium text-[var(--muted)]">Entscheidung</label>
                      <select
                        className="input w-full appearance-none"
                        value={decision}
                        onChange={(event) => setDecision(event.target.value as typeof decision)}
                        data-testid="return-order-item-decision-select"
                      >
                        {Object.entries(decisionLabels).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
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
                          onChange={(event) => setRepairMode(event.target.value as "internal" | "external")}
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
                            onChange={(event) => setExternalPartner(event.target.value)}
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
                        setSelectedWarehouseId(Number(event.target.value));
                        setSelectedZoneId(null);
                        setSelectedBinId("");
                      }}
                      data-testid="return-order-target-warehouse-select"
                    >
                      {(warehousesQuery.data ?? []).map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>
                          {warehouse.code}
                        </option>
                      ))}
                    </select>
                    <select
                      className="input w-full"
                      value={selectedZoneId ?? ""}
                      onChange={(event) => {
                        setSelectedZoneId(Number(event.target.value));
                        setSelectedBinId("");
                      }}
                      data-testid="return-order-target-zone-select"
                    >
                      <option value="">Zone...</option>
                      {(zonesQuery.data ?? []).map((zone) => (
                        <option key={zone.id} value={zone.id}>
                          {zone.code}
                        </option>
                      ))}
                    </select>
                    <select
                      className="input w-full"
                      value={selectedBinId}
                      onChange={(event) => setSelectedBinId(event.target.value)}
                      data-testid="return-order-target-bin-select"
                    >
                      <option value="">Ziel-Bin...</option>
                      {(binsQuery.data ?? []).map((bin) => (
                        <option key={bin.id} value={bin.id}>
                          {bin.code}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button className="btn w-full justify-center" type="submit" disabled={createItemMutation.isPending} data-testid="return-order-item-add-btn">
                    Position hinzufügen
                  </button>
                </form>

                <div className="flex-1 overflow-y-auto space-y-3 pr-1" data-testid="return-order-items-list">
                  {(itemsQuery.data ?? []).length === 0 ? (
                    <div className="text-center text-[var(--muted)] py-8 italic text-sm">Noch keine Positionen erfasst.</div>
                  ) : (
                    (itemsQuery.data ?? []).map((item) => (
                      <div className="p-3 border border-[var(--line)] rounded-[var(--radius-sm)] bg-[var(--bg)] hover:border-[var(--line-strong)] transition-colors min-w-0" key={item.id}>
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
                          {item.decision ? (decisionLabels[item.decision] ?? item.decision) : "-"}
                        </div>
                        {item.repair_mode ? (
                          <div className="mt-1 text-xs text-[var(--muted)]">
                            Reparaturmodus: {item.repair_mode}
                          </div>
                        ) : null}
                        {item.external_status ? (
                          <div
                            className="mt-1 text-xs text-[var(--muted)]"
                            data-testid={`return-order-item-external-status-${item.id}`}
                          >
                            Externer Status: {item.external_status}
                          </div>
                        ) : null}
                        {selectedOrder && item.decision === "repair" && item.repair_mode === "external" ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {item.external_status === "waiting_external_provider" ? (
                              <button
                                type="button"
                                className="btn btn-ghost text-xs"
                                onClick={() =>
                                  void dispatchExternalMutation.mutateAsync({
                                    orderId: selectedOrder.id,
                                    itemId: item.id,
                                    externalPartner: externalPartner || item.external_partner || undefined,
                                  })
                                }
                                disabled={dispatchExternalMutation.isPending}
                                data-testid={`return-order-item-dispatch-external-${item.id}`}
                              >
                                An externen Dienstleister senden
                              </button>
                            ) : null}
                            {item.external_status === "at_external_provider" ? (
                              <button
                                type="button"
                                className="btn btn-ghost text-xs"
                                onClick={() =>
                                  selectedBinId &&
                                  void receiveExternalMutation.mutateAsync({
                                    orderId: selectedOrder.id,
                                    itemId: item.id,
                                    targetBinId: Number(selectedBinId),
                                  })
                                }
                                disabled={receiveExternalMutation.isPending || !selectedBinId}
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

        {/* Panel 3: Workflow / Status */}
        <div className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm h-auto lg:h-[calc(100vh-200px)] lg:min-h-[500px]">
          <div className="p-4 border-b border-[var(--line)] bg-[var(--panel-soft)]">
            <h3 className="section-title flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[var(--muted)]" />
              Workflow
            </h3>
          </div>

          <div className="p-6">
            {!selectedOrder ? (
              <div className="flex flex-col items-center justify-center text-[var(--muted)] py-12 text-center">
                <FileText className="w-12 h-12 mb-3 opacity-20" />
                <p>Kein Auftrag ausgewählt.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <span className="text-xs uppercase tracking-wider text-[var(--muted)] font-bold block mb-2">Aktueller Status</span>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--panel-strong)] border border-[var(--line)] text-[var(--ink)] font-medium text-sm">
                    <span className={`w-2 h-2 rounded-full ${selectedOrder.status === 'resolved' ? 'bg-emerald-500' : 'bg-blue-500'}`}></span>
                    {selectedOrder.status.toUpperCase()}
                  </div>
                </div>

                <div className="border-t border-[var(--line)] pt-6">
                  <span className="text-xs uppercase tracking-wider text-[var(--muted)] font-bold block mb-4">Aktionen</span>

                  {allowedTransitions.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3">
                      {allowedTransitions.map((statusName) => (
                        <button
                          key={statusName}
                          className="btn w-full justify-start relative group"
                          onClick={() =>
                            void statusMutation.mutateAsync({
                              orderId: selectedOrder.id,
                              status: statusName,
                            })
                          }
                          disabled={statusMutation.isPending}
                          data-testid={`return-order-status-${statusName}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-full border border-[var(--line-strong)] flex items-center justify-center bg-[var(--panel)] group-hover:border-[var(--accent)] transition-colors">
                              <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            </div>
                            <span className="font-medium">Status setzen: {statusName}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 bg-[var(--bg)] border border-[var(--line)] rounded-[var(--radius-sm)] text-center">
                      <CheckCircle className="w-8 h-8 mx-auto text-emerald-500 mb-2 opacity-80" />
                      <p className="text-sm text-[var(--ink)] font-medium">Vorgang abgeschlossen</p>
                      <p className="text-xs text-[var(--muted)]">Keine weiteren Aktionen möglich.</p>
                    </div>
                  )}
                </div>

                {/* Information Block */}
                {selectedOrder.notes && (
                  <div className="border-t border-[var(--line)] pt-6">
                    <span className="text-xs uppercase tracking-wider text-[var(--muted)] font-bold block mb-2">Notizen</span>
                    <p className="text-sm text-[var(--ink)] bg-[var(--bg)] p-3 rounded-[var(--radius-sm)] border border-[var(--line)] text-wrap break-words min-w-0">
                      {selectedOrder.notes}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
