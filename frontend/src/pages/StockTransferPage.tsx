import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, ChevronRight, CheckCircle, Clock, Ban, Scan, ArrowRight, Save, X, Box } from "lucide-react";

import ScanFeedback from "../components/scanner/ScanFeedback";
import WorkflowScanInput from "../components/scanner/WorkflowScanInput";
import { fetchInventoryByBin } from "../services/inventoryApi";
import {
  cancelStockTransfer,
  completeStockTransfer,
  createStockTransfer,
  createStockTransferItem,
  fetchStockTransferItems,
  fetchStockTransfers,
} from "../services/operationsApi";
import { fetchAllProducts, fetchProductByEan, fetchProductByQr } from "../services/productsApi";
import { fetchBinByQr, fetchBins, fetchWarehouses, fetchZones } from "../services/warehousesApi";
import type { BinLocation, InventoryByBinItem, Product } from "../types";
import { parseScanValue } from "../utils/scannerUtils";

type TransferFlowStep = "source_bin_scan" | "product_scan" | "quantity" | "target_bin_scan" | "confirm";

const flowSteps: Array<{ id: TransferFlowStep; label: string }> = [
  { id: "source_bin_scan", label: "Quelle" },
  { id: "product_scan", label: "Artikel" },
  { id: "quantity", label: "Menge" },
  { id: "target_bin_scan", label: "Ziel" },
  { id: "confirm", label: "Bestätigen" },
];

export default function StockTransferPage() {
  const queryClient = useQueryClient();

  const [notes, setNotes] = useState("");
  const [selectedTransferId, setSelectedTransferId] = useState<number | null>(null);

  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("1");

  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);

  const [fromBinId, setFromBinId] = useState("");
  const [toBinId, setToBinId] = useState("");

  const [flowStep, setFlowStep] = useState<TransferFlowStep>("source_bin_scan");
  const [flowSourceBin, setFlowSourceBin] = useState<BinLocation | null>(null);
  const [flowTargetBin, setFlowTargetBin] = useState<BinLocation | null>(null);
  const [flowProduct, setFlowProduct] = useState<Product | null>(null);
  const [flowStockItem, setFlowStockItem] = useState<InventoryByBinItem | null>(null);
  const [flowStockBySource, setFlowStockBySource] = useState<InventoryByBinItem[]>([]);
  const [flowQuantity, setFlowQuantity] = useState("1");
  const [flowLoading, setFlowLoading] = useState(false);
  const [flowFeedbackStatus, setFlowFeedbackStatus] = useState<"idle" | "success" | "error">("idle");
  const [flowFeedbackMessage, setFlowFeedbackMessage] = useState<string | null>(null);

  const transfersQuery = useQuery({
    queryKey: ["stock-transfers"],
    queryFn: () => fetchStockTransfers(),
  });

  const transferItemsQuery = useQuery({
    queryKey: ["stock-transfer-items", selectedTransferId],
    queryFn: () => fetchStockTransferItems(selectedTransferId as number),
    enabled: selectedTransferId !== null,
  });

  const productsQuery = useQuery({
    queryKey: ["products", "stock-transfer-picker"],
    queryFn: () => fetchAllProducts(),
  });

  const warehousesQuery = useQuery({
    queryKey: ["warehouses", "stock-transfer-picker"],
    queryFn: fetchWarehouses,
  });

  const zonesQuery = useQuery({
    queryKey: ["zones", "stock-transfer-picker", selectedWarehouseId],
    queryFn: () => fetchZones(selectedWarehouseId as number),
    enabled: selectedWarehouseId !== null,
  });

  const binsQuery = useQuery({
    queryKey: ["bins", "stock-transfer-picker", selectedZoneId],
    queryFn: () => fetchBins(selectedZoneId as number),
    enabled: selectedZoneId !== null,
  });

  const createTransferMutation = useMutation({
    mutationFn: createStockTransfer,
    onSuccess: async (transfer) => {
      setNotes("");
      await queryClient.invalidateQueries({ queryKey: ["stock-transfers"] });
      setSelectedTransferId(transfer.id);
    },
  });

  const createItemMutation = useMutation({
    mutationFn: ({
      transferId,
      productId,
      quantityValue,
      fromBin,
      toBin,
    }: {
      transferId: number;
      productId: number;
      quantityValue: string;
      fromBin: number;
      toBin: number;
    }) =>
      createStockTransferItem(transferId, {
        product_id: productId,
        quantity: quantityValue,
        from_bin_id: fromBin,
        to_bin_id: toBin,
        unit: "piece",
      }),
    onSuccess: async () => {
      setQuantity("1");
      await queryClient.invalidateQueries({ queryKey: ["stock-transfer-items", selectedTransferId] });
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: completeStockTransfer,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["stock-transfers"] });
      await queryClient.invalidateQueries({ queryKey: ["stock-transfer-items", selectedTransferId] });
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelStockTransfer,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["stock-transfers"] });
      await queryClient.invalidateQueries({ queryKey: ["stock-transfer-items", selectedTransferId] });
    },
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
    if (!fromBinId && binsQuery.data && binsQuery.data.length > 0) {
      setFromBinId(String(binsQuery.data[0].id));
      if (binsQuery.data.length > 1) {
        setToBinId(String(binsQuery.data[1].id));
      } else {
        setToBinId(String(binsQuery.data[0].id));
      }
    }
  }, [fromBinId, binsQuery.data]);

  useEffect(() => {
    if (!selectedProductId && productsQuery.data?.items.length) {
      setSelectedProductId(String(productsQuery.data.items[0].id));
    }
  }, [selectedProductId, productsQuery.data]);

  const selectedTransfer = useMemo(
    () => transfersQuery.data?.find((item) => item.id === selectedTransferId) ?? null,
    [transfersQuery.data, selectedTransferId]
  );

  const flowStepIndex = flowSteps.findIndex((step) => step.id === flowStep);
  const flowProgress = ((flowStepIndex + 1) / flowSteps.length) * 100;

  const setFlowFeedback = (status: "idle" | "success" | "error", message: string | null) => {
    setFlowFeedbackStatus(status);
    setFlowFeedbackMessage(message);
  };

  const resetFlow = () => {
    setFlowStep("source_bin_scan");
    setFlowSourceBin(null);
    setFlowTargetBin(null);
    setFlowProduct(null);
    setFlowStockItem(null);
    setFlowStockBySource([]);
    setFlowQuantity("1");
    setFlowFeedback("idle", null);
  };

  const resolveProductFromScan = async (scanInput: string): Promise<Product> => {
    const parsed = parseScanValue(scanInput);

    if (parsed.type === "ean") {
      return fetchProductByEan(parsed.value);
    }

    if (parsed.type === "product_qr") {
      try {
        return await fetchProductByQr(parsed.normalized);
      } catch {
        const byNumber = (productsQuery.data?.items ?? []).find(
          (item) => item.product_number === parsed.value || item.product_number === parsed.normalized
        );
        if (byNumber) {
          return byNumber;
        }
      }
    }

    try {
      return await fetchProductByQr(parsed.normalized);
    } catch {
      const byNumber = (productsQuery.data?.items ?? []).find((item) => item.product_number === parsed.normalized);
      if (!byNumber) {
        throw new Error("Produkt konnte aus dem Scan nicht aufgelöst werden");
      }
      return byNumber;
    }
  };

  const resolveBinFromScan = async (scanInput: string): Promise<BinLocation> => {
    const parsed = parseScanValue(scanInput);

    if (parsed.type === "bin_qr") {
      return fetchBinByQr(parsed.normalized);
    }

    try {
      return await fetchBinByQr(parsed.normalized);
    } catch {
      const byCode = (binsQuery.data ?? []).find((bin) => bin.code === parsed.normalized);
      if (!byCode) {
        throw new Error("Lagerplatz konnte aus dem Scan nicht aufgelöst werden");
      }
      return byCode;
    }
  };

  const onFlowSourceBinScan = async (value: string) => {
    setFlowLoading(true);
    try {
      const sourceBin = await resolveBinFromScan(value);
      const stockItems = await fetchInventoryByBin(sourceBin.id);

      setFlowSourceBin(sourceBin);
      setFlowStockBySource(stockItems);
      setFromBinId(String(sourceBin.id));

      if (stockItems.length === 0) {
        setFlowFeedback("error", "Auf dem gescannten Quell-Lagerplatz ist kein Bestand vorhanden");
        return;
      }

      setFlowStep("product_scan");
      setFlowFeedback("success", `Quelle erkannt: ${sourceBin.code}`);
    } catch {
      setFlowFeedback("error", "Quell-Lagerplatzscan fehlgeschlagen");
    } finally {
      setFlowLoading(false);
    }
  };

  const onFlowProductScan = async (value: string) => {
    setFlowLoading(true);
    try {
      const product = await resolveProductFromScan(value);
      const matchingStock = flowStockBySource.find((item) => item.product_id === product.id);

      if (!matchingStock) {
        setFlowFeedback("error", "Gescanntes Produkt ist auf dem Quell-Lagerplatz nicht vorhanden");
        return;
      }

      setFlowProduct(product);
      setFlowStockItem(matchingStock);
      setSelectedProductId(String(product.id));
      setFlowStep("quantity");
      setFlowFeedback("success", `Produkt erkannt: ${product.product_number}`);
    } catch {
      setFlowFeedback("error", "Produktscan fehlgeschlagen");
    } finally {
      setFlowLoading(false);
    }
  };

  const onFlowTargetBinScan = async (value: string) => {
    setFlowLoading(true);
    try {
      const targetBin = await resolveBinFromScan(value);

      if (flowSourceBin && targetBin.id === flowSourceBin.id) {
        setFlowFeedback("error", "Quelle und Ziel dürfen nicht identisch sein");
        return;
      }

      setFlowTargetBin(targetBin);
      setToBinId(String(targetBin.id));
      setFlowStep("confirm");
      setFlowFeedback("success", `Ziel erkannt: ${targetBin.code}`);
    } catch {
      setFlowFeedback("error", "Ziel-Lagerplatzscan fehlgeschlagen");
    } finally {
      setFlowLoading(false);
    }
  };

  const availableStock = flowStockItem
    ? Number(flowStockItem.quantity) - Number(flowStockItem.reserved_quantity)
    : 0;
  const transferQty = Number(flowQuantity || 0);
  const remainingAfterTransfer = availableStock - transferQty;

  const onCreateTransfer = async (event: FormEvent) => {
    event.preventDefault();
    await createTransferMutation.mutateAsync({ notes: notes.trim() || undefined });
  };

  const onAddItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedTransferId || !selectedProductId || !fromBinId || !toBinId) {
      return;
    }
    await createItemMutation.mutateAsync({
      transferId: selectedTransferId,
      productId: Number(selectedProductId),
      quantityValue: quantity,
      fromBin: Number(fromBinId),
      toBin: Number(toBinId),
    });
  };

  const onConfirmFlowItem = async () => {
    if (!selectedTransferId || !flowSourceBin || !flowTargetBin || !flowProduct) {
      setFlowFeedback("error", "Bitte zuerst Transfer-Header, Quelle, Produkt und Ziel erfassen");
      return;
    }

    if (transferQty <= 0 || Number.isNaN(transferQty)) {
      setFlowFeedback("error", "Bitte eine gültige Menge > 0 erfassen");
      return;
    }

    if (transferQty > availableStock) {
      setFlowFeedback("error", "Menge überschreitet verfügbaren Quellbestand");
      return;
    }

    await createItemMutation.mutateAsync({
      transferId: selectedTransferId,
      productId: flowProduct.id,
      quantityValue: flowQuantity,
      fromBin: flowSourceBin.id,
      toBin: flowTargetBin.id,
    });

    setFlowFeedback("success", "Position erfasst");
    resetFlow();
  };

  return (
    <section className="page flex flex-col gap-6" data-testid="stock-transfer-page">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="page-title">Umlagerung</h2>
          <p className="section-subtitle mt-1">Transferbeleg anlegen und Warenbewegungen erfassen.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Step 1: Document Management */}
        <section className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b border-[var(--line)] bg-[var(--panel-soft)]">
            <h3 className="section-title flex items-center gap-2">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[var(--accent)] text-white text-xs font-bold">1</div>
              Belegverwaltung
            </h3>
          </div>

          <div className="p-4 space-y-6 flex-1 overflow-y-auto">
            <form className="space-y-3" onSubmit={(event) => void onCreateTransfer(event)}>
              <div className="space-y-1.5">
                <label className="form-label-standard uppercase tracking-wider">Notiz (Optional)</label>
                <input
                  className="input w-full"
                  placeholder="z.B. Monatliche Umlagerung"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>
              <button className="btn btn-primary w-full justify-center" type="submit" disabled={createTransferMutation.isPending}>
                {createTransferMutation.isPending ? "Erstelle..." : "Neuen Beleg erstellen"}
              </button>
            </form>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Offene Transfers</h4>
              <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {(transfersQuery.data ?? []).length === 0 ? (
                  <p className="text-sm text-[var(--muted)] italic py-2">Keine offenen Transfers.</p>
                ) : (
                  (transfersQuery.data ?? []).map((transfer) => (
                    <button
                      key={transfer.id}
                      className={`w-full text-left p-3 rounded-[var(--radius-sm)] border text-sm transition-all hover:shadow-sm ${selectedTransferId === transfer.id
                        ? "bg-[var(--panel-strong)] border-[var(--accent)] ring-1 ring-[var(--accent)]"
                        : "bg-[var(--panel)] border-[var(--line)] hover:bg-[var(--panel-soft)]"
                        }`}
                      onClick={() => setSelectedTransferId(transfer.id)}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold font-mono text-[var(--accent)] truncate min-w-0 flex-1 mr-2">
                          {transfer.transfer_number}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider border
                                   ${transfer.status === 'completed'
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800"
                            : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800"
                          }
                                `}>
                          {transfer.status}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-[var(--muted)]">
                        <span className="truncate min-w-0">{transfer.notes || "Keine Notiz"}</span>
                        <span>#{transfer.id}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {selectedTransfer && (
              <div className="pt-4 border-t border-[var(--line)] mt-auto grid grid-cols-2 gap-3">
                <button
                  className="btn w-full justify-center text-xs hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400 dark:hover:border-emerald-800"
                  disabled={selectedTransfer.status !== "draft" || completeMutation.isPending}
                  onClick={() => selectedTransferId && void completeMutation.mutateAsync(selectedTransferId)}
                >
                  <CheckCircle className="w-3.5 h-3.5 mr-1" />
                  Abschließen
                </button>
                <button
                  className="btn w-full justify-center text-xs hover:bg-red-50 hover:text-red-700 hover:border-red-200 dark:hover:bg-red-900/20 dark:hover:text-red-400 dark:hover:border-red-800"
                  disabled={selectedTransfer.status !== "draft" || cancelMutation.isPending}
                  onClick={() => selectedTransferId && void cancelMutation.mutateAsync(selectedTransferId)}
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  Stornieren
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Step 2: Scanner Workflow */}
        <section className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b border-[var(--line)] bg-[var(--panel-soft)]">
            <h3 className="section-title flex items-center gap-2">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[var(--accent)] text-white text-xs font-bold">2</div>
              Scanner Workflow
              {selectedTransferId && (
                <span className="ml-auto text-xs font-mono bg-[var(--bg)] px-2 py-1 rounded border border-[var(--line)] text-[var(--muted)]">
                  #{selectedTransferId}
                </span>
              )}
            </h3>
          </div>

          <div className="p-4 space-y-6 flex-1 overflow-y-auto">
            {!selectedTransferId ? (
              <div className="flex flex-col items-center justify-center p-8 text-center h-48 border-2 border-dashed border-[var(--line)] rounded-[var(--radius-md)] bg-[var(--bg)]">
                <Box className="w-10 h-10 text-[var(--muted)] opacity-40 mb-3" />
                <p className="text-[var(--muted)] font-medium">Kein Beleg ausgewählt</p>
                <p className="text-xs text-[var(--muted)] mt-1 opacity-70">Wählen Sie links einen Beleg aus.</p>
              </div>
            ) : selectedTransfer?.status !== "draft" ? (
              <div className="flex flex-col items-center justify-center p-8 text-center h-48 border-2 border-dashed border-[var(--line)] rounded-[var(--radius-md)] bg-[var(--bg)]">
                <CheckCircle className="w-10 h-10 text-emerald-500 mb-3" />
                <p className="text-[var(--ink)] font-medium">Transfer abgeschlossen</p>
              </div>
            ) : (
              <>
                {/* Progress Bar */}
                <div className="space-y-4">
                  <div className="h-1.5 w-full bg-[var(--line)] rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--accent)] transition-all duration-300 ease-out" style={{ width: `${flowProgress}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-[var(--muted)] font-medium uppercase tracking-wider">
                    <span>Start</span>
                    <span>Bestätigung</span>
                  </div>
                </div>

                <div className="bg-[var(--panel-soft)] rounded-[var(--radius-md)] p-4 min-h-[220px] flex flex-col justify-center border border-[var(--line)]">
                  {flowStep === "source_bin_scan" && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                      <WorkflowScanInput enabled isLoading={flowLoading} label="1. Quelle scannen" placeholder="Lagerplatz-Code..." onScan={onFlowSourceBinScan} testIdPrefix="stock-transfer-source-scan" />
                      <p className="text-xs text-[var(--muted)] text-center">Scannen Sie den Lagerplatz zur Entnahme.</p>
                    </div>
                  )}

                  {flowStep === "product_scan" && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                      <WorkflowScanInput enabled isLoading={flowLoading} label="2. Artikel scannen" placeholder="EAN / Nummer..." onScan={onFlowProductScan} testIdPrefix="stock-transfer-product-scan" />
                      <div className="p-3 bg-[var(--panel)] rounded border border-[var(--line)] text-sm shadow-sm">
                        <span className="block text-xs text-[var(--muted)] mb-1 uppercase tracking-wider">Aktuelle Quelle</span>
                        <span className="font-mono font-medium text-[var(--ink)] flex items-center gap-2">
                          <Box className="w-3.5 h-3.5 text-[var(--accent)]" />
                          {flowSourceBin?.code}
                        </span>
                      </div>
                    </div>
                  )}

                  {flowStep === "quantity" && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                      <div>
                        <label className="block text-sm font-medium text-[var(--ink)] mb-2">3. Menge eingeben</label>
                        <div className="flex gap-2">
                          <input
                            className="input text-lg font-mono flex-1 text-center font-bold"
                            type="number" min="0.001" step="0.001"
                            value={flowQuantity}
                            onChange={(e) => setFlowQuantity(e.target.value)}
                            autoFocus
                          />
                          <button className="btn btn-primary px-6" onClick={() => setFlowStep("target_bin_scan")}>
                            <ArrowRight className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs px-1">
                        <span className="text-[var(--muted)]">Verfügbar: <strong className="text-[var(--ink)]">{availableStock.toFixed(3)}</strong></span>
                        <span className="text-[var(--muted)]">Einheit: Stk</span>
                      </div>
                    </div>
                  )}

                  {flowStep === "target_bin_scan" && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                      <WorkflowScanInput enabled isLoading={flowLoading} label="4. Ziel scannen" placeholder="Lagerplatz-Code..." onScan={onFlowTargetBinScan} testIdPrefix="stock-transfer-target-scan" />
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="p-2 border border-[var(--line)] rounded bg-[var(--panel)]">
                          <span className="text-[var(--muted)] block uppercase tracking-wider text-[10px] mb-0.5">Menge</span>
                          <strong className="font-mono text-sm text-[var(--ink)]">{flowQuantity}</strong>
                        </div>
                        <div className="p-2 border border-[var(--line)] rounded bg-[var(--panel)]">
                          <span className="text-[var(--muted)] block uppercase tracking-wider text-[10px] mb-0.5">Artikel</span>
                          <strong className="font-mono text-sm text-[var(--ink)] truncate block">{flowProduct?.product_number}</strong>
                        </div>
                      </div>
                    </div>
                  )}

                  {flowStep === "confirm" && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                      <div className="space-y-2 bg-[var(--bg)] p-3 rounded border border-[var(--line)] text-sm">
                        <div className="flex justify-between py-1 border-b border-[var(--line)]">
                          <span className="text-[var(--muted)]">Von</span>
                          <span className="font-mono font-medium">{flowSourceBin?.code}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-[var(--line)]">
                          <span className="text-[var(--muted)]">Nach</span>
                          <span className="font-mono font-medium text-[var(--accent)]">{flowTargetBin?.code}</span>
                        </div>
                        <div className="flex justify-between py-1 pt-2">
                          <span className="font-medium">Menge</span>
                          <span className="font-mono font-bold text-lg">{flowQuantity}</span>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button className="btn flex-1 justify-center" onClick={resetFlow}>Abbrechen</button>
                        <button
                          className="btn btn-primary flex-1 justify-center shadow-lg shadow-emerald-500/20"
                          onClick={() => void onConfirmFlowItem()}
                          disabled={createItemMutation.isPending}
                        >
                          <Save className="w-4 h-4" /> Buchen
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <ScanFeedback status={flowFeedbackStatus} message={flowFeedbackMessage} />

                {/* Manual Fallback Accordion */}
                <details className="group">
                  <summary className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[var(--muted)] uppercase tracking-wider p-2 hover:bg-[var(--panel-soft)] rounded select-none transition-colors">
                    <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" />
                    Manuelle Erfassung
                  </summary>
                  <form className="mt-3 space-y-3 p-3 bg-[var(--bg)] border border-[var(--line)] rounded-[var(--radius-sm)] animate-in slide-in-from-top-2" onSubmit={(e) => void onAddItem(e)}>
                    <div className="space-y-1">
                      <label className="text-xs text-[var(--muted)]">Artikel</label>
                      <select className="input w-full text-sm py-1.5 h-9" value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)} required>
                        <option value="">Wählen...</option>
                        {(productsQuery.data?.items ?? []).map(p => (
                          <option key={p.id} value={p.id}>{p.product_number} {p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-xs text-[var(--muted)]">Von</label>
                        <select className="input w-full text-sm py-1.5 h-9" value={fromBinId} onChange={(e) => setFromBinId(e.target.value)}>
                          {(binsQuery.data ?? []).map(b => <option key={b.id} value={b.id}>{b.code}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-[var(--muted)]">Nach</label>
                        <select className="input w-full text-sm py-1.5 h-9" value={toBinId} onChange={(e) => setToBinId(e.target.value)}>
                          {(binsQuery.data ?? []).map(b => <option key={b.id} value={b.id}>{b.code}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-[var(--muted)] block mb-1">Menge</label>
                      <div className="flex gap-2">
                        <input className="input flex-1 text-sm py-1.5 h-9" type="number" min="0.001" step="0.001" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
                        <button className="btn btn-primary px-3 h-9" type="submit" disabled={createItemMutation.isPending}><Plus className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </form>
                </details>
              </>
            )}
          </div>
        </section>

        {/* Step 3: Items List */}
        <section className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b border-[var(--line)] bg-[var(--panel-soft)]">
            <h3 className="section-title flex items-center gap-2">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[var(--accent)] text-white text-xs font-bold">3</div>
              Positionen
              <span className="ml-auto text-xs font-mono bg-[var(--bg)] px-2 py-1 rounded border border-[var(--line)] text-[var(--muted)]">
                {(transferItemsQuery.data ?? []).length}
              </span>
            </h3>
          </div>

          <div className="p-0 flex-1 overflow-y-auto bg-[var(--bg)] min-h-[300px]">
            {(transferItemsQuery.data ?? []).length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-[var(--muted)] p-8 opacity-60">
                <Box className="w-12 h-12 mb-3 stroke-1" />
                <p className="text-sm">Noch keine Positionen gebucht.</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--line)]">
                {(transferItemsQuery.data ?? []).map((item) => (
                  <div key={item.id} className="p-4 bg-[var(--panel)] hover:bg-[var(--panel-soft)] transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-medium text-sm text-[var(--ink)] flex items-center gap-2">
                        <Box className="w-4 h-4 text-[var(--accent)]" />
                        Produkt #{item.product_id}
                      </div>
                      <div className="font-mono font-bold text-lg text-[var(--ink)]">{item.quantity}</div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
                      <div className="flex items-center gap-1 bg-[var(--bg)] px-2 py-1 rounded border border-[var(--line)]">
                        <span className="uppercase text-[10px] tracking-wider opacity-70">Von</span>
                        <span className="font-mono font-medium text-[var(--ink)]">{item.from_bin_id}</span>
                      </div>
                      <ArrowRight className="w-3 h-3 opacity-40" />
                      <div className="flex items-center gap-1 bg-[var(--bg)] px-2 py-1 rounded border border-[var(--line)]">
                        <span className="uppercase text-[10px] tracking-wider opacity-70">Nach</span>
                        <span className="font-mono font-medium text-[var(--ink)]">{item.to_bin_id}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
