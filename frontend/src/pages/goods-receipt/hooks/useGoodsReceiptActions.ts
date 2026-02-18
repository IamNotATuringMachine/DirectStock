import type { FormEvent } from "react";

import { fetchProductByEan, fetchProductByQr } from "../../../services/productsApi";
import { fetchBinByQr } from "../../../services/warehousesApi";
import type { BinLocation, Product } from "../../../types";
import { parseScanValue } from "../../../utils/scannerUtils";

export function useGoodsReceiptActions(ctx: any) {
  const parseSerialNumbers = (raw: string): string[] =>
    raw
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

  const setFlowFeedback = (status: "idle" | "success" | "error", message: string | null) => {
    ctx.setFlowFeedbackStatus(status);
    ctx.setFlowFeedbackMessage(message);
  };

  const triggerSerialLabelDownload = async (receiptId: number, itemId: number) => {
    const blob = await ctx.downloadGoodsReceiptItemSerialLabelsPdf(receiptId, itemId);
    const objectUrl = URL.createObjectURL(blob);
    window.open(objectUrl, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  };

  const triggerItemLabelDownload = async (receiptId: number, itemId: number, copies = 1) => {
    const blob = await ctx.downloadGoodsReceiptItemLabelsPdf(receiptId, itemId, copies);
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
    await ctx.resolvePurchaseOrderMutation.mutateAsync(orderNumber);
  };

  const addScannedSerial = (rawValue: string) => {
    const parsed = parseScanValue(rawValue);
    const serial = (parsed.type === "serial_qr" ? parsed.value : parsed.normalized).trim();
    if (!serial) {
      return;
    }
    if (ctx.scannedSerials.includes(serial)) {
      setFlowFeedback("error", `Seriennummer bereits erfasst: ${serial}`);
      return;
    }

    const expected = Number(ctx.receivedQuantity);
    if (Number.isInteger(expected) && expected > 0 && ctx.scannedSerials.length >= expected) {
      setFlowFeedback("error", "Soll-Menge für Seriennummern bereits erreicht");
      return;
    }
    ctx.setScannedSerials((prev: string[]) => [...prev, serial]);
    setFlowFeedback("success", `Seriennummer erfasst (${ctx.scannedSerials.length + 1})`);
  };

  const resetFlow = () => {
    ctx.setFlowStep("product_scan");
    ctx.setFlowProduct(null);
    ctx.setFlowBin(null);
    ctx.setFlowQuantity("1");
    ctx.setFlowCondition("new");
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
        const byNumber = (ctx.productsQuery.data?.items ?? []).find(
          (item: any) => item.product_number === parsed.value || item.product_number === parsed.normalized
        );
        if (byNumber) {
          return byNumber;
        }
      }
    }

    try {
      return await fetchProductByQr(parsed.normalized);
    } catch {
      const byNumber = (ctx.productsQuery.data?.items ?? []).find(
        (item: any) => item.product_number === parsed.normalized
      );
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
      const byCode = (ctx.binsQuery.data ?? []).find((bin: any) => bin.code === parsed.normalized);
      if (!byCode) {
        throw new Error("Lagerplatz konnte aus dem Scan nicht aufgelöst werden");
      }
      return byCode;
    }
  };

  const onFlowProductScan = async (value: string) => {
    ctx.setFlowLoading(true);
    try {
      const product = await resolveProductFromScan(value);
      ctx.setFlowProduct(product);
      ctx.setSelectedProductId(String(product.id));
      ctx.setFlowStep("quantity");
      setFlowFeedback("success", `Produkt erkannt: ${product.product_number}`);
    } catch {
      setFlowFeedback("error", "Produktscan fehlgeschlagen");
    } finally {
      ctx.setFlowLoading(false);
    }
  };

  const onFlowBinScan = async (value: string) => {
    ctx.setFlowLoading(true);
    try {
      const bin = await resolveBinFromScan(value);
      ctx.setFlowBin(bin);
      ctx.setSelectedBinId(String(bin.id));
      ctx.setFlowStep("confirm");
      setFlowFeedback("success", `Lagerplatz erkannt: ${bin.code}`);
    } catch {
      setFlowFeedback("error", "Lagerplatzscan fehlgeschlagen");
    } finally {
      ctx.setFlowLoading(false);
    }
  };

  const onCreateReceipt = async (event: FormEvent) => {
    event.preventDefault();
    if (ctx.receiptMode === "po" && !ctx.purchaseOrderId) {
      setFlowFeedback("error", "Für Modus Bestellbezug ist ein Bestellauftrag erforderlich");
      return;
    }
    await ctx.createReceiptMutation.mutateAsync({
      supplier_id: ctx.supplierId ? Number(ctx.supplierId) : undefined,
      purchase_order_id: ctx.receiptMode === "po" && ctx.purchaseOrderId ? Number(ctx.purchaseOrderId) : undefined,
      mode: ctx.receiptMode,
      source_type: ctx.sourceType,
      notes: ctx.notes.trim() || undefined,
    });
  };

  const onAddItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!ctx.selectedReceiptId || !ctx.selectedProductId || !ctx.selectedBinId) {
      return;
    }
    const serialNumbers =
      ctx.scannedSerials.length > 0 ? ctx.scannedSerials : parseSerialNumbers(ctx.serialNumbersInput);
    if (ctx.selectedProduct?.requires_item_tracking) {
      const parsedQuantity = Number(ctx.receivedQuantity);
      if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
        setFlowFeedback("error", "Getrackte Artikel erfordern eine ganze Menge");
        return;
      }
      if (serialNumbers.length !== parsedQuantity) {
        setFlowFeedback("error", "Anzahl Seriennummern muss der Menge entsprechen");
        return;
      }
    }
    if (ctx.selectedReceipt?.purchase_order_id && !ctx.selectedPurchaseOrderItemId) {
      setFlowFeedback("error", "Bitte PO-Position für den Artikel auswählen");
      return;
    }
    const conditionToSend = ctx.conditionRequiredForCurrentReceipt ? ctx.manualCondition : "new";
    if (ctx.conditionRequiredForCurrentReceipt && !conditionToSend) {
      setFlowFeedback("error", "Für freien WE muss ein Zustand ausgewählt werden");
      return;
    }

    const createdItem = await ctx.createItemMutation.mutateAsync({
      receiptId: ctx.selectedReceiptId,
      productId: Number(ctx.selectedProductId),
      quantity: ctx.receivedQuantity,
      targetBinId: Number(ctx.selectedBinId),
      serialNumbers: serialNumbers.length > 0 ? serialNumbers : undefined,
      purchaseOrderItemId: ctx.selectedPurchaseOrderItemId ? Number(ctx.selectedPurchaseOrderItemId) : undefined,
      input_method: "manual",
      condition: conditionToSend || undefined,
    });

    ctx.setManualCondition(ctx.conditionRequiredForCurrentReceipt ? "" : "new");
    ctx.setScannedSerials([]);
    if (ctx.selectedProduct?.requires_item_tracking && createdItem.id) {
      await triggerSerialLabelDownload(ctx.selectedReceiptId, createdItem.id);
    } else if (createdItem.id) {
      await triggerItemLabelDownload(ctx.selectedReceiptId, createdItem.id, 1);
    }
  };

  const onConfirmFlowItem = async () => {
    if (!ctx.selectedReceiptId || !ctx.flowProduct || !ctx.flowBin) {
      setFlowFeedback("error", "Bitte zuerst WE-Header sowie Produkt und Lagerplatz erfassen");
      return;
    }
    if (ctx.flowProduct.requires_item_tracking) {
      setFlowFeedback("error", "Getrackte Artikel bitte im manuellen Formular mit Seriennummern erfassen");
      return;
    }

    const matchingPoItem = ctx.selectedReceipt?.purchase_order_id
      ? (ctx.purchaseOrderItemsQuery.data ?? []).find((poItem: any) => poItem.product_id === ctx.flowProduct.id)
      : null;

    if (ctx.selectedReceipt?.purchase_order_id && !matchingPoItem) {
      setFlowFeedback("error", "Keine passende PO-Position für gescannten Artikel gefunden");
      return;
    }

    await ctx.createItemMutation.mutateAsync({
      receiptId: ctx.selectedReceiptId,
      productId: ctx.flowProduct.id,
      quantity: ctx.flowQuantity,
      targetBinId: ctx.flowBin.id,
      purchaseOrderItemId: matchingPoItem?.id,
      input_method: "scan",
      condition: ctx.conditionRequiredForCurrentReceipt ? ctx.flowCondition : "new",
    });

    setFlowFeedback("success", "Position erfasst");
    resetFlow();
  };

  const onCreateAdHocProduct = async (event: FormEvent) => {
    event.preventDefault();
    if (!ctx.selectedReceiptId) {
      return;
    }
    await ctx.adHocProductMutation.mutateAsync({
      receiptId: ctx.selectedReceiptId,
      payload: {
        product_number: ctx.adHocProductNumber.trim(),
        name: ctx.adHocProductName.trim(),
        description: null,
        product_group_id: ctx.adHocCreateProductGroup
          ? null
          : ctx.adHocProductGroupId
            ? Number(ctx.adHocProductGroupId)
            : null,
        product_group_name: ctx.adHocCreateProductGroup ? ctx.adHocProductGroupName.trim() : undefined,
        unit: "piece",
        status: "active",
        requires_item_tracking: ctx.adHocRequiresTracking,
      },
    });
  };

  return {
    parseSerialNumbers,
    setFlowFeedback,
    triggerSerialLabelDownload,
    triggerItemLabelDownload,
    resolvePurchaseOrderNumber,
    addScannedSerial,
    resetFlow,
    onFlowProductScan,
    onFlowBinScan,
    onCreateReceipt,
    onAddItem,
    onConfirmFlowItem,
    onCreateAdHocProduct,
  };
}
