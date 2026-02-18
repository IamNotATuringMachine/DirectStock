import { useState } from "react";

import type { BinLocation, Product } from "../../../types";
import type { ReceiptFlowStep } from "../state";

export function useGoodsReceiptState() {
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

  const resetAdHocModal = () => {
    setShowAdHocModal(false);
    setAdHocProductNumber("");
    setAdHocProductName("");
    setAdHocProductGroupId("");
    setAdHocCreateProductGroup(false);
    setAdHocProductGroupName("");
    setAdHocRequiresTracking(false);
  };

  return {
    receiptMode,
    setReceiptMode,
    sourceType,
    setSourceType,
    poResolveInput,
    setPoResolveInput,
    notes,
    setNotes,
    supplierId,
    setSupplierId,
    purchaseOrderId,
    setPurchaseOrderId,
    selectedReceiptId,
    setSelectedReceiptId,
    selectedProductId,
    setSelectedProductId,
    productSearch,
    setProductSearch,
    selectedPurchaseOrderItemId,
    setSelectedPurchaseOrderItemId,
    receivedQuantity,
    setReceivedQuantity,
    serialNumbersInput,
    setSerialNumbersInput,
    scannedSerials,
    setScannedSerials,
    showAdHocModal,
    setShowAdHocModal,
    adHocProductNumber,
    setAdHocProductNumber,
    adHocProductName,
    setAdHocProductName,
    adHocProductGroupId,
    setAdHocProductGroupId,
    adHocCreateProductGroup,
    setAdHocCreateProductGroup,
    adHocProductGroupName,
    setAdHocProductGroupName,
    adHocRequiresTracking,
    setAdHocRequiresTracking,
    selectedWarehouseId,
    setSelectedWarehouseId,
    selectedZoneId,
    setSelectedZoneId,
    selectedBinId,
    setSelectedBinId,
    newBinCode,
    setNewBinCode,
    flowStep,
    setFlowStep,
    flowProduct,
    setFlowProduct,
    flowBin,
    setFlowBin,
    flowQuantity,
    setFlowQuantity,
    flowLoading,
    setFlowLoading,
    flowFeedbackStatus,
    setFlowFeedbackStatus,
    flowFeedbackMessage,
    setFlowFeedbackMessage,
    flowCondition,
    setFlowCondition,
    manualCondition,
    setManualCondition,
    resetAdHocModal,
  };
}
