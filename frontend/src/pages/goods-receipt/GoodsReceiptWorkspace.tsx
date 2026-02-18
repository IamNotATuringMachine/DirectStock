import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import ScanFeedback from "../../components/scanner/ScanFeedback";
import WorkflowScanInput from "../../components/scanner/WorkflowScanInput";
import {
  cancelGoodsReceipt,
  completeGoodsReceipt,
  createGoodsReceiptAdHocProduct,
  createGoodsReceipt,
  createGoodsReceiptFromPo,
  createGoodsReceiptItem,
  deleteGoodsReceipt,
  downloadGoodsReceiptItemLabelsPdf,
  downloadGoodsReceiptItemSerialLabelsPdf,
  fetchBinSuggestions,
} from "../../services/operationsApi";
import { fetchAllProducts, fetchProductByEan, fetchProductByQr, fetchProductGroups } from "../../services/productsApi";
import { fetchPurchaseOrderItems, fetchPurchaseOrders, resolvePurchaseOrder } from "../../services/purchasingApi";
import { fetchSuppliers } from "../../services/suppliersApi";
import { createBin, fetchBinByQr, fetchBins, fetchWarehouses, fetchZones } from "../../services/warehousesApi";
import { useAuthStore } from "../../stores/authStore";
import type { BinLocation, Product } from "../../types";
import { parseScanValue } from "../../utils/scannerUtils";
import { AdHocProductModal } from "./components/AdHocProductModal";
import { ReceiptHeaderForm } from "./components/ReceiptHeaderForm";
import { ReceiptItemForm } from "./components/ReceiptItemForm";
import { ScanFlowPanel } from "./components/ScanFlowPanel";
import { useGoodsReceiptQueries } from "./hooks/useGoodsReceiptQueries";
import { ReceiptFlowStep, flowSteps } from "./state";

export function GoodsReceiptWorkspace() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const canQuickCreateProduct = Boolean(user?.permissions?.includes("module.products.quick_create"));
  const canCreateBins = Boolean(user?.roles.some((role) => role === "admin" || role === "lagerleiter"));

  const [receiptMode, setReceiptMode] = useState<"po" | "free">("free");
  const [sourceType, setSourceType] = useState<"supplier" | "technician" | "other">("supplier");
  const [poResolveInput, setPoResolveInput] = useState("");

  const [notes, setNotes] = useState("");
  const [supplierId, setSupplierId] = useState<string>("");
  const [purchaseOrderId, setPurchaseOrderId] = useState<string>("");
  const [selectedReceiptId, setSelectedReceiptId] = useState<number | null>(null);

  const [selectedProductId, setSelectedProductId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [selectedPurchaseOrderItemId, setSelectedPurchaseOrderItemId] = useState("");
  const [receivedQuantity, setReceivedQuantity] = useState("1");
  const [serialNumbersInput, setSerialNumbersInput] = useState("");
  const [scannedSerials, setScannedSerials] = useState<string[]>([]);

  const [showAdHocModal, setShowAdHocModal] = useState(false);
  const [adHocProductNumber, setAdHocProductNumber] = useState("");
  const [adHocProductName, setAdHocProductName] = useState("");
  const [adHocProductGroupId, setAdHocProductGroupId] = useState("");
  const [adHocCreateProductGroup, setAdHocCreateProductGroup] = useState(false);
  const [adHocProductGroupName, setAdHocProductGroupName] = useState("");
  const [adHocRequiresTracking, setAdHocRequiresTracking] = useState(false);

  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [selectedBinId, setSelectedBinId] = useState("");
  const [newBinCode, setNewBinCode] = useState("");

  const [flowStep, setFlowStep] = useState<ReceiptFlowStep>("product_scan");
  const [flowProduct, setFlowProduct] = useState<Product | null>(null);
  const [flowBin, setFlowBin] = useState<BinLocation | null>(null);
  const [flowQuantity, setFlowQuantity] = useState("1");
  const [flowLoading, setFlowLoading] = useState(false);
  const [flowFeedbackStatus, setFlowFeedbackStatus] = useState<"idle" | "success" | "error">("idle");
  const [flowFeedbackMessage, setFlowFeedbackMessage] = useState<string | null>(null);
  const [flowCondition, setFlowCondition] = useState<"new" | "defective" | "needs_repair">("new");
  const [manualCondition, setManualCondition] = useState<"" | "new" | "defective" | "needs_repair">("new");

  const { receiptsQuery, receiptItemsQuery } = useGoodsReceiptQueries(selectedReceiptId);

  const selectedReceipt = useMemo(
    () => receiptsQuery.data?.find((item) => item.id === selectedReceiptId) ?? null,
    [receiptsQuery.data, selectedReceiptId]
  );
  const currentReceiptMode = selectedReceipt?.mode ?? receiptMode;
  const currentReceiptSourceType = selectedReceipt?.source_type ?? sourceType;
  const conditionRequiredForCurrentReceipt = currentReceiptMode === "free" && currentReceiptSourceType !== "supplier";

  const productsQuery = useQuery({
    queryKey: ["products", "goods-receipt-picker"],
    queryFn: () => fetchAllProducts(),
  });
  const selectedProduct = useMemo(
    () => productsQuery.data?.items.find((item) => String(item.id) === selectedProductId) ?? null,
    [productsQuery.data, selectedProductId]
  );
  const filteredProducts = useMemo(() => {
    const needle = productSearch.trim().toLowerCase();
    if (!needle) {
      return productsQuery.data?.items ?? [];
    }
    return (productsQuery.data?.items ?? []).filter((item) =>
      [item.product_number, item.name, item.description ?? ""].some((value) => value.toLowerCase().includes(needle))
    );
  }, [productSearch, productsQuery.data]);

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

  const binSuggestionsQuery = useQuery({
    queryKey: ["bin-suggestions", flowProduct?.id],
    queryFn: () => fetchBinSuggestions(flowProduct!.id),
    enabled: flowProduct !== null && flowStep === "bin_scan",
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

  const createReceiptFromPoMutation = useMutation({
    mutationFn: createGoodsReceiptFromPo,
    onSuccess: async (receipt) => {
      await queryClient.invalidateQueries({ queryKey: ["goods-receipts"] });
      setSelectedReceiptId(receipt.id);
      setPurchaseOrderId("");
    },
  });

  const resolvePurchaseOrderMutation = useMutation({
    mutationFn: resolvePurchaseOrder,
    onSuccess: (resolved) => {
      setPurchaseOrderId(String(resolved.order.id));
      setFlowFeedback("success", `PO aufgelöst: ${resolved.order.order_number}`);
    },
    onError: () => {
      setFlowFeedback("error", "PO-Nummer konnte nicht aufgelöst werden");
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
      input_method,
      condition,
    }: {
      receiptId: number;
      productId: number;
      quantity: string;
      targetBinId: number;
      serialNumbers?: string[];
      purchaseOrderItemId?: number;
      input_method?: "scan" | "manual";
      condition?: string;
    }) =>
      createGoodsReceiptItem(receiptId, {
        product_id: productId,
        received_quantity: quantity,
        target_bin_id: targetBinId,
        unit: "piece",
        serial_numbers: serialNumbers,
        purchase_order_item_id: purchaseOrderItemId,
        input_method,
        condition: condition ?? "new",
      }),
    onSuccess: async () => {
      setReceivedQuantity("1");
      setSerialNumbersInput("");
      setScannedSerials([]);
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

  const deleteMutation = useMutation({
    mutationFn: deleteGoodsReceipt,
    onSuccess: async () => {
      setSelectedReceiptId(null);
      await queryClient.invalidateQueries({ queryKey: ["goods-receipts"] });
      await queryClient.invalidateQueries({ queryKey: ["goods-receipt-items"] });
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
      await queryClient.invalidateQueries({ queryKey: ["product-groups", "goods-receipt-adhoc"] });
      await queryClient.invalidateQueries({ queryKey: ["products", "goods-receipt-picker"] });
      setSelectedProductId(String(product.id));
      setShowAdHocModal(false);
      setAdHocProductNumber("");
      setAdHocProductName("");
      setAdHocProductGroupId("");
      setAdHocCreateProductGroup(false);
      setAdHocProductGroupName("");
      setAdHocRequiresTracking(false);
    },
  });

  const createBinMutation = useMutation({
    mutationFn: ({ zoneId, code }: { zoneId: number; code: string }) =>
      createBin(zoneId, { code, bin_type: "storage", is_active: true }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ["bins", "goods-receipt-picker", selectedZoneId] });
      setSelectedBinId(String(created.id));
      setNewBinCode("");
      setFlowFeedback("success", `Neuer Platz angelegt: ${created.code}`);
    },
    onError: () => {
      setFlowFeedback("error", "Neuen Lagerplatz anlegen fehlgeschlagen");
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

  const triggerItemLabelDownload = async (receiptId: number, itemId: number, copies = 1) => {
    const blob = await downloadGoodsReceiptItemLabelsPdf(receiptId, itemId, copies);
    const objectUrl = URL.createObjectURL(blob);
    window.open(objectUrl, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  };

  const resolvePurchaseOrderNumber = async (rawValue: string) => {
    const parsed = parseScanValue(rawValue);
    const orderNumber = parsed.type === "po_qr" ? parsed.value : parsed.normalized;
    if (!orderNumber) {
      setFlowFeedback("error", "Bitte eine gültige PO-Nummer scannen/eingeben");
      return;
    }
    await resolvePurchaseOrderMutation.mutateAsync(orderNumber);
  };

  const addScannedSerial = (rawValue: string) => {
    const parsed = parseScanValue(rawValue);
    const serial = (parsed.type === "serial_qr" ? parsed.value : parsed.normalized).trim();
    if (!serial) {
      return;
    }
    if (scannedSerials.includes(serial)) {
      setFlowFeedback("error", `Seriennummer bereits erfasst: ${serial}`);
      return;
    }

    const expected = Number(receivedQuantity);
    if (Number.isInteger(expected) && expected > 0 && scannedSerials.length >= expected) {
      setFlowFeedback("error", "Soll-Menge für Seriennummern bereits erreicht");
      return;
    }
    setScannedSerials((prev) => [...prev, serial]);
    setFlowFeedback("success", `Seriennummer erfasst (${scannedSerials.length + 1})`);
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
    if (receiptMode === "po") {
      setSourceType("supplier");
      setManualCondition("new");
      return;
    }
    if (sourceType === "supplier" || !manualCondition) {
      setManualCondition("new");
    }
  }, [receiptMode, sourceType]);

  useEffect(() => {
    if (!selectedProduct?.requires_item_tracking) {
      setScannedSerials([]);
      setSerialNumbersInput("");
    }
  }, [selectedProduct?.requires_item_tracking]);

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

  useEffect(() => {
    if (!selectedReceipt) {
      return;
    }
    setReceiptMode(selectedReceipt.mode);
    setSourceType(selectedReceipt.source_type);
    if (selectedReceipt.mode === "po" && selectedReceipt.purchase_order_id) {
      setPurchaseOrderId(String(selectedReceipt.purchase_order_id));
    }
  }, [selectedReceipt]);

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
    setFlowCondition("new");
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
    if (receiptMode === "po" && !purchaseOrderId) {
      setFlowFeedback("error", "Für Modus Bestellbezug ist ein Bestellauftrag erforderlich");
      return;
    }
    await createReceiptMutation.mutateAsync({
      supplier_id: supplierId ? Number(supplierId) : undefined,
      purchase_order_id: receiptMode === "po" && purchaseOrderId ? Number(purchaseOrderId) : undefined,
      mode: receiptMode,
      source_type: sourceType,
      notes: notes.trim() || undefined,
    });
  };

  const onAddItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedReceiptId || !selectedProductId || !selectedBinId) {
      return;
    }
    const serialNumbers = scannedSerials.length > 0 ? scannedSerials : parseSerialNumbers(serialNumbersInput);
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
    const conditionToSend = conditionRequiredForCurrentReceipt ? manualCondition : "new";
    if (conditionRequiredForCurrentReceipt && !conditionToSend) {
      setFlowFeedback("error", "Für freien WE muss ein Zustand ausgewählt werden");
      return;
    }
    const createdItem = await createItemMutation.mutateAsync({
      receiptId: selectedReceiptId,
      productId: Number(selectedProductId),
      quantity: receivedQuantity,
      targetBinId: Number(selectedBinId),
      serialNumbers: serialNumbers.length > 0 ? serialNumbers : undefined,
      purchaseOrderItemId: selectedPurchaseOrderItemId ? Number(selectedPurchaseOrderItemId) : undefined,
      input_method: "manual",
      condition: conditionToSend || undefined,
    });
    setManualCondition(conditionRequiredForCurrentReceipt ? "" : "new");
    setScannedSerials([]);
    if (selectedProduct?.requires_item_tracking && createdItem.id) {
      await triggerSerialLabelDownload(selectedReceiptId, createdItem.id);
    } else if (createdItem.id) {
      await triggerItemLabelDownload(selectedReceiptId, createdItem.id, 1);
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
      input_method: "scan",
      condition: conditionRequiredForCurrentReceipt ? flowCondition : "new",
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
        product_group_id: adHocCreateProductGroup ? null : adHocProductGroupId ? Number(adHocProductGroupId) : null,
        product_group_name: adHocCreateProductGroup ? adHocProductGroupName.trim() : undefined,
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
          <p className="section-subtitle mt-1 max-w-2xl">Header anlegen, Positionen erfassen und WE abschließen.</p>
        </div>
      </header>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Panel 1: Beleg anlegen (Create/Select) */}
        <ReceiptHeaderForm>
          <div className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm flex flex-col h-[calc(100vh-200px)] min-h-[500px] overflow-hidden">
            <div className="p-4 border-b border-[var(--line)] bg-[var(--panel-soft)]">
              <h3 className="section-title">1. Beleg anlegen</h3>
            </div>

            <div className="p-4 flex-1 overflow-hidden flex flex-col gap-4">
              <form
                className="flex flex-col gap-3"
                onSubmit={(event) => void onCreateReceipt(event)}
                data-testid="goods-receipt-create-form"
              >
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-[var(--ink)] mb-1.5">Eingangskanal</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className={`btn text-xs justify-center ${receiptMode === "po" ? "btn-primary" : "btn-ghost border border-[var(--line)]"}`}
                      onClick={() => setReceiptMode("po")}
                      data-testid="goods-receipt-mode-po-btn"
                    >
                      Modus A: Bestellung
                    </button>
                    <button
                      type="button"
                      className={`btn text-xs justify-center ${receiptMode === "free" ? "btn-primary" : "btn-ghost border border-[var(--line)]"}`}
                      onClick={() => setReceiptMode("free")}
                      data-testid="goods-receipt-mode-free-btn"
                    >
                      Modus B: Frei
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label
                    className="block text-sm font-medium text-[var(--ink)] mb-1.5"
                    htmlFor="goods-receipt-po-select"
                  >
                    Bestellauftrag
                  </label>
                  <select
                    id="goods-receipt-po-select"
                    className="input w-full min-w-0"
                    value={purchaseOrderId}
                    onChange={(event) => setPurchaseOrderId(event.target.value)}
                    disabled={receiptMode !== "po"}
                    data-testid="goods-receipt-po-select"
                  >
                    <option value="">Kein Auftrag</option>
                    {(purchaseOrdersQuery.data ?? []).map((purchaseOrder) => (
                      <option key={purchaseOrder.id} value={purchaseOrder.id}>
                        {purchaseOrder.order_number} ({purchaseOrder.status})
                      </option>
                    ))}
                  </select>
                  {receiptMode === "po" ? (
                    <div className="space-y-2 mt-1.5">
                      <div className="grid grid-cols-[1fr_auto] gap-2">
                        <input
                          className="input w-full"
                          value={poResolveInput}
                          onChange={(event) => setPoResolveInput(event.target.value)}
                          placeholder="PO-Nummer scannen/eingeben"
                          data-testid="goods-receipt-po-resolve-input"
                        />
                        <button
                          type="button"
                          className="btn btn-ghost text-xs border border-[var(--line)]"
                          onClick={() => void resolvePurchaseOrderNumber(poResolveInput)}
                          disabled={resolvePurchaseOrderMutation.isPending || !poResolveInput.trim()}
                          data-testid="goods-receipt-po-resolve-btn"
                        >
                          Auflösen
                        </button>
                      </div>
                      <WorkflowScanInput
                        enabled
                        isLoading={resolvePurchaseOrderMutation.isPending}
                        label="PO-Nummer scannen"
                        placeholder="DS:PO:... oder PO-Nummer"
                        onScan={(value) => resolvePurchaseOrderNumber(value)}
                        testIdPrefix="goods-receipt-po-scan"
                      />
                    </div>
                  ) : null}
                  {purchaseOrderId && receiptMode === "po" ? (
                    <button
                      type="button"
                      className="btn btn-ghost w-full justify-center mt-1.5 border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white text-xs"
                      onClick={() => void createReceiptFromPoMutation.mutateAsync(Number(purchaseOrderId))}
                      disabled={createReceiptFromPoMutation.isPending}
                      data-testid="goods-receipt-from-po-btn"
                    >
                      {createReceiptFromPoMutation.isPending
                        ? "Wird angelegt…"
                        : "Positionen aus Bestellung übernehmen"}
                    </button>
                  ) : null}
                </div>

                <div className="space-y-1">
                  <label
                    className="block text-sm font-medium text-[var(--ink)] mb-1.5"
                    htmlFor="goods-receipt-supplier-select"
                  >
                    Warenlieferant
                  </label>
                  <select
                    id="goods-receipt-supplier-select"
                    className="input w-full min-w-0"
                    value={supplierId}
                    onChange={(event) => setSupplierId(event.target.value)}
                    disabled={receiptMode === "free" && sourceType !== "supplier"}
                    data-testid="goods-receipt-supplier-select"
                  >
                    <option value="">Kein Warenlieferant</option>
                    {(suppliersQuery.data?.items ?? []).map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.supplier_number} - {supplier.company_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label
                    className="block text-sm font-medium text-[var(--ink)] mb-1.5"
                    htmlFor="goods-receipt-source-type-select"
                  >
                    Quelle
                  </label>
                  <select
                    id="goods-receipt-source-type-select"
                    className="input w-full min-w-0"
                    value={sourceType}
                    onChange={(event) => setSourceType(event.target.value as "supplier" | "technician" | "other")}
                    disabled={receiptMode === "po"}
                    data-testid="goods-receipt-source-type-select"
                  >
                    <option value="supplier">Lieferant</option>
                    <option value="technician">Techniker-Rückläufer</option>
                    <option value="other">Sonstige Quelle</option>
                  </select>
                </div>

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

              {receiptMode === "po" ? (
                <div className="border border-[var(--line)] rounded-[var(--radius-sm)] bg-[var(--panel-soft)] p-2 max-h-28 overflow-y-auto space-y-1">
                  {(purchaseOrdersQuery.data ?? []).map((purchaseOrder) => (
                    <button
                      key={purchaseOrder.id}
                      type="button"
                      className={`w-full text-left px-2 py-1.5 rounded text-xs border ${String(purchaseOrder.id) === purchaseOrderId ? "border-[var(--accent)] bg-[var(--panel)]" : "border-transparent hover:border-[var(--line)]"}`}
                      onClick={() => {
                        setPurchaseOrderId(String(purchaseOrder.id));
                        setPoResolveInput(purchaseOrder.order_number);
                      }}
                      data-testid={`goods-receipt-po-open-item-${purchaseOrder.id}`}
                    >
                      {purchaseOrder.order_number} · {purchaseOrder.status}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="border-b border-[var(--line)] my-1"></div>

              <div
                className="flex-1 overflow-y-auto border border-[var(--line)] rounded-[var(--radius-sm)] bg-[var(--bg)]"
                data-testid="goods-receipt-list"
              >
                {(receiptsQuery.data ?? []).length === 0 ? (
                  <div className="p-8 text-center text-[var(--muted)] italic text-sm">
                    Keine offenen Belege gefunden.
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--line)]">
                    {(receiptsQuery.data ?? []).map((receipt) => (
                      <div
                        key={receipt.id}
                        className={`w-full p-3 hover:bg-[var(--panel-soft)] transition-colors flex items-center justify-between gap-3 group
                            ${selectedReceiptId === receipt.id ? "bg-[var(--panel-strong)] border-l-4 border-l-[var(--accent)] pl-[calc(0.75rem-4px)]" : "border-l-4 border-l-transparent"}
                          `}
                      >
                        <button
                          className="text-left min-w-0 flex-1"
                          onClick={() => setSelectedReceiptId(receipt.id)}
                          data-testid={`goods-receipt-item-${receipt.id}`}
                        >
                          <div className="font-medium text-[var(--ink)] truncate">{receipt.receipt_number}</div>
                          <div className="text-xs text-[var(--muted)] flex items-center gap-1.5 mt-0.5">
                            <span
                              className={`inline-block w-2 h-2 rounded-full
                                ${
                                  receipt.status === "completed"
                                    ? "bg-emerald-500"
                                    : receipt.status === "cancelled"
                                      ? "bg-red-500"
                                      : "bg-amber-500"
                                }
                              `}
                            ></span>
                            {receipt.status}
                          </div>
                        </button>

                        {receipt.status === "draft" ? (
                          <button
                            type="button"
                            className="btn btn-ghost shrink-0 text-xs text-[var(--destructive)] hover:bg-red-50"
                            disabled={deleteMutation.isPending}
                            onClick={() => {
                              if (!window.confirm("Diesen Draft-Beleg wirklich loeschen?")) {
                                return;
                              }
                              void deleteMutation.mutateAsync(receipt.id);
                            }}
                            data-testid={`goods-receipt-item-delete-btn-${receipt.id}`}
                          >
                            Loeschen
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </ReceiptHeaderForm>

        {/* Panel 2: Scanner Workflow */}
        <ScanFlowPanel>
          <div className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm flex flex-col h-auto min-h-[500px] lg:h-[calc(100vh-200px)] overflow-hidden">
            <div className="p-4 border-b border-[var(--line)] bg-[var(--panel-soft)]">
              <h3 className="section-title">2. Scanner-Workflow</h3>
            </div>

            <div className="p-6 flex-1 flex flex-col relative overflow-y-auto">
              {/* Progress Indicator */}
              <div className="mb-6">
                <div className="flex justify-between text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">
                  <span>Fortschritt</span>
                  <span>{Math.round(flowProgress)}%</span>
                </div>
                <div className="h-2 w-full bg-[var(--line)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent)] transition-all duration-300 ease-out"
                    style={{ width: `${flowProgress}%` }}
                  />
                </div>
                <div className="flex justify-between mt-3">
                  {flowSteps.map((step, index) => (
                    <span
                      key={step.id}
                      className={`text-xs px-2 py-1 rounded transition-colors ${index <= flowStepIndex ? "text-[var(--ink)] font-medium bg-[var(--panel-strong)]" : "text-[var(--muted)]"}`}
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
                    {conditionRequiredForCurrentReceipt ? (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-[var(--muted)]">Zustand</label>
                        <div className="grid grid-cols-3 gap-2">
                          {(["new", "defective", "needs_repair"] as const).map((c) => (
                            <button
                              key={c}
                              type="button"
                              className={`btn py-2 text-xs ${flowCondition === c ? "btn-primary" : "btn-ghost border border-[var(--line)]"}`}
                              onClick={() => setFlowCondition(c)}
                              data-testid={`goods-receipt-flow-condition-${c}`}
                            >
                              {c === "new" ? "Neuware" : c === "defective" ? "Defekt" : "Reparaturbedarf"}
                            </button>
                          ))}
                        </div>
                        {flowCondition !== "new" ? (
                          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                            Artikel wird direkt ins RepairCenter gebucht
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    <button
                      className="btn btn-primary w-full justify-center py-3"
                      onClick={() => setFlowStep("bin_scan")}
                    >
                      Weiter zu Lagerplatz-Scan
                    </button>
                  </div>
                )}

                {flowStep === "bin_scan" && (
                  <div className="space-y-4 animate-in fade-in zoom-in duration-300">
                    {(binSuggestionsQuery.data?.length ?? 0) > 0 ? (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-[var(--muted)]">Vorgeschlagene Lagerplätze</label>
                        <div className="space-y-1.5">
                          {(binSuggestionsQuery.data ?? []).map((suggestion) => (
                            <button
                              key={suggestion.bin_id}
                              type="button"
                              className="w-full text-left p-2.5 rounded border border-[var(--line)] hover:border-[var(--accent)] hover:bg-[var(--panel-soft)] transition-colors flex items-center justify-between gap-2"
                              onClick={() => {
                                const selectedBin: BinLocation = {
                                  id: suggestion.bin_id,
                                  zone_id: suggestion.zone_id,
                                  code: suggestion.bin_code,
                                  bin_type: "storage",
                                  max_weight: null,
                                  max_volume: null,
                                  qr_code_data: null,
                                  is_active: true,
                                  is_occupied: false,
                                  occupied_quantity: suggestion.current_quantity,
                                  created_at: "",
                                  updated_at: "",
                                };
                                setFlowBin(selectedBin);
                                setSelectedBinId(String(suggestion.bin_id));
                                setFlowStep("confirm");
                                setFlowFeedback("success", `Lagerplatz ausgewählt: ${suggestion.bin_code}`);
                              }}
                              data-testid={`goods-receipt-bin-suggestion-${suggestion.bin_id}`}
                            >
                              <div>
                                <div className="font-medium text-sm text-[var(--ink)]">
                                  {suggestion.bin_code}
                                  {suggestion.priority === "default" ? (
                                    <span className="ml-2 inline-block px-1.5 py-0.5 text-xs rounded bg-emerald-100 text-emerald-800">
                                      Standard
                                    </span>
                                  ) : null}
                                </div>
                                <div className="text-xs text-[var(--muted)]">
                                  {suggestion.warehouse_code} / {suggestion.zone_code}
                                </div>
                              </div>
                              <span className="text-xs text-[var(--muted)] shrink-0">
                                {suggestion.current_quantity} Stk.
                              </span>
                            </button>
                          ))}
                        </div>
                        <div className="relative my-2">
                          <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-[var(--line)]"></span>
                          </div>
                          <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-[var(--panel)] px-2 text-[var(--muted)] font-medium">
                              oder manuell scannen
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    <WorkflowScanInput
                      enabled
                      isLoading={flowLoading}
                      label="Lagerplatz scannen"
                      placeholder="Lagerplatzcode scannen"
                      onScan={(value) => onFlowBinScan(value)}
                      testIdPrefix="goods-receipt-flow-bin-scan"
                    />
                  </div>
                )}

                {flowStep === "confirm" && (
                  <div className="space-y-4 animate-in fade-in zoom-in duration-300">
                    <div className="bg-[var(--panel-soft)] p-4 rounded-[var(--radius-md)] border border-[var(--line)] space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-[var(--muted)]">Produkt:</span>
                        <span className="font-medium text-[var(--ink)] text-right max-w-[60%] truncate">
                          {flowProduct?.product_number}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-[var(--muted)]">Menge:</span>
                        <span className="font-bold text-[var(--accent)] text-lg">{flowQuantity}</span>
                      </div>
                      <div className="flex justify-between border-t border-[var(--line)] pt-2">
                        <span className="text-sm text-[var(--muted)]">Zielplatz:</span>
                        <span className="font-medium text-[var(--ink)]">{flowBin?.code}</span>
                      </div>
                      {conditionRequiredForCurrentReceipt && flowCondition !== "new" ? (
                        <div
                          className={`flex justify-between border-t border-[var(--line)] pt-2 ${flowCondition === "defective" ? "text-red-700" : "text-amber-700"}`}
                        >
                          <span className="text-sm">Zustand:</span>
                          <span className="font-medium text-sm">
                            {flowCondition === "defective" ? "Defekt" : "Reparaturbedarf"}
                          </span>
                        </div>
                      ) : null}
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
                  <input
                    className="input w-full md:col-span-2"
                    value={productSearch}
                    onChange={(event) => setProductSearch(event.target.value)}
                    placeholder="Artikel suchen (Nummer, Name, Beschreibung)"
                    data-testid="goods-receipt-product-search-input"
                  />
                  <select
                    className="input w-full md:col-span-2"
                    value={selectedProductId}
                    onChange={(event) => setSelectedProductId(event.target.value)}
                    required
                    data-testid="goods-receipt-product-select"
                  >
                    <option value="">Artikel wählen</option>
                    {filteredProducts.map((product) => (
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
                            #{poItem.id} - bestellt {poItem.ordered_quantity} {poItem.unit} / erhalten{" "}
                            {poItem.received_quantity}
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

                  {canCreateBins && selectedZoneId ? (
                    <div className="md:col-span-2 grid grid-cols-[1fr_auto] gap-2">
                      <input
                        className="input w-full"
                        value={newBinCode}
                        onChange={(event) => setNewBinCode(event.target.value)}
                        placeholder="Neuen Überlauf-Platz anlegen (Code)"
                        data-testid="goods-receipt-new-bin-code-input"
                      />
                      <button
                        type="button"
                        className="btn btn-ghost border border-[var(--line)]"
                        disabled={createBinMutation.isPending || !newBinCode.trim()}
                        onClick={() =>
                          selectedZoneId &&
                          void createBinMutation.mutateAsync({ zoneId: selectedZoneId, code: newBinCode.trim() })
                        }
                        data-testid="goods-receipt-create-bin-btn"
                      >
                        Platz anlegen
                      </button>
                    </div>
                  ) : null}

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
                    <div className="md:col-span-2 space-y-2">
                      <WorkflowScanInput
                        enabled
                        isLoading={false}
                        label={`Seriennummern einzeln scannen (${scannedSerials.length}/${receivedQuantity || "0"})`}
                        placeholder="Seriennummer scannen"
                        onScan={(value) => addScannedSerial(value)}
                        testIdPrefix="goods-receipt-serial-scan"
                      />
                      {scannedSerials.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 border border-[var(--line)] rounded p-2 bg-[var(--panel)]">
                          {scannedSerials.map((serial) => (
                            <button
                              key={serial}
                              type="button"
                              className="text-xs px-2 py-1 rounded border border-[var(--line)] bg-[var(--panel-soft)]"
                              onClick={() => setScannedSerials((prev) => prev.filter((entry) => entry !== serial))}
                            >
                              {serial} ×
                            </button>
                          ))}
                        </div>
                      ) : null}
                      <textarea
                        className="input w-full min-h-[90px]"
                        value={serialNumbersInput}
                        onChange={(event) => setSerialNumbersInput(event.target.value)}
                        required={scannedSerials.length === 0}
                        data-testid="goods-receipt-serial-input"
                        placeholder="Oder Seriennummern einfügen (eine pro Zeile oder komma-separiert)"
                      />
                    </div>
                  ) : null}

                  {conditionRequiredForCurrentReceipt ? (
                    <select
                      className="input w-full md:col-span-2"
                      value={manualCondition}
                      onChange={(event) =>
                        setManualCondition(event.target.value as "" | "new" | "defective" | "needs_repair")
                      }
                      required
                      data-testid="goods-receipt-manual-condition-select"
                    >
                      <option value="">Zustand wählen...</option>
                      <option value="new">Neuware</option>
                      <option value="defective">Defekt</option>
                      <option value="needs_repair">Reparaturbedarf</option>
                    </select>
                  ) : null}
                </div>

                <button
                  className="btn w-full justify-center"
                  type="submit"
                  disabled={
                    !selectedReceiptId ||
                    (selectedReceipt !== null && selectedReceipt.status !== "draft") ||
                    createItemMutation.isPending
                  }
                  data-testid="goods-receipt-add-item-btn"
                >
                  Position hinzufügen
                </button>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-4 border-t border-[var(--line)]">
                <button
                  className="btn btn-ghost w-full justify-center text-[var(--destructive)] hover:bg-red-50"
                  type="button"
                  disabled={!selectedReceiptId || selectedReceipt?.status !== "draft" || deleteMutation.isPending}
                  onClick={() => {
                    if (!selectedReceiptId) {
                      return;
                    }
                    if (!window.confirm("Diesen Draft-Beleg wirklich loeschen?")) {
                      return;
                    }
                    void deleteMutation.mutateAsync(selectedReceiptId);
                  }}
                  data-testid="goods-receipt-delete-btn"
                >
                  Loeschen
                </button>

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
        </ScanFlowPanel>

        {/* Panel 3: Erfasste Positionen */}
        <ReceiptItemForm>
          <div className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm flex flex-col h-[calc(100vh-200px)] min-h-[500px] overflow-hidden">
            <div className="p-4 border-b border-[var(--line)] bg-[var(--panel-soft)]">
              <h3 className="section-title">3. Erfasste Positionen</h3>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-3" data-testid="goods-receipt-items-list">
              <div className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-2 px-1">Liste</div>

              {(receiptItemsQuery.data ?? []).map((item) => (
                <div
                  key={item.id}
                  className="p-3 border border-[var(--line)] rounded-[var(--radius-sm)] bg-[var(--bg)] hover:border-[var(--line-strong)] transition-colors min-w-0"
                  data-testid={`goods-receipt-item-row-${item.id}`}
                >
                  <div className="flex justify-between items-start mb-1 gap-2">
                    <strong className="text-[var(--ink)] text-sm font-semibold truncate block break-words min-w-0 pr-2">
                      {item.product_number
                        ? `${item.product_number} · ${item.product_name ?? ""}`
                        : `#${item.product_id}`}
                    </strong>
                    <span className="text-xs font-mono bg-[var(--panel-soft)] px-1.5 py-0.5 rounded border border-[var(--line)] text-[var(--ink)] shrink-0">
                      {item.received_quantity}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--muted)] flex items-center gap-2 truncate">
                    <span className="truncate">Menge: {item.received_quantity}</span>
                    <span className="truncate">Ziel: {item.target_bin_code ?? `Bin #${item.target_bin_id}`}</span>
                    {item.expected_open_quantity ? (
                      <span className="truncate">Soll offen: {item.expected_open_quantity}</span>
                    ) : null}
                    {item.variance_quantity ? <span className="truncate">Delta: {item.variance_quantity}</span> : null}
                  </div>
                  <div className="mt-1 text-xs text-[var(--muted)]">
                    Zustand:{" "}
                    {item.condition === "new"
                      ? "Neuware"
                      : item.condition === "defective"
                        ? "Defekt"
                        : "Reparaturbedarf"}
                  </div>
                  {item.serial_numbers && item.serial_numbers.length > 0 ? (
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-[var(--muted)]">Seriennummern: {item.serial_numbers.length}</span>
                      <button
                        type="button"
                        className="btn btn-ghost text-xs"
                        onClick={() => selectedReceiptId && void triggerSerialLabelDownload(selectedReceiptId, item.id)}
                        data-testid={`goods-receipt-item-print-labels-btn-${item.id}`}
                      >
                        Labels drucken
                      </button>
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center justify-end">
                      <button
                        type="button"
                        className="btn btn-ghost text-xs"
                        onClick={() => selectedReceiptId && void triggerItemLabelDownload(selectedReceiptId, item.id)}
                        data-testid={`goods-receipt-item-print-item-labels-btn-${item.id}`}
                      >
                        Artikel-Labels drucken
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {!receiptItemsQuery.isLoading && (receiptItemsQuery.data?.length ?? 0) === 0 ? (
                <div className="text-center text-[var(--muted)] py-8 italic text-sm border border-dashed border-[var(--line)] rounded-[var(--radius-md)]">
                  Noch keine Positionen erfasst.
                </div>
              ) : null}
            </div>
          </div>
        </ReceiptItemForm>
      </div>

      {showAdHocModal ? (
        <AdHocProductModal>
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
                  disabled={adHocCreateProductGroup}
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
                    checked={adHocCreateProductGroup}
                    onChange={(event) => setAdHocCreateProductGroup(event.target.checked)}
                    data-testid="goods-receipt-adhoc-product-create-group"
                  />
                  Neue Produktgruppe anlegen
                </label>
                {adHocCreateProductGroup ? (
                  <input
                    className="input w-full"
                    value={adHocProductGroupName}
                    onChange={(event) => setAdHocProductGroupName(event.target.value)}
                    placeholder="Name der neuen Produktgruppe"
                    data-testid="goods-receipt-adhoc-product-group-name"
                    required
                  />
                ) : null}
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
                    onClick={() => {
                      setShowAdHocModal(false);
                      setAdHocProductNumber("");
                      setAdHocProductName("");
                      setAdHocProductGroupId("");
                      setAdHocCreateProductGroup(false);
                      setAdHocProductGroupName("");
                      setAdHocRequiresTracking(false);
                    }}
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
        </AdHocProductModal>
      ) : null}
    </section>
  );
}
