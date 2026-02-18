import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardList,
  Plus,
  RefreshCw,
  CheckCircle,
  Search,
  Target,
  Hash,
  Save,
  History,
  AlertCircle,
  BarChart3,
  Calculator,
  ChevronRight,
  Archive,
  FileText
} from "lucide-react";

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
    <section className="page" data-testid="inventory-count-page">
      <div className="space-y-8 max-w-[1600px] mx-auto">
        <header className="panel-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="page-title">Inventur</h2>
            <p className="section-subtitle mt-1">
              Stichtag- und permanente Inventur mit Nachzähl-Logik.
            </p>
          </div>
        </header>

        <div className="warehouse-grid grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Panel 1: Create Session & List */}
        <article className="subpanel bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm overflow-hidden flex flex-col h-full">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 flex items-center gap-2">
            <h3 className="section-title text-zinc-900 dark:text-zinc-100">1. Session anlegen</h3>
          </div>

          <div className="p-4 space-y-6 flex-1 flex flex-col">
            <form className="form-grid grid gap-4" onSubmit={(event) => void onCreateSession(event)} data-testid="inventory-count-create-form">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5 form-label-standard text-zinc-700 dark:text-zinc-300">
                  <span className="flex items-center gap-1.5"><History className="w-3.5 h-3.5" /> Inventurtyp</span>
                  <select
                    className="input h-10 px-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    value={sessionType}
                    onChange={(event) => setSessionType(event.target.value as "snapshot" | "cycle")}
                    data-testid="inventory-count-type-select"
                  >
                    <option value="snapshot">Stichtag</option>
                    <option value="cycle">Permanent</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 form-label-standard text-zinc-700 dark:text-zinc-300">
                  <span className="flex items-center gap-1.5"><Archive className="w-3.5 h-3.5" /> Lager</span>
                  <select
                    className="input h-10 px-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
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
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <label className="flex flex-col gap-1.5 form-label-standard text-zinc-700 dark:text-zinc-300">
                  <span className="flex items-center gap-1.5"><Target className="w-3.5 h-3.5" /> Toleranz</span>
                  <input
                    className="input h-10 px-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    type="number"
                    min="0"
                    step="0.001"
                    value={toleranceQuantity}
                    onChange={(event) => setToleranceQuantity(event.target.value)}
                    data-testid="inventory-count-tolerance-input"
                  />
                </label>
                <label className="flex flex-col gap-1.5 form-label-standard text-zinc-700 dark:text-zinc-300">
                  <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Notiz</span>
                  <input
                    className="input h-10 px-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    data-testid="inventory-count-notes-input"
                  />
                </label>
              </div>
              <button
                className="btn h-10 w-full rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                type="submit"
                disabled={createSessionMutation.isPending}
                data-testid="inventory-count-create-btn"
              >
                <Plus className="w-4 h-4" />
                Session erstellen
              </button>
            </form>

            <div className="list-stack small flex-1 overflow-y-auto min-h-[150px] border border-zinc-200 dark:border-zinc-700 rounded-lg divide-y divide-zinc-100 dark:divide-zinc-700 bg-zinc-50 dark:bg-zinc-900/30" data-testid="inventory-count-session-list">
              {(sessionsQuery.data ?? []).map((session) => (
                <button
                  key={session.id}
                  className={`list-item w-full text-left p-3 transition-colors flex items-center justify-between group ${
                    selectedSessionId === session.id
                      ? "active bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500"
                      : "hover:bg-zinc-100 dark:hover:bg-zinc-800 border-l-4 border-l-transparent"
                  }`}
                  onClick={() => setSelectedSessionId(session.id)}
                  data-testid={`inventory-count-session-${session.id}`}
                >
                  <div className="flex flex-col gap-1">
                    <strong className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{session.session_number}</strong>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                       <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide ${
                          session.status === "completed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                          session.status === "in_progress" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                          "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300"
                       }`}>
                         {session.status}
                       </span>
                       <span>{session.session_type}</span>
                    </span>
                  </div>
                  {selectedSessionId === session.id && <ChevronRight className="w-4 h-4 text-blue-500" />}
                </button>
              ))}
              {sessionsQuery.data?.length === 0 && (
                <div className="p-4 text-center text-sm text-zinc-500 dark:text-zinc-400 italic">Keine Sessions gefunden.</div>
              )}
            </div>
          </div>
        </article>

        {/* Panel 2: Actions & Summary */}
        <article className="subpanel bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm overflow-hidden flex flex-col h-full">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 flex items-center gap-2">
             <h3 className="section-title text-zinc-900 dark:text-zinc-100">2. Zählliste und Abschluss</h3>
          </div>

          <div className="p-4 space-y-6 flex-1 flex flex-col">
            {selectedSession ? (
              <>
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800/50">
                   <p className="text-sm text-blue-800 dark:text-blue-300 flex items-center gap-2" data-testid="inventory-count-selected-session">
                    <CheckCircle className="w-4 h-4" />
                    Aktive Session: <strong>{selectedSession.session_number}</strong>
                    <span className="opacity-75">({selectedSession.status})</span>
                   </p>
                </div>

                <div className="actions-cell flex flex-col gap-2">
                  <button
                    className="btn h-10 w-full rounded-lg bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() =>
                      void generateItemsMutation.mutateAsync({
                        sessionId: selectedSession.id,
                        refresh: false,
                      })
                    }
                    disabled={generateItemsMutation.isPending || selectedSession.status === "completed"}
                    data-testid="inventory-count-generate-btn"
                  >
                    <ClipboardList className="w-4 h-4" />
                    Zählliste generieren
                  </button>
                  <button
                    className="btn h-10 w-full rounded-lg bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() =>
                      void generateItemsMutation.mutateAsync({
                        sessionId: selectedSession.id,
                        refresh: true,
                      })
                    }
                    disabled={generateItemsMutation.isPending || selectedSession.status === "completed"}
                    data-testid="inventory-count-regenerate-btn"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Neu generieren
                  </button>
                  <button
                    className="btn h-10 w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => void completeMutation.mutateAsync(selectedSession.id)}
                    disabled={completeMutation.isPending || selectedSession.status === "completed"}
                    data-testid="inventory-count-complete-btn"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Session abschließen
                  </button>
                </div>

                <div className="kpi-grid compact grid grid-cols-3 gap-3 mt-auto">
                  <div className="kpi-card p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/30 text-center">
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 block mb-1">Positionen</span>
                    <strong className="text-lg font-bold text-zinc-900 dark:text-zinc-100" data-testid="inventory-count-summary-total">{summaryQuery.data?.total ?? "-"}</strong>
                  </div>
                  <div className="kpi-card p-3 rounded-lg border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-900/10 text-center">
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 block mb-1">Gezählt</span>
                    <strong className="text-lg font-bold text-emerald-700 dark:text-emerald-400" data-testid="inventory-count-summary-counted">{summaryQuery.data?.counted ?? "-"}</strong>
                  </div>
                  <div className="kpi-card p-3 rounded-lg border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-900/10 text-center">
                    <span className="text-xs font-medium text-rose-600 dark:text-rose-400 block mb-1">Nachzählung</span>
                    <strong className="text-lg font-bold text-rose-700 dark:text-rose-400" data-testid="inventory-count-summary-recount">{summaryQuery.data?.recount_required ?? "-"}</strong>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-zinc-500 dark:text-zinc-400 italic py-12">
                <ClipboardList className="w-12 h-12 opacity-20 mb-2" />
                <p>Bitte zuerst eine Session auswählen.</p>
              </div>
            )}
          </div>
        </article>

        {/* Panel 3: Scan / Quick Capture */}
        <article className="subpanel bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm overflow-hidden flex flex-col h-full">
           <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 flex items-center gap-2">
             <h3 className="section-title text-zinc-900 dark:text-zinc-100">3. Scan-/Schnellerfassung</h3>
          </div>

          <div className="p-4 space-y-6 flex-1">
            <div className="products-toolbar grid gap-4">
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  className="input input-leading-icon w-full h-10 pl-9 pr-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="Bin scannen oder eingeben"
                  value={scanBin}
                  onChange={(event) => setScanBin(event.target.value)}
                  data-testid="inventory-count-scan-bin-input"
                />
              </div>
              <div className="relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                 <input
                  className="input input-leading-icon w-full h-10 pl-9 pr-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="Artikelnummer scannen oder eingeben"
                  value={scanProduct}
                  onChange={(event) => setScanProduct(event.target.value)}
                  data-testid="inventory-count-scan-product-input"
                />
              </div>
            </div>

            {focusedQuickItem ? (
              <div className="workflow-block p-4 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 space-y-4" data-testid="inventory-count-quick-capture">
                <div>
                   <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Treffer</span>
                   <p className="mt-1 text-zinc-800 dark:text-zinc-200">
                    <strong className="text-blue-700 dark:text-blue-300">{focusedQuickItem.bin_code}</strong>
                    <span className="mx-2 text-zinc-400">|</span>
                    {focusedQuickItem.product_number}
                    <br/>
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">{focusedQuickItem.product_name}</span>
                  </p>
                </div>

                <div className="actions-cell grid grid-cols-2 gap-2">
                   <div className="relative">
                     <Calculator className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                     <input
                      className="input input-leading-icon w-full h-10 pl-9 pr-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-mono font-medium"
                      type="number"
                      min="0"
                      step="0.001"
                      value={quickQuantity}
                      onChange={(event) => setQuickQuantity(event.target.value)}
                      disabled={countActionsDisabled}
                      data-testid="inventory-count-quick-quantity-input"
                    />
                   </div>
                  <button
                    className="btn h-10 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => void saveQuickCount()}
                    disabled={countActionsDisabled}
                    data-testid="inventory-count-quick-save-btn"
                  >
                    <Save className="w-4 h-4" />
                    Speichern
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/30 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700">
                <Search className="w-8 h-8 opacity-20 mx-auto mb-2" />
                <p className="text-sm">Kein passender Treffer für aktuelle Scan-Filter.</p>
              </div>
            )}
          </div>
        </article>
      </div>

      {/* Main Table */}
      <article className="subpanel bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 flex items-center gap-2">
           <div className="p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-md text-zinc-700 dark:text-zinc-300">
             <BarChart3 className="w-4 h-4" />
           </div>
           <h3 className="section-title text-zinc-900 dark:text-zinc-100">4. Zählpositionen</h3>
        </div>

        <div className="table-wrap overflow-x-auto">
          <table className="products-table w-full text-left" data-testid="inventory-count-items-table">
            <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-700">
              <tr>
                <th className="table-head-standard px-6 py-4 text-zinc-500 dark:text-zinc-400">Bin</th>
                <th className="table-head-standard px-6 py-4 text-zinc-500 dark:text-zinc-400">Artikel</th>
                <th className="table-head-standard px-6 py-4 text-zinc-500 dark:text-zinc-400 text-right">Soll</th>
                <th className="table-head-standard px-6 py-4 text-zinc-500 dark:text-zinc-400 text-right w-32">Ist</th>
                <th className="table-head-standard px-6 py-4 text-zinc-500 dark:text-zinc-400 text-right">Differenz</th>
                <th className="table-head-standard px-6 py-4 text-zinc-500 dark:text-zinc-400 text-center">Nachzählung</th>
                <th className="table-head-standard px-6 py-4 text-zinc-500 dark:text-zinc-400 text-right">Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
              {filteredItems.map((item) => (
                <tr key={item.id} data-testid={`inventory-count-item-row-${item.id}`} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-zinc-900 dark:text-zinc-100 font-mono">{item.bin_code}</td>
                  <td className="px-6 py-4 text-sm text-zinc-700 dark:text-zinc-300">
                    <span className="block font-medium text-zinc-900 dark:text-zinc-100">{item.product_number}</span>
                    <small className="text-zinc-500 dark:text-zinc-400">{item.product_name}</small>
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-500 dark:text-zinc-400 text-right font-mono" data-testid={`inventory-count-item-snapshot-${item.id}`}>{item.snapshot_quantity}</td>
                  <td className="px-6 py-4 text-right">
                    <input
                      className="input h-9 w-24 text-right px-2 rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-mono"
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
                  <td className="px-6 py-4 text-sm text-right font-mono" data-testid={`inventory-count-item-diff-${item.id}`}>
                     <span className={`${
                        Number(item.difference_quantity) < 0 ? 'text-rose-600 font-bold' :
                        Number(item.difference_quantity) > 0 ? 'text-emerald-600 font-bold' :
                        'text-zinc-400'
                     }`}>
                        {item.difference_quantity && Number(item.difference_quantity) > 0 ? '+' : ''}
                        {item.difference_quantity ?? "-"}
                     </span>
                  </td>
                  <td className="px-6 py-4 text-center" data-testid={`inventory-count-item-recount-${item.id}`}>
                    {item.recount_required ? (
                       <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
                         <AlertCircle className="w-3 h-3 mr-1" /> Ja
                       </span>
                    ) : (
                       <span className="text-zinc-400 text-sm">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      className="btn h-8 px-3 rounded-md bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                      onClick={() => void saveRowCount(item)}
                      disabled={countActionsDisabled}
                      data-testid={`inventory-count-item-save-${item.id}`}
                    >
                      <Save className="w-3.5 h-3.5" />
                      Speichern
                    </button>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && !itemsQuery.isLoading && (
                 <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-zinc-500 dark:text-zinc-400">
                    <div className="flex flex-col items-center gap-2">
                      <ClipboardList className="w-8 h-8 opacity-20" />
                      <p>Keine Inventurpositionen verfügbar.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </article>
      </div>
    </section>
  );
}
