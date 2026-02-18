import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ScanLine,
  ListOrdered,
  ArrowRight,
  Package,
  CheckCircle,
  Truck
} from "lucide-react";

import ScanFeedback from "../components/scanner/ScanFeedback";
import WorkflowScanInput from "../components/scanner/WorkflowScanInput";
import { fetchCustomerLocations, fetchCustomers } from "../services/customersApi";
import { fetchInventoryByBin } from "../services/inventoryApi";
import {
  cancelGoodsIssue,
  completeGoodsIssue,
  createGoodsIssue,
  createGoodsIssueItem,
  fetchGoodsIssueItems,
  fetchGoodsIssues,
} from "../services/operationsApi";
import { fetchAllProducts, fetchProductByEan, fetchProductByQr } from "../services/productsApi";
import { fetchBinByQr, fetchBins, fetchWarehouses, fetchZones } from "../services/warehousesApi";
import type { BinLocation, InventoryByBinItem, Product } from "../types";
import { parseScanValue } from "../utils/scannerUtils";

type IssueFlowStep = "source_bin_scan" | "product_scan" | "quantity" | "confirm";

const flowSteps: Array<{ id: IssueFlowStep; label: string }> = [
  { id: "source_bin_scan", label: "Quelle" },
  { id: "product_scan", label: "Artikel" },
  { id: "quantity", label: "Menge" },
  { id: "confirm", label: "OK" },
];

export default function GoodsIssuePage() {
  const queryClient = useQueryClient();

  const [customerId, setCustomerId] = useState<string>("");
  const [customerLocationId, setCustomerLocationId] = useState<string>("");
  const [customerReference, setCustomerReference] = useState("");
  const [selectedIssueId, setSelectedIssueId] = useState<number | null>(null);

  const [selectedProductId, setSelectedProductId] = useState("");
  const [requestedQuantity, setRequestedQuantity] = useState("1");

  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [selectedBinId, setSelectedBinId] = useState("");

  const [flowStep, setFlowStep] = useState<IssueFlowStep>("source_bin_scan");
  const [flowSourceBin, setFlowSourceBin] = useState<BinLocation | null>(null);
  const [flowProduct, setFlowProduct] = useState<Product | null>(null);
  const [flowStockItem, setFlowStockItem] = useState<InventoryByBinItem | null>(null);
  const [flowStockByBin, setFlowStockByBin] = useState<InventoryByBinItem[]>([]);
  const [flowQuantity, setFlowQuantity] = useState("1");
  const [flowLoading, setFlowLoading] = useState(false);
  const [flowFeedbackStatus, setFlowFeedbackStatus] = useState<"idle" | "success" | "error">("idle");
  const [flowFeedbackMessage, setFlowFeedbackMessage] = useState<string | null>(null);

  const issuesQuery = useQuery({
    queryKey: ["goods-issues"],
    queryFn: () => fetchGoodsIssues(),
  });

  const issueItemsQuery = useQuery({
    queryKey: ["goods-issue-items", selectedIssueId],
    queryFn: () => fetchGoodsIssueItems(selectedIssueId as number),
    enabled: selectedIssueId !== null,
  });

  const productsQuery = useQuery({
    queryKey: ["products", "goods-issue-picker"],
    queryFn: () => fetchAllProducts(),
  });

  const customersQuery = useQuery({
    queryKey: ["customers", "goods-issue-picker"],
    queryFn: async () => {
      try {
        return await fetchCustomers({ page: 1, pageSize: 200, isActive: true });
      } catch {
        return { items: [], total: 0, page: 1, page_size: 200 };
      }
    },
  });
  const customerLocationsQuery = useQuery({
    queryKey: ["customer-locations", "goods-issue-picker", customerId],
    queryFn: () => fetchCustomerLocations(Number(customerId), { isActive: true }),
    enabled: Boolean(customerId),
  });

  const warehousesQuery = useQuery({
    queryKey: ["warehouses", "goods-issue-picker"],
    queryFn: fetchWarehouses,
  });

  const zonesQuery = useQuery({
    queryKey: ["zones", "goods-issue-picker", selectedWarehouseId],
    queryFn: () => fetchZones(selectedWarehouseId as number),
    enabled: selectedWarehouseId !== null,
  });

  const binsQuery = useQuery({
    queryKey: ["bins", "goods-issue-picker", selectedZoneId],
    queryFn: () => fetchBins(selectedZoneId as number),
    enabled: selectedZoneId !== null,
  });

  const createIssueMutation = useMutation({
    mutationFn: createGoodsIssue,
    onSuccess: async (issue) => {
      setCustomerId("");
      setCustomerLocationId("");
      setCustomerReference("");
      await queryClient.invalidateQueries({ queryKey: ["goods-issues"] });
      setSelectedIssueId(issue.id);
    },
  });

  useEffect(() => {
    setCustomerLocationId("");
  }, [customerId]);

  const createItemMutation = useMutation({
    mutationFn: ({
      issueId,
      productId,
      quantity,
      sourceBinId,
    }: {
      issueId: number;
      productId: number;
      quantity: string;
      sourceBinId: number;
    }) =>
      createGoodsIssueItem(issueId, {
        product_id: productId,
        requested_quantity: quantity,
        source_bin_id: sourceBinId,
        unit: "piece",
      }),
    onSuccess: async () => {
      setRequestedQuantity("1");
      await queryClient.invalidateQueries({ queryKey: ["goods-issue-items", selectedIssueId] });
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: completeGoodsIssue,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["goods-issues"] });
      await queryClient.invalidateQueries({ queryKey: ["goods-issue-items", selectedIssueId] });
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelGoodsIssue,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["goods-issues"] });
      await queryClient.invalidateQueries({ queryKey: ["goods-issue-items", selectedIssueId] });
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
    if (!selectedBinId && binsQuery.data && binsQuery.data.length > 0) {
      setSelectedBinId(String(binsQuery.data[0].id));
    }
  }, [selectedBinId, binsQuery.data]);

  useEffect(() => {
    if (!selectedProductId && productsQuery.data?.items.length) {
      setSelectedProductId(String(productsQuery.data.items[0].id));
    }
  }, [selectedProductId, productsQuery.data]);

  const selectedIssue = useMemo(
    () => issuesQuery.data?.find((item) => item.id === selectedIssueId) ?? null,
    [issuesQuery.data, selectedIssueId]
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
    setFlowProduct(null);
    setFlowStockItem(null);
    setFlowStockByBin([]);
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
      setFlowStockByBin(stockItems);
      setSelectedBinId(String(sourceBin.id));

      if (stockItems.length === 0) {
        setFlowFeedback("error", "Auf dem gescannten Lagerplatz ist kein Bestand vorhanden");
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
      const matchingStock = flowStockByBin.find((item) => item.product_id === product.id);

      if (!matchingStock) {
        setFlowFeedback("error", "Gescanntes Produkt ist auf diesem Lagerplatz nicht verfügbar");
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

  const availableStock = flowStockItem
    ? Number(flowStockItem.quantity) - Number(flowStockItem.reserved_quantity)
    : 0;
  const requestedFlowQty = Number(flowQuantity || 0);
  const remainingAfterIssue = availableStock - requestedFlowQty;

  const onCreateIssue = async (event: FormEvent) => {
    event.preventDefault();
    await createIssueMutation.mutateAsync({
      customer_id: customerId ? Number(customerId) : undefined,
      customer_location_id: customerLocationId ? Number(customerLocationId) : undefined,
      customer_reference: customerReference.trim() || undefined,
    });
  };

  const onAddItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedIssueId || !selectedProductId || !selectedBinId) {
      return;
    }
    await createItemMutation.mutateAsync({
      issueId: selectedIssueId,
      productId: Number(selectedProductId),
      quantity: requestedQuantity,
      sourceBinId: Number(selectedBinId),
    });
  };

  const onConfirmFlowItem = async () => {
    if (!selectedIssueId || !flowProduct || !flowSourceBin) {
      setFlowFeedback("error", "Bitte zuerst WA-Header sowie Quelle und Produkt erfassen");
      return;
    }

    if (requestedFlowQty <= 0 || Number.isNaN(requestedFlowQty)) {
      setFlowFeedback("error", "Bitte eine gültige Menge > 0 erfassen");
      return;
    }

    if (requestedFlowQty > availableStock) {
      setFlowFeedback("error", "Angeforderte Menge überschreitet den verfügbaren Bestand");
      return;
    }

    await createItemMutation.mutateAsync({
      issueId: selectedIssueId,
      productId: flowProduct.id,
      quantity: flowQuantity,
      sourceBinId: flowSourceBin.id,
    });

    setFlowFeedback("success", "Position erfasst");
    resetFlow();
  };

  return (
    <section className="page flex flex-col gap-6" data-testid="goods-issue-page">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="page-title">Warenausgang</h2>
          <p className="section-subtitle mt-1 max-w-2xl">
            Beleg anlegen, Entnahme positionieren und Warenausgang durchführen.
          </p>
        </div>
      </header>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* Panel 1: Beleg anlegen (Selection) */}
        <div className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm flex flex-col h-[calc(100vh-200px)] min-h-[500px] overflow-hidden">
          <div className="p-4 border-b border-[var(--line)] bg-[var(--panel-soft)]">
            <h3 className="section-title flex items-center gap-2">
              <ListOrdered className="w-4 h-4 text-[var(--muted)]" />
              1. Beleg & Auswahl
            </h3>
          </div>

          <div className="p-4 flex-1 overflow-hidden flex flex-col gap-4">
            {/* Create Form */}
            <form className="flex flex-col gap-3" onSubmit={(event) => void onCreateIssue(event)}>
              <select
                className="input w-full min-w-0"
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
                data-testid="goods-issue-customer-select"
              >
                <option value="">Kein Kunde</option>
                {(customersQuery.data?.items ?? []).map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.customer_number} - {customer.company_name}
                  </option>
                ))}
              </select>
              {customerId ? (
                <select
                  className="input w-full min-w-0"
                  value={customerLocationId}
                  onChange={(event) => setCustomerLocationId(event.target.value)}
                  data-testid="goods-issue-customer-location-select"
                >
                  <option value="">Kein Standort</option>
                  {(customerLocationsQuery.data ?? []).map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.location_code} - {location.name}
                    </option>
                  ))}
                </select>
              ) : null}
              <div className="flex gap-2">
                <input
                  className="input w-full min-w-0"
                  placeholder="Kundenreferenz (opt.)"
                  value={customerReference}
                  onChange={(event) => setCustomerReference(event.target.value)}
                />
                <button
                  className="btn btn-primary shrink-0"
                  type="submit"
                  disabled={createIssueMutation.isPending}
                >
                  Neu
                </button>
              </div>
            </form>

            <div className="border-b border-[var(--line)] my-1"></div>

            {/* List */}
            <div className="flex-1 overflow-y-auto border border-[var(--line)] rounded-[var(--radius-sm)] bg-[var(--bg)]" data-testid="goods-issue-list">
              {(issuesQuery.data ?? []).length === 0 ? (
                <div className="p-8 text-center text-[var(--muted)] italic text-sm">
                  Keine offenen Ausgänge gefunden.
                </div>
              ) : (
                <div className="divide-y divide-[var(--line)]">
                  {(issuesQuery.data ?? []).map((issue) => (
                    <button
                      key={issue.id}
                      className={`w-full text-left p-3 hover:bg-[var(--panel-soft)] transition-colors flex items-center justify-between gap-3 group
                        ${selectedIssueId === issue.id ? "bg-[var(--panel-strong)] border-l-4 border-l-[var(--accent)] pl-[calc(0.75rem-4px)]" : "border-l-4 border-l-transparent"}
                      `}
                      onClick={() => setSelectedIssueId(issue.id)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-[var(--ink)] truncate">{issue.issue_number}</div>
                        <div className="text-xs text-[var(--muted)] flex items-center gap-1.5 mt-0.5">
                          <span className={`inline-block w-2 h-2 rounded-full
                            ${issue.status === 'completed' ? 'bg-emerald-500' :
                              issue.status === 'cancelled' ? 'bg-red-500' : 'bg-amber-500'}
                          `}></span>
                          {issue.status}
                        </div>
                      </div>
                      <ArrowRight className={`w-4 h-4 text-[var(--muted)] transition-transform ${selectedIssueId === issue.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Panel 2: Scanner / Workflow */}
        <div className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm flex flex-col h-auto min-h-[500px] lg:h-[calc(100vh-200px)] overflow-hidden">
          <div className="p-4 border-b border-[var(--line)] bg-[var(--panel-soft)]">
            <h3 className="section-title flex items-center gap-2">
              <ScanLine className="w-4 h-4 text-[var(--muted)]" />
              2. Scanner-Workflow
            </h3>
          </div>

          <div className="p-6 flex-1 flex flex-col relative overflow-y-auto">
            {!selectedIssue ? (
              <div className="flex flex-col items-center justify-center text-[var(--muted)] flex-1 text-center opacity-60">
                <Truck className="w-12 h-12 mb-3 opacity-20" />
                <p>Bitte zuerst einen Warenausgang (links) auswählen oder anlegen.</p>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <div className="flex justify-between text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">
                    <span>Fortschritt</span>
                    <span>{Math.round(flowProgress)}%</span>
                  </div>
                  <div className="h-2 w-full bg-[var(--line)] rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--accent)] transition-all duration-300 ease-out" style={{ width: `${flowProgress}%` }} />
                  </div>

                  <div className="flex justify-between mt-3">
                    {flowSteps.map((step, index) => (
                      <span
                        key={step.id}
                        className={`text-xs px-2 py-1 rounded transition-colors ${index <= flowStepIndex ? 'text-[var(--ink)] font-medium bg-[var(--panel-strong)]' : 'text-[var(--muted)]'}`}
                      >
                        {step.label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex-1 flex flex-col justify-center min-h-[200px]">
                  {flowStep === "source_bin_scan" && (
                    <WorkflowScanInput
                      enabled
                      isLoading={flowLoading}
                      label="Quell-Lagerplatz scannen"
                      placeholder="Lagerplatz-Code..."
                      onScan={(value) => onFlowSourceBinScan(value)}
                      testIdPrefix="goods-issue-flow-source-scan"
                    />
                  )}

                  {flowStep === "product_scan" && (
                    <WorkflowScanInput
                      enabled
                      isLoading={flowLoading}
                      label="Artikel scannen"
                      placeholder="EAN / Code..."
                      onScan={(value) => onFlowProductScan(value)}
                      testIdPrefix="goods-issue-flow-product-scan"
                    />
                  )}

                  {flowStep === "quantity" && (
                    <div className="space-y-4 animate-in fade-in zoom-in duration-300">
                      <div className="bg-[var(--panel-soft)] p-4 rounded-[var(--radius-md)] border border-[var(--line)]">
                        <p className="text-sm text-[var(--muted)] mb-1">Verfügbarer Bestand</p>
                        <p className="text-2xl font-mono font-bold text-[var(--ink)]">{availableStock.toFixed(3)}</p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-[var(--muted)]">Entnahmemenge</label>
                        <input
                          className="input w-full text-lg p-3"
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={flowQuantity}
                          onChange={(event) => setFlowQuantity(event.target.value)}
                          autoFocus
                        />
                      </div>

                      {remainingAfterIssue <= 2 && remainingAfterIssue >= 0 && (
                        <div className="p-3 bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded-[var(--radius-sm)] text-sm flex items-start gap-2">
                          <span className="mt-0.5">⚠️</span>
                          <span>Achtung: Niedriger Restbestand nach Entnahme ({remainingAfterIssue.toFixed(3)}).</span>
                        </div>
                      )}

                      <button className="btn btn-primary w-full justify-center py-3" onClick={() => setFlowStep("confirm")}>
                        Weiter zur Bestätigung
                      </button>
                    </div>
                  )}

                  {flowStep === "confirm" && (
                    <div className="space-y-4 animate-in fade-in zoom-in duration-300">
                      <div className="bg-[var(--panel-soft)] p-4 rounded-[var(--radius-md)] border border-[var(--line)] space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-[var(--muted)]">Quelle:</span>
                          <span className="font-medium text-[var(--ink)]">{flowSourceBin?.code}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-[var(--muted)]">Produkt:</span>
                          <span className="font-medium text-[var(--ink)] text-right max-w-[60%] truncate">{flowProduct?.product_number}</span>
                        </div>
                        <div className="flex justify-between border-t border-[var(--line)] pt-2">
                          <span className="text-sm text-[var(--muted)]">Menge:</span>
                          <span className="font-bold text-[var(--accent)] text-lg">{flowQuantity}</span>
                        </div>
                        <div className="flex justify-between text-xs text-[var(--muted)]">
                          <span>Rest:</span>
                          <span>{remainingAfterIssue.toFixed(3)}</span>
                        </div>
                      </div>

                      <button
                        className="btn btn-primary w-full justify-center py-3"
                        onClick={() => void onConfirmFlowItem()}
                        disabled={createItemMutation.isPending}
                      >
                        Position buchen
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-6">
                  <ScanFeedback status={flowFeedbackStatus} message={flowFeedbackMessage} />
                </div>

                {/* Fallback Form Toggler could go here, keeping it hidden for clean UI or implementing a modal */}
                <div className="mt-8 border-t border-[var(--line)] pt-6">
                  <h4 className="text-sm font-semibold text-[var(--muted)] mb-3 uppercase tracking-wider">Erweitert</h4>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      className="btn w-full justify-center"
                      disabled={!selectedIssueId || selectedIssue?.status !== "draft" || completeMutation.isPending}
                      onClick={() => selectedIssueId && void completeMutation.mutateAsync(selectedIssueId)}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      WA abschließen
                    </button>
                    <button
                      className="btn btn-ghost w-full justify-center text-red-500 hover:text-red-600 hover:bg-red-50"
                      disabled={!selectedIssueId || selectedIssue?.status !== "draft" || cancelMutation.isPending}
                      onClick={() => selectedIssueId && void cancelMutation.mutateAsync(selectedIssueId)}
                    >
                      WA stornieren
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Panel 3: Positionen (Items) */}
        <div className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm flex flex-col h-[calc(100vh-200px)] min-h-[500px] overflow-hidden">
          <div className="p-4 border-b border-[var(--line)] bg-[var(--panel-soft)]">
            <h3 className="section-title flex items-center gap-2">
              <Package className="w-4 h-4 text-[var(--muted)]" />
              3. Positionen
            </h3>
          </div>

          <div className="p-4 flex-1 overflow-y-auto space-y-3">
            <div className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-2 px-1">
              Erfasste Artikel
            </div>

            {(issueItemsQuery.data ?? []).length === 0 ? (
              <div className="text-center text-[var(--muted)] py-8 italic text-sm border border-dashed border-[var(--line)] rounded-[var(--radius-md)]">
                Noch keine Positionen erfasst.
              </div>
            ) : (
              (issueItemsQuery.data ?? []).map((item) => (
                <div key={item.id} className="p-3 border border-[var(--line)] rounded-[var(--radius-sm)] bg-[var(--bg)] min-w-0 hover:border-[var(--line-strong)] transition-colors">
                  <div className="flex justify-between items-start mb-1">
                    <strong className="text-[var(--ink)] text-sm font-semibold truncate block break-words min-w-0 pr-2">
                      #{item.product_id}
                    </strong>
                    <span className="text-xs font-mono bg-[var(--panel-soft)] px-1.5 py-0.5 rounded border border-[var(--line)] text-[var(--ink)] shrink-0">
                      {item.requested_quantity}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--muted)] flex items-center gap-2 truncate">
                    <span className="truncate">Quelle: Bin #{item.source_bin_id}</span>
                  </div>
                </div>
              ))
            )}

            {/* Manual Add Placeholder / Expander could be here if needed */}
            <div className="mt-8 pt-4 border-t border-[var(--line)]">
              <details className="group">
                <summary className="list-none cursor-pointer flex items-center gap-2 text-xs font-semibold text-[var(--muted)] hover:text-[var(--accent)] transition-colors">
                  <span className="transition-transform group-open:rotate-90">▶</span>
                  MANUELLE ERFASSUNG (FALLBACK)
                </summary>

                <form className="mt-4 space-y-3 p-3 bg-[var(--panel-soft)] rounded-[var(--radius-md)] border border-[var(--line)]" onSubmit={(event) => void onAddItem(event)}>
                  <select
                    className="input w-full text-sm"
                    value={selectedProductId}
                    onChange={(event) => setSelectedProductId(event.target.value)}
                    required
                  >
                    <option value="">Artikel wählen...</option>
                    {(productsQuery.data?.items ?? []).map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.product_number} - {product.name}
                      </option>
                    ))}
                  </select>

                  <div className="grid grid-cols-2 gap-2">
                    <select
                      className="input w-full text-sm"
                      value={selectedWarehouseId ?? ""}
                      onChange={(event) => {
                        setSelectedWarehouseId(Number(event.target.value));
                        setSelectedZoneId(null);
                        setSelectedBinId("");
                      }}
                    >
                      {(warehousesQuery.data ?? []).map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>
                          {warehouse.code}
                        </option>
                      ))}
                    </select>
                    <select className="input w-full text-sm" value={selectedBinId} onChange={(event) => setSelectedBinId(event.target.value)}>
                      <option value="">Lagerplatz...</option>
                      {(binsQuery.data ?? []).map((bin) => (
                        <option key={bin.id} value={bin.id}>
                          {bin.code}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-2">
                    <input
                      className="input w-full text-sm"
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={requestedQuantity}
                      onChange={(event) => setRequestedQuantity(event.target.value)}
                      placeholder="Menge"
                      required
                    />
                    <button
                      className="btn btn-sm shrink-0"
                      type="submit"
                      disabled={!selectedIssueId || selectedIssue?.status !== "draft" || createItemMutation.isPending}
                    >
                      +
                    </button>
                  </div>
                </form>
              </details>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
