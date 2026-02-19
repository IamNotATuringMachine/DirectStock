import { useEffect } from "react";

import type { GoodsReceipt, PurchaseOrderItem } from "../../../types";

type UseGoodsReceiptSyncEffectsParams = {
  receiptMode: "po" | "free";
  sourceType: "supplier" | "technician" | "other";
  manualCondition: "" | "new" | "defective" | "needs_repair";
  setSourceType: (sourceType: "supplier" | "technician" | "other") => void;
  setManualCondition: (condition: "" | "new" | "defective" | "needs_repair") => void;
  selectedProductRequiresItemTracking: boolean | undefined;
  setScannedSerials: (serials: string[]) => void;
  setSerialNumbersInput: (value: string) => void;
  selectedReceipt: GoodsReceipt | null;
  purchaseOrderItems: PurchaseOrderItem[] | undefined;
  selectedProductId: string;
  setSelectedPurchaseOrderItemId: (value: string) => void;
  setPurchaseOrderId: (value: string) => void;
  setReceiptMode: (mode: "po" | "free") => void;
};

export function useGoodsReceiptSyncEffects({
  receiptMode,
  sourceType,
  manualCondition,
  setSourceType,
  setManualCondition,
  selectedProductRequiresItemTracking,
  setScannedSerials,
  setSerialNumbersInput,
  selectedReceipt,
  purchaseOrderItems,
  selectedProductId,
  setSelectedPurchaseOrderItemId,
  setPurchaseOrderId,
  setReceiptMode,
}: UseGoodsReceiptSyncEffectsParams) {
  useEffect(() => {
    if (receiptMode === "po") {
      setSourceType("supplier");
      setManualCondition("new");
      return;
    }
    if (sourceType === "supplier" || !manualCondition) {
      setManualCondition("new");
    }
  }, [manualCondition, receiptMode, setManualCondition, setSourceType, sourceType]);

  useEffect(() => {
    if (!selectedProductRequiresItemTracking) {
      setScannedSerials([]);
      setSerialNumbersInput("");
    }
  }, [selectedProductRequiresItemTracking, setScannedSerials, setSerialNumbersInput]);

  useEffect(() => {
    if (!selectedReceipt?.purchase_order_id) {
      setSelectedPurchaseOrderItemId("");
      return;
    }
    if (!selectedProductId) {
      setSelectedPurchaseOrderItemId("");
      return;
    }
    const matchingPoItem = (purchaseOrderItems ?? []).find((poItem) => poItem.product_id === Number(selectedProductId));
    setSelectedPurchaseOrderItemId(matchingPoItem ? String(matchingPoItem.id) : "");
  }, [purchaseOrderItems, selectedProductId, selectedReceipt?.purchase_order_id, setSelectedPurchaseOrderItemId]);

  useEffect(() => {
    if (!selectedReceipt) {
      return;
    }
    setReceiptMode(selectedReceipt.mode);
    setSourceType(selectedReceipt.source_type);
    if (selectedReceipt.mode === "po" && selectedReceipt.purchase_order_id) {
      setPurchaseOrderId(String(selectedReceipt.purchase_order_id));
    }
  }, [selectedReceipt, setPurchaseOrderId, setReceiptMode, setSourceType]);
}
