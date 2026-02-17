import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import ScanFeedback from "../components/scanner/ScanFeedback";
import WorkflowScanInput from "../components/scanner/WorkflowScanInput";
import {
  cancelGoodsReceipt,
  completeGoodsReceipt,
  createGoodsReceiptAdHocProduct,
  createGoodsReceipt,
  createGoodsReceiptItem,
  downloadGoodsReceiptItemSerialLabelsPdf,
  fetchGoodsReceiptItems,
  fetchGoodsReceipts,
} from "../services/operationsApi";
import { fetchAllProducts, fetchProductByEan, fetchProductByQr, fetchProductGroups } from "../services/productsApi";
import { fetchPurchaseOrderItems, fetchPurchaseOrders } from "../services/purchasingApi";
import { fetchSuppliers } from "../services/suppliersApi";
import { fetchBinByQr, fetchBins, fetchWarehouses, fetchZones } from "../services/warehousesApi";
import { useAuthStore } from "../stores/authStore";
import type { BinLocation, Product } from "../types";
import { parseScanValue } from "../utils/scannerUtils";

type ReceiptFlowStep = "product_scan" | "quantity" | "bin_scan" | "confirm";

const flowSteps: Array<{ id: ReceiptFlowStep; label: string }> = [
  { id: "product_scan", label: "Artikel" },
  { id: "quantity", label: "Menge" },
  { id: "bin_scan", label: "Platz" },
  { id: "confirm", label: "Bestätigen" },
];

export default function GoodsReceiptPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const canQuickCreateProduct = Boolean(user?.permissions?.includes("module.products.quick_create"));

  const [notes, setNotes] = useState("");
  const [supplierId, setSupplierId] = useState<string>("");
  const [purchaseOrderId, setPurchaseOrderId] = useState<string>("");
  const [selectedReceiptId, setSelectedReceiptId] = useState<number | null>(null);

  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedPurchaseOrderItemId, setSelectedPurchaseOrderItemId] = useState("");
  const [receivedQuantity, setReceivedQuantity] = useState("1");
  const [serialNumbersInput, setSerialNumbersInput] = useState("");

  const [showAdHocModal, setShowAdHocModal] = useState(false);
  const [adHocProductNumber, setAdHocProductNumber] = useState("");
  const [adHocProductName, setAdHocProductName] = useState("");
  const [adHocProductGroupId, setAdHocProductGroupId] = useState("");
  const [adHocRequiresTracking, setAdHocRequiresTracking] = useState(false);

  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [selectedBinId, setSelectedBinId] = useState("");

  const [flowStep, setFlowStep] = useState<ReceiptFlowStep>("product_scan");
  const [flowProduct, setFlowProduct] = useState<Product | null>(null);
  const [flowBin, setFlowBin] = useState<BinLocation | null>(null);
  const [flowQuantity, setFlowQuantity] = useState("1");
  const [flowLoading, setFlowLoading] = useState(false);
  const [flowFeedbackStatus, setFlowFeedbackStatus] = useState<"idle" | "success" | "error">("idle");
  const [flowFeedbackMessage, setFlowFeedbackMessage] = useState<string | null>(null);

  const receiptsQuery = useQuery({
    queryKey: ["goods-receipts"],
    queryFn: () => fetchGoodsReceipts(),
  });

  const selectedReceipt = useMemo(
    () => receiptsQuery.data?.find((item) => item.id === selectedReceiptId) ?? null,
    [receiptsQuery.data, selectedReceiptId]
  );

  const receiptItemsQuery = useQuery({
    queryKey: ["goods-receipt-items", selectedReceiptId],
    queryFn: () => fetchGoodsReceiptItems(selectedReceiptId as number),
    enabled: selectedReceiptId !== null,
  });

  const productsQuery = useQuery({
    queryKey: ["products", "goods-receipt-picker"],
    queryFn: () => fetchAllProducts(),
  });
  const selectedProduct = useMemo(
    () => productsQuery.data?.items.find((item) => String(item.id) === selectedProductId) ?? null,
    [productsQuery.data, selectedProductId]
  );

  const suppliersQuery = useQuery({
    queryKey: ["suppliers", "goods-receipt-picker"],
    queryFn: async () => {
      try {
        return await fetchSuppliers({ page: 1, pageSize: 200, isActive: true });
      } catch {
        return { items: [], total: 0, page: 1, page_size: 200 };
      }
    },
  });

  const purchaseOrdersQuery = useQuery({
    queryKey: ["purchase-orders", "goods-receipt-picker"],
    queryFn: async () => {
      const ordered = await fetchPurchaseOrders("ordered");
      const partiallyReceived = await fetchPurchaseOrders("partially_received");
      return [...ordered, ...partiallyReceived];
    },
  });

  const purchaseOrderItemsQuery = useQuery({
    queryKey: ["purchase-order-items", selectedReceipt?.purchase_order_id],
    queryFn: () => fetchPurchaseOrderItems(selectedReceipt?.purchase_order_id as number),
    enabled: Boolean(selectedReceipt?.purchase_order_id),
  });

  const productGroupsQuery = useQuery({
    queryKey: ["product-groups", "goods-receipt-adhoc"],
    queryFn: fetchProductGroups,
    enabled: canQuickCreateProduct,
  });

  const warehousesQuery = useQuery({
    queryKey: ["warehouses", "goods-receipt-picker"],
    queryFn: fetchWarehouses,
  });

  const zonesQuery = useQuery({
    queryKey: ["zones", "goods-receipt-picker", selectedWarehouseId],
    queryFn: () => fetchZones(selectedWarehouseId as number),
    enabled: selectedWarehouseId !== null,
  });

  const binsQuery = useQuery({
    queryKey: ["bins", "goods-receipt-picker", selectedZoneId],
    queryFn: () => fetchBins(selectedZoneId as number),
    enabled: selectedZoneId !== null,
  });

  const createReceiptMutation = useMutation({
    mutationFn: createGoodsReceipt,
    onSuccess: async (receipt) => {
      setNotes("");
      setSupplierId("");
      setPurchaseOrderId("");
      await queryClient.invalidateQueries({ queryKey: ["goods-receipts"] });
      setSelectedReceiptId(receipt.id);
    },
  });

  const createItemMutation = useMutation({
    mutationFn: ({
      receiptId,
      productId,
      quantity,
      targetBinId,
      serialNumbers,
      purchaseOrderItemId,
    }: {
      receiptId: number;
      productId: number;
      quantity: string;
      targetBinId: number;
      serialNumbers?: string[];
      purchaseOrderItemId?: number;
    }) =>
      createGoodsReceiptItem(receiptId, {
        product_id: productId,
        received_quantity: quantity,
        target_bin_id: targetBinId,
        unit: "piece",
        serial_numbers: serialNumbers,
        purchase_order_item_id: purchaseOrderItemId,
      }),
    onSuccess: async () => {
      setReceivedQuantity("1");
      setSerialNumbersInput("");
      await queryClient.invalidateQueries({ queryKey: ["goods-receipt-items", selectedReceiptId] });
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: completeGoodsReceipt,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["goods-receipts"] });
      await queryClient.invalidateQueries({ queryKey: ["goods-receipt-items", selectedReceiptId] });
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelGoodsReceipt,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["goods-receipts"] });
      await queryClient.invalidateQueries({ queryKey: ["goods-receipt-items", selectedReceiptId] });
    },
  });

  const adHocProductMutation = useMutation({
    mutationFn: ({
      receiptId,
      payload,
    }: {
      receiptId: number;
      payload: Parameters<typeof createGoodsReceiptAdHocProduct>[1];
    }) => createGoodsReceiptAdHocProduct(receiptId, payload),
    onSuccess: async (product) => {
      await queryClient.invalidateQueries({ queryKey: ["products", "goods-receipt-picker"] });
      setSelectedProductId(String(product.id));
      setShowAdHocModal(false);
      setAdHocProductNumber("");
      setAdHocProductName("");
      setAdHocProductGroupId("");
      setAdHocRequiresTracking(false);
    },
  });

  const parseSerialNumbers = (raw: string): string[] =>
    raw
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

  const triggerSerialLabelDownload = async (receiptId: number, itemId: number) => {
    const blob = await downloadGoodsReceiptItemSerialLabelsPdf(receiptId, itemId);
    const objectUrl = URL.createObjectURL(blob);
    window.open(objectUrl, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  };

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

  useEffect(() => {
    if (!selectedReceipt?.purchase_order_id) {
      setSelectedPurchaseOrderItemId("");
      return;
    }
    if (!selectedProductId) {
      setSelectedPurchaseOrderItemId("");
      return;
    }
    const matchingPoItem = (purchaseOrderItemsQuery.data ?? []).find(
      (poItem) => poItem.product_id === Number(selectedProductId)
    );
    setSelectedPurchaseOrderItemId(matchingPoItem ? String(matchingPoItem.id) : "");
  }, [purchaseOrderItemsQuery.data, selectedProductId, selectedReceipt?.purchase_order_id]);

  const flowStepIndex = flowSteps.findIndex((step) => step.id === flowStep);
  const flowProgress = ((flowStepIndex + 1) / flowSteps.length) * 100;

  const setFlowFeedback = (status: "idle" | "success" | "error", message: string | null) => {
    setFlowFeedbackStatus(status);
    setFlowFeedbackMessage(message);
  };

  const resetFlow = () => {
    setFlowStep("product_scan");
    setFlowProduct(null);
    setFlowBin(null);
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

  const onFlowProductScan = async (value: string) => {
    setFlowLoading(true);
    try {
      const product = await resolveProductFromScan(value);
      setFlowProduct(product);
      setSelectedProductId(String(product.id));
      setFlowStep("quantity");
      setFlowFeedback("success", `Produkt erkannt: ${product.product_number}`);
    } catch {
      setFlowFeedback("error", "Produktscan fehlgeschlagen");
    } finally {
      setFlowLoading(false);
    }
  };

  const onFlowBinScan = async (value: string) => {
    setFlowLoading(true);
    try {
      const bin = await resolveBinFromScan(value);
      setFlowBin(bin);
      setSelectedBinId(String(bin.id));
      setFlowStep("confirm");
      setFlowFeedback("success", `Lagerplatz erkannt: ${bin.code}`);
    } catch {
      setFlowFeedback("error", "Lagerplatzscan fehlgeschlagen");
    } finally {
      setFlowLoading(false);
    }
  };

  const onCreateReceipt = async (event: FormEvent) => {
    event.preventDefault();
    await createReceiptMutation.mutateAsync({
      supplier_id: supplierId ? Number(supplierId) : undefined,
      purchase_order_id: purchaseOrderId ? Number(purchaseOrderId) : undefined,
      notes: notes.trim() || undefined,
    });
  };

  const onAddItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedReceiptId || !selectedProductId || !selectedBinId) {
      return;
    }
    const serialNumbers = parseSerialNumbers(serialNumbersInput);
    if (selectedProduct?.requires_item_tracking) {
      const parsedQuantity = Number(receivedQuantity);
      if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
        setFlowFeedback("error", "Getrackte Artikel erfordern eine ganze Menge");
        return;
      }
      if (serialNumbers.length !== parsedQuantity) {
        setFlowFeedback("error", "Anzahl Seriennummern muss der Menge entsprechen");
        return;
      }
    }
    if (selectedReceipt?.purchase_order_id && !selectedPurchaseOrderItemId) {
      setFlowFeedback("error", "Bitte PO-Position für den Artikel auswählen");
      return;
    }
    const createdItem = await createItemMutation.mutateAsync({
      receiptId: selectedReceiptId,
      productId: Number(selectedProductId),
      quantity: receivedQuantity,
      targetBinId: Number(selectedBinId),
      serialNumbers: serialNumbers.length > 0 ? serialNumbers : undefined,
      purchaseOrderItemId: selectedPurchaseOrderItemId ? Number(selectedPurchaseOrderItemId) : undefined,
    });
    if (selectedProduct?.requires_item_tracking && createdItem.id) {
      await triggerSerialLabelDownload(selectedReceiptId, createdItem.id);
    }
  };

  const onConfirmFlowItem = async () => {
    if (!selectedReceiptId || !flowProduct || !flowBin) {
      setFlowFeedback("error", "Bitte zuerst WE-Header sowie Produkt und Lagerplatz erfassen");
      return;
    }
    if (flowProduct.requires_item_tracking) {
      setFlowFeedback("error", "Getrackte Artikel bitte im manuellen Formular mit Seriennummern erfassen");
      return;
    }
    const matchingPoItem = selectedReceipt?.purchase_order_id
      ? (purchaseOrderItemsQuery.data ?? []).find((poItem) => poItem.product_id === flowProduct.id)
      : null;
    if (selectedReceipt?.purchase_order_id && !matchingPoItem) {
      setFlowFeedback("error", "Keine passende PO-Position für gescannten Artikel gefunden");
      return;
    }

    await createItemMutation.mutateAsync({
      receiptId: selectedReceiptId,
      productId: flowProduct.id,
      quantity: flowQuantity,
      targetBinId: flowBin.id,
      purchaseOrderItemId: matchingPoItem?.id,
    });

    setFlowFeedback("success", "Position erfasst");
    resetFlow();
  };

  const onCreateAdHocProduct = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedReceiptId) {
      return;
    }
    await adHocProductMutation.mutateAsync({
      receiptId: selectedReceiptId,
      payload: {
        product_number: adHocProductNumber.trim(),
        name: adHocProductName.trim(),
        description: null,
        product_group_id: adHocProductGroupId ? Number(adHocProductGroupId) : null,
        unit: "piece",
        status: "active",
        requires_item_tracking: adHocRequiresTracking,
      },
    });
  };

  return (
    <section className="page flex flex-col gap-6" data-testid="goods-receipt-page">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="page-title">Wareneingang</h2>
          <p className="section-subtitle mt-1 max-w-2xl">
            Header anlegen, Positionen erfassen und WE abschließen.
          </p>
        </div>
      </header>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* Panel 1: Beleg anlegen (Create/Select) */}
        <div className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm flex flex-col h-[calc(100vh-200px)] min-h-[500px] overflow-hidden">
          <div className="p-4 border-b border-[var(--line)] bg-[var(--panel-soft)]">
            <h3 className="section-title">
              1. Beleg anlegen
            </h3>
          </div>

          <div className="p-4 flex-1 overflow-hidden flex flex-col gap-4">
            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => void onCreateReceipt(event)}
              data-testid="goods-receipt-create-form"
            >
              <select
                className="input w-full min-w-0"
                value={purchaseOrderId}
                onChange={(event) => setPurchaseOrderId(event.target.value)}
                data-testid="goods-receipt-po-select"
              >
                <option value="">Keine Bestellung</option>
                {(purchaseOrdersQuery.data ?? []).map((purchaseOrder) => (
                  <option key={purchaseOrder.id} value={purchaseOrder.id}>
                    {purchaseOrder.order_number} ({purchaseOrder.status})
                  </option>
                ))}
              </select>

              <select
                className="input w-full min-w-0"
                value={supplierId}
                onChange={(event) => setSupplierId(event.target.value)}
                data-testid="goods-receipt-supplier-select"
              >
                <option value="">Kein Lieferant</option>
                {(suppliersQuery.data?.items ?? []).map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.supplier_number} - {supplier.company_name}
                  </option>
                ))}
              </select>

              <div className="flex gap-2">
                <input
                  className="input w-full min-w-0"
                  placeholder="Notiz (optional)"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  data-testid="goods-receipt-notes-input"
                />
                <button
                  className="btn btn-primary shrink-0"
                  type="submit"
                  disabled={createReceiptMutation.isPending}
                  data-testid="goods-receipt-create-btn"
                >
                  Neu
                </button>
              </div>
            </form>

            <div className="border-b border-[var(--line)] my-1"></div>

            <div className="flex-1 overflow-y-auto border border-[var(--line)] rounded-[var(--radius-sm)] bg-[var(--bg)]" data-testid="goods-receipt-list">
              {(receiptsQuery.data ?? []).length === 0 ? (
                <div className="p-8 text-center text-[var(--muted)] italic text-sm">
                  Keine offenen Belege gefunden.
                </div>
              ) : (
                <div className="divide-y divide-[var(--line)]">
                  {(receiptsQuery.data ?? []).map((receipt) => (
                    <button
                      key={receipt.id}
                      className={`w-full text-left p-3 hover:bg-[var(--panel-soft)] transition-colors flex items-center justify-between gap-3 group
                          ${selectedReceiptId === receipt.id ? "bg-[var(--panel-strong)] border-l-4 border-l-[var(--accent)] pl-[calc(0.75rem-4px)]" : "border-l-4 border-l-transparent"}
                        `}
                      onClick={() => setSelectedReceiptId(receipt.id)}
                      data-testid={`goods-receipt-item-${receipt.id}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-[var(--ink)] truncate">{receipt.receipt_number}</div>
                        <div className="text-xs text-[var(--muted)] flex items-center gap-1.5 mt-0.5">
                          <span className={`inline-block w-2 h-2 rounded-full 
                              ${receipt.status === 'completed' ? 'bg-emerald-500' :
                              receipt.status === 'cancelled' ? 'bg-red-500' : 'bg-amber-500'}
                            `}></span>
                          {receipt.status}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Panel 2: Scanner Workflow */}
        <div className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm flex flex-col h-auto min-h-[500px] lg:h-[calc(100vh-200px)] overflow-hidden">
          <div className="p-4 border-b border-[var(--line)] bg-[var(--panel-soft)]">
            <h3 className="section-title">
              2. Scanner-Workflow
            </h3>
          </div>

          <div className="p-6 flex-1 flex flex-col relative overflow-y-auto">
            {/* Progress Indicator */}
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
              {flowStep === "product_scan" && (
                <WorkflowScanInput
                  enabled
                  isLoading={flowLoading}
                  label="Artikel scannen (QR/EAN)"
                  placeholder="Artikelcode scannen"
                  onScan={(value) => onFlowProductScan(value)}
                  testIdPrefix="goods-receipt-flow-product-scan"
                />
              )}

              {flowStep === "quantity" && (
                <div className="space-y-4 animate-in fade-in zoom-in duration-300">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--muted)]">Menge erfassen</label>
                    <input
                      className="input w-full text-lg p-3"
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={flowQuantity}
                      onChange={(event) => setFlowQuantity(event.target.value)}
                      data-testid="goods-receipt-flow-quantity-input"
                      autoFocus
                    />
                  </div>
                  <button
                    className="btn btn-primary w-full justify-center py-3"
                    onClick={() => setFlowStep("bin_scan")}
                  >
                    Weiter zu Lagerplatz-Scan
                  </button>
                </div>
              )}

              {flowStep === "bin_scan" && (
                <WorkflowScanInput
                  enabled
                  isLoading={flowLoading}
                  label="Lagerplatz scannen"
                  placeholder="Lagerplatzcode scannen"
                  onScan={(value) => onFlowBinScan(value)}
                  testIdPrefix="goods-receipt-flow-bin-scan"
                />
              )}

              {flowStep === "confirm" && (
                <div className="space-y-4 animate-in fade-in zoom-in duration-300">
                  <div className="bg-[var(--panel-soft)] p-4 rounded-[var(--radius-md)] border border-[var(--line)] space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-[var(--muted)]">Produkt:</span>
                      <span className="font-medium text-[var(--ink)] text-right max-w-[60%] truncate">{flowProduct?.product_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-[var(--muted)]">Menge:</span>
                      <span className="font-bold text-[var(--accent)] text-lg">{flowQuantity}</span>
                    </div>
                    <div className="flex justify-between border-t border-[var(--line)] pt-2">
                      <span className="text-sm text-[var(--muted)]">Zielplatz:</span>
                      <span className="font-medium text-[var(--ink)]">{flowBin?.code}</span>
                    </div>
                  </div>

                  <button
                    className="btn btn-primary w-full justify-center py-3"
                    onClick={() => void onConfirmFlowItem()}
                    disabled={createItemMutation.isPending}
                  >
                    Position bestätigen
                  </button>
                </div>
              )}
            </div>

            <div className="mt-6">
              <ScanFeedback status={flowFeedbackStatus} message={flowFeedbackMessage} />
            </div>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-[var(--line)]"></span>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[var(--panel)] px-2 text-[var(--muted)] font-medium">Oder manuell</span>
              </div>
            </div>

            {/* Manual Form Fallback */}
            <form
              className="flex flex-col gap-4 bg-[var(--panel-soft)] p-4 rounded-[var(--radius-md)] border border-[var(--line)]"
              onSubmit={(event) => void onAddItem(event)}
              data-testid="goods-receipt-item-form"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <select
                  className="input w-full md:col-span-2"
                  value={selectedProductId}
                  onChange={(event) => setSelectedProductId(event.target.value)}
                  required
                  data-testid="goods-receipt-product-select"
                >
                  <option value="">Artikel wählen</option>
                  {(productsQuery.data?.items ?? []).map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.product_number} - {product.name}
                    </option>
                  ))}
                </select>

                {selectedReceipt?.purchase_order_id ? (
                  <select
                    className="input w-full md:col-span-2"
                    value={selectedPurchaseOrderItemId}
                    onChange={(event) => setSelectedPurchaseOrderItemId(event.target.value)}
                    required
                    data-testid="goods-receipt-po-item-select"
                  >
                    <option value="">PO-Position wählen</option>
                    {(purchaseOrderItemsQuery.data ?? [])
                      .filter((poItem) => poItem.product_id === Number(selectedProductId))
                      .map((poItem) => (
                        <option key={poItem.id} value={poItem.id}>
                          #{poItem.id} - bestellt {poItem.ordered_quantity} {poItem.unit} / erhalten {poItem.received_quantity}
                        </option>
                      ))}
                  </select>
                ) : null}

                {canQuickCreateProduct ? (
                  <button
                    className="btn btn-ghost md:col-span-2 justify-start"
                    type="button"
                    onClick={() => setShowAdHocModal(true)}
                    disabled={!selectedReceiptId || selectedReceipt?.status !== "draft"}
                    data-testid="goods-receipt-adhoc-product-btn"
                  >
                    Artikel ad-hoc anlegen
                  </button>
                ) : null}

                <select
                  className="input w-full"
                  value={selectedWarehouseId ?? ""}
                  onChange={(event) => {
                    setSelectedWarehouseId(Number(event.target.value));
                    setSelectedZoneId(null);
                    setSelectedBinId("");
                  }}
                  data-testid="goods-receipt-warehouse-select"
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
                  data-testid="goods-receipt-zone-select"
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
                  data-testid="goods-receipt-bin-select"
                >
                  <option value="">Platz...</option>
                  {(binsQuery.data ?? []).map((bin) => (
                    <option key={bin.id} value={bin.id}>
                      {bin.code}
                    </option>
                  ))}
                </select>

                <input
                  className="input w-full"
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={receivedQuantity}
                  onChange={(event) => setReceivedQuantity(event.target.value)}
                  required
                  data-testid="goods-receipt-quantity-input"
                  placeholder="Menge"
                />

                {selectedProduct?.requires_item_tracking ? (
                  <textarea
                    className="input w-full md:col-span-2 min-h-[90px]"
                    value={serialNumbersInput}
                    onChange={(event) => setSerialNumbersInput(event.target.value)}
                    required
                    data-testid="goods-receipt-serial-input"
                    placeholder="Seriennummern (eine pro Zeile oder komma-separiert)"
                  />
                ) : null}
              </div>

              <button
                className="btn w-full justify-center"
                type="submit"
                disabled={!selectedReceiptId || selectedReceipt?.status !== "draft" || createItemMutation.isPending}
                data-testid="goods-receipt-add-item-btn"
              >
                Position hinzufügen
              </button>
            </form>

            <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-[var(--line)]">
              <button
                className="btn btn-ghost w-full justify-center text-[var(--destructive)] hover:bg-red-50"
                type="button"
                disabled={!selectedReceiptId || selectedReceipt?.status !== "draft" || cancelMutation.isPending}
                onClick={() => selectedReceiptId && void cancelMutation.mutateAsync(selectedReceiptId)}
                data-testid="goods-receipt-cancel-btn"
              >
                Stornieren
              </button>

              <button
                className="btn btn-primary w-full justify-center"
                type="button"
                disabled={!selectedReceiptId || selectedReceipt?.status !== "draft" || completeMutation.isPending}
                onClick={() => selectedReceiptId && void completeMutation.mutateAsync(selectedReceiptId)}
                data-testid="goods-receipt-complete-btn"
              >
                Abschließen
              </button>
            </div>
          </div>
        </div>

        {/* Panel 3: Erfasste Positionen */}
        <div className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm flex flex-col h-[calc(100vh-200px)] min-h-[500px] overflow-hidden">
          <div className="p-4 border-b border-[var(--line)] bg-[var(--panel-soft)]">
            <h3 className="section-title">
              3. Erfasste Positionen
            </h3>
          </div>

          <div className="p-4 flex-1 overflow-y-auto space-y-3" data-testid="goods-receipt-items-list">
            <div className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-2 px-1">
              Liste
            </div>

            {(receiptItemsQuery.data ?? []).map((item) => (
              <div
                key={item.id}
                className="p-3 border border-[var(--line)] rounded-[var(--radius-sm)] bg-[var(--bg)] hover:border-[var(--line-strong)] transition-colors min-w-0"
                data-testid={`goods-receipt-item-row-${item.id}`}
              >
                <div className="flex justify-between items-start mb-1 gap-2">
                  <strong className="text-[var(--ink)] text-sm font-semibold truncate block break-words min-w-0 pr-2">
                    #{item.product_id}
                  </strong>
                  <span className="text-xs font-mono bg-[var(--panel-soft)] px-1.5 py-0.5 rounded border border-[var(--line)] text-[var(--ink)] shrink-0">
                    {item.received_quantity}
                  </span>
                </div>
                <div className="text-xs text-[var(--muted)] flex items-center gap-2 truncate">
                  <span className="truncate">Menge: {item.received_quantity}</span>
                  <span className="truncate">Ziel: Bin #{item.target_bin_id}</span>
                </div>
                {item.serial_numbers && item.serial_numbers.length > 0 ? (
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-[var(--muted)]">
                      Seriennummern: {item.serial_numbers.length}
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost text-xs"
                      onClick={() => selectedReceiptId && void triggerSerialLabelDownload(selectedReceiptId, item.id)}
                      data-testid={`goods-receipt-item-print-labels-btn-${item.id}`}
                    >
                      Labels drucken
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
            {!receiptItemsQuery.isLoading && (receiptItemsQuery.data?.length ?? 0) === 0 ? (
              <div className="text-center text-[var(--muted)] py-8 italic text-sm border border-dashed border-[var(--line)] rounded-[var(--radius-md)]">
                Noch keine Positionen erfasst.
              </div>
            ) : null}
          </div>
        </div>

      </div>

      {showAdHocModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--panel)] p-5">
            <h3 className="section-title mb-4">Ad-hoc Artikelanlage</h3>
            <form className="flex flex-col gap-3" onSubmit={(event) => void onCreateAdHocProduct(event)}>
              <input
                className="input w-full"
                value={adHocProductNumber}
                onChange={(event) => setAdHocProductNumber(event.target.value)}
                placeholder="Artikelnummer"
                data-testid="goods-receipt-adhoc-product-number"
                required
              />
              <input
                className="input w-full"
                value={adHocProductName}
                onChange={(event) => setAdHocProductName(event.target.value)}
                placeholder="Bezeichnung"
                data-testid="goods-receipt-adhoc-product-name"
                required
              />
              <select
                className="input w-full"
                value={adHocProductGroupId}
                onChange={(event) => setAdHocProductGroupId(event.target.value)}
                data-testid="goods-receipt-adhoc-product-group"
              >
                <option value="">Keine Produktgruppe</option>
                {(productGroupsQuery.data ?? []).map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={adHocRequiresTracking}
                  onChange={(event) => setAdHocRequiresTracking(event.target.checked)}
                  data-testid="goods-receipt-adhoc-product-tracking"
                />
                Einzelteilverfolgung (Seriennummernpflicht)
              </label>
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowAdHocModal(false)}
                  data-testid="goods-receipt-adhoc-cancel-btn"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={adHocProductMutation.isPending}
                  data-testid="goods-receipt-adhoc-save-btn"
                >
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
