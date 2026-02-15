import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  completeInventoryCountSession,
  createInventoryCountSession,
  fetchInventoryCountItems,
  fetchInventoryCountSessions,
  fetchInventoryCountSummary,
  generateInventoryCountItems,
  updateInventoryCountItem,
} from "../services/inventoryCountsApi";
import { fetchWarehouses } from "../services/warehousesApi";
import type { InventoryCountItem } from "../types";

export default function InventoryCountPage() {
  const queryClient = useQueryClient();

  const [sessionType, setSessionType] = useState<"snapshot" | "cycle">("snapshot");
  const [warehouseId, setWarehouseId] = useState("");
  const [toleranceQuantity, setToleranceQuantity] = useState("0");
  const [notes, setNotes] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);

  const [scanBin, setScanBin] = useState("");
  const [scanProduct, setScanProduct] = useState("");
  const [quickQuantity, setQuickQuantity] = useState("0");

  const [rowCounts, setRowCounts] = useState<Record<number, string>>({});

  const sessionsQuery = useQuery({
    queryKey: ["inventory-count-sessions"],
    queryFn: () => fetchInventoryCountSessions(),
  });

  const warehousesQuery = useQuery({
    queryKey: ["warehouses", "inventory-counts"],
    queryFn: fetchWarehouses,
  });

  const itemsQuery = useQuery({
    queryKey: ["inventory-count-items", selectedSessionId],
    queryFn: () => fetchInventoryCountItems(selectedSessionId as number),
    enabled: selectedSessionId !== null,
  });

  const summaryQuery = useQuery({
    queryKey: ["inventory-count-summary", selectedSessionId],
    queryFn: () => fetchInventoryCountSummary(selectedSessionId as number),
    enabled: selectedSessionId !== null,
    refetchInterval: 15_000,
  });

  const selectedSession = useMemo(
    () => sessionsQuery.data?.find((session) => session.id === selectedSessionId) ?? null,
    [sessionsQuery.data, selectedSessionId]
  );

  const filteredItems = useMemo(() => {
    const items = itemsQuery.data ?? [];
    const binTerm = scanBin.trim().toLowerCase();
    const productTerm = scanProduct.trim().toLowerCase();
    return items.filter((item) => {
      const binMatch = !binTerm || item.bin_code.toLowerCase().includes(binTerm);
      const productMatch =
        !productTerm ||
        item.product_number.toLowerCase().includes(productTerm) ||
        item.product_name.toLowerCase().includes(productTerm);
      return binMatch && productMatch;
    });
  }, [itemsQuery.data, scanBin, scanProduct]);

  const focusedQuickItem: InventoryCountItem | null = filteredItems[0] ?? null;

  const createSessionMutation = useMutation({
    mutationFn: createInventoryCountSession,
    onSuccess: async (session) => {
      setNotes("");
      setToleranceQuantity("0");
      setWarehouseId("");
      await queryClient.invalidateQueries({ queryKey: ["inventory-count-sessions"] });
      setSelectedSessionId(session.id);
    },
  });

  const generateItemsMutation = useMutation({
    mutationFn: ({ sessionId, refresh }: { sessionId: number; refresh: boolean }) =>
      generateInventoryCountItems(sessionId, refresh),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["inventory-count-sessions"] });
      await queryClient.invalidateQueries({ queryKey: ["inventory-count-items", selectedSessionId] });
      await queryClient.invalidateQueries({ queryKey: ["inventory-count-summary", selectedSessionId] });
    },
  });

  const countItemMutation = useMutation({
    mutationFn: ({ sessionId, itemId, countedQuantity }: { sessionId: number; itemId: number; countedQuantity: string }) =>
      updateInventoryCountItem(sessionId, itemId, countedQuantity),
    onSuccess: async (item) => {
      setRowCounts((prev) => ({ ...prev, [item.id]: item.counted_quantity ?? "0" }));
      await queryClient.invalidateQueries({ queryKey: ["inventory-count-items", selectedSessionId] });
      await queryClient.invalidateQueries({ queryKey: ["inventory-count-summary", selectedSessionId] });
    },
  });

  const countActionsDisabled =
    countItemMutation.isPending || !selectedSessionId || generateItemsMutation.isPending || itemsQuery.isFetching;

  const completeMutation = useMutation({
    mutationFn: completeInventoryCountSession,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["inventory-count-sessions"] });
      await queryClient.invalidateQueries({ queryKey: ["inventory-count-items", selectedSessionId] });
      await queryClient.invalidateQueries({ queryKey: ["inventory-count-summary", selectedSessionId] });
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
      await queryClient.invalidateQueries({ queryKey: ["inventory-summary"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });

  const onCreateSession = async (event: FormEvent) => {
    event.preventDefault();
    await createSessionMutation.mutateAsync({
      session_type: sessionType,
      warehouse_id: warehouseId ? Number(warehouseId) : undefined,
      tolerance_quantity: toleranceQuantity,
      notes: notes.trim() || undefined,
    });
  };

  const saveRowCount = async (item: InventoryCountItem) => {
    if (!selectedSessionId) return;
    const value = rowCounts[item.id] ?? item.counted_quantity ?? "0";
    await countItemMutation.mutateAsync({
      sessionId: selectedSessionId,
      itemId: item.id,
      countedQuantity: value,
    });
  };

  const saveQuickCount = async () => {
    if (!selectedSessionId || !focusedQuickItem) return;
    await countItemMutation.mutateAsync({
      sessionId: selectedSessionId,
      itemId: focusedQuickItem.id,
      countedQuantity: quickQuantity,
    });
  };

  return (
    <section className="panel" data-testid="inventory-count-page">
      <header className="panel-header">
        <div>
          <h2>Inventur</h2>
          <p className="panel-subtitle">Stichtag- und permanente Inventur mit Nachzähl-Logik.</p>
        </div>
      </header>

      <div className="warehouse-grid">
        <article className="subpanel">
          <h3>1. Session anlegen</h3>
          <form className="form-grid" onSubmit={(event) => void onCreateSession(event)} data-testid="inventory-count-create-form">
            <label>
              Inventurtyp
              <select
                className="input"
                value={sessionType}
                onChange={(event) => setSessionType(event.target.value as "snapshot" | "cycle")}
                data-testid="inventory-count-type-select"
              >
                <option value="snapshot">Stichtag</option>
                <option value="cycle">Permanent</option>
              </select>
            </label>
            <label>
              Lager (optional)
              <select
                className="input"
                value={warehouseId}
                onChange={(event) => setWarehouseId(event.target.value)}
                data-testid="inventory-count-warehouse-select"
              >
                <option value="">Alle Lager</option>
                {(warehousesQuery.data ?? []).map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.code} - {warehouse.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Toleranzmenge
              <input
                className="input"
                type="number"
                min="0"
                step="0.001"
                value={toleranceQuantity}
                onChange={(event) => setToleranceQuantity(event.target.value)}
                data-testid="inventory-count-tolerance-input"
              />
            </label>
            <label>
              Notiz
              <input
                className="input"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                data-testid="inventory-count-notes-input"
              />
            </label>
            <button className="btn" type="submit" disabled={createSessionMutation.isPending} data-testid="inventory-count-create-btn">
              Session erstellen
            </button>
          </form>
          <div className="list-stack small" data-testid="inventory-count-session-list">
            {(sessionsQuery.data ?? []).map((session) => (
              <button
                key={session.id}
                className={`list-item ${selectedSessionId === session.id ? "active" : ""}`}
                onClick={() => setSelectedSessionId(session.id)}
                data-testid={`inventory-count-session-${session.id}`}
              >
                <strong>{session.session_number}</strong>
                <span>
                  {session.session_type} | {session.status}
                </span>
              </button>
            ))}
          </div>
        </article>

        <article className="subpanel">
          <h3>2. Zählliste und Abschluss</h3>
          {selectedSession ? (
            <>
              <p data-testid="inventory-count-selected-session">
                Aktive Session: <strong>{selectedSession.session_number}</strong> ({selectedSession.status})
              </p>
              <div className="actions-cell">
                <button
                  className="btn"
                  onClick={() =>
                    void generateItemsMutation.mutateAsync({
                      sessionId: selectedSession.id,
                      refresh: false,
                    })
                  }
                  disabled={generateItemsMutation.isPending || selectedSession.status === "completed"}
                  data-testid="inventory-count-generate-btn"
                >
                  Zählliste generieren
                </button>
                <button
                  className="btn"
                  onClick={() =>
                    void generateItemsMutation.mutateAsync({
                      sessionId: selectedSession.id,
                      refresh: true,
                    })
                  }
                  disabled={generateItemsMutation.isPending || selectedSession.status === "completed"}
                  data-testid="inventory-count-regenerate-btn"
                >
                  Neu generieren
                </button>
                <button
                  className="btn"
                  onClick={() => void completeMutation.mutateAsync(selectedSession.id)}
                  disabled={completeMutation.isPending || selectedSession.status === "completed"}
                  data-testid="inventory-count-complete-btn"
                >
                  Session abschließen
                </button>
              </div>
              <div className="kpi-grid compact">
                <div className="kpi-card">
                  <span>Positionen</span>
                  <strong data-testid="inventory-count-summary-total">{summaryQuery.data?.total ?? "-"}</strong>
                </div>
                <div className="kpi-card">
                  <span>Gezählt</span>
                  <strong data-testid="inventory-count-summary-counted">{summaryQuery.data?.counted ?? "-"}</strong>
                </div>
                <div className="kpi-card">
                  <span>Nachzählung</span>
                  <strong data-testid="inventory-count-summary-recount">{summaryQuery.data?.recount_required ?? "-"}</strong>
                </div>
              </div>
            </>
          ) : (
            <p>Bitte zuerst eine Session auswählen.</p>
          )}
        </article>
      </div>

      <article className="subpanel">
        <h3>3. Scan-/Schnellerfassung</h3>
        <div className="products-toolbar">
          <input
            className="input"
            placeholder="Bin scannen oder eingeben"
            value={scanBin}
            onChange={(event) => setScanBin(event.target.value)}
            data-testid="inventory-count-scan-bin-input"
          />
          <input
            className="input"
            placeholder="Artikelnummer scannen oder eingeben"
            value={scanProduct}
            onChange={(event) => setScanProduct(event.target.value)}
            data-testid="inventory-count-scan-product-input"
          />
        </div>
        {focusedQuickItem ? (
          <div className="workflow-block" data-testid="inventory-count-quick-capture">
            <p>
              <strong>{focusedQuickItem.bin_code}</strong> | {focusedQuickItem.product_number} - {focusedQuickItem.product_name}
            </p>
            <div className="actions-cell">
              <input
                className="input"
                type="number"
                min="0"
                step="0.001"
                value={quickQuantity}
                onChange={(event) => setQuickQuantity(event.target.value)}
                disabled={countActionsDisabled}
                data-testid="inventory-count-quick-quantity-input"
              />
              <button
                className="btn"
                onClick={() => void saveQuickCount()}
                disabled={countActionsDisabled}
                data-testid="inventory-count-quick-save-btn"
              >
                Schnell speichern
              </button>
            </div>
          </div>
        ) : (
          <p>Kein passender Treffer für aktuelle Scan-Filter.</p>
        )}
      </article>

      <article className="subpanel">
        <h3>4. Zählpositionen</h3>
        <div className="table-wrap">
          <table className="products-table" data-testid="inventory-count-items-table">
            <thead>
              <tr>
                <th>Bin</th>
                <th>Artikel</th>
                <th>Soll</th>
                <th>Ist</th>
                <th>Differenz</th>
                <th>Nachzählung</th>
                <th>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id} data-testid={`inventory-count-item-row-${item.id}`}>
                  <td>{item.bin_code}</td>
                  <td>
                    {item.product_number}
                    <br />
                    <small>{item.product_name}</small>
                  </td>
                  <td data-testid={`inventory-count-item-snapshot-${item.id}`}>{item.snapshot_quantity}</td>
                  <td>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.001"
                      value={rowCounts[item.id] ?? item.counted_quantity ?? ""}
                      onChange={(event) =>
                        setRowCounts((prev) => ({
                          ...prev,
                          [item.id]: event.target.value,
                        }))
                      }
                      disabled={countActionsDisabled}
                      data-testid={`inventory-count-item-qty-${item.id}`}
                    />
                  </td>
                  <td data-testid={`inventory-count-item-diff-${item.id}`}>{item.difference_quantity ?? "-"}</td>
                  <td data-testid={`inventory-count-item-recount-${item.id}`}>{item.recount_required ? "Ja" : "Nein"}</td>
                  <td>
                    <button
                      className="btn"
                      onClick={() => void saveRowCount(item)}
                      disabled={countActionsDisabled}
                      data-testid={`inventory-count-item-save-${item.id}`}
                    >
                      Speichern
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredItems.length === 0 && !itemsQuery.isLoading ? <p>Keine Inventurpositionen verfügbar.</p> : null}
        </div>
      </article>
    </section>
  );
}
