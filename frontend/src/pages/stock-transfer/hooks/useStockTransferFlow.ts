import { useMemo, useState } from "react";

import { fetchInventoryByBin } from "../../../services/inventoryApi";
import { fetchProductByEan, fetchProductByQr } from "../../../services/productsApi";
import { fetchBinByQr } from "../../../services/warehousesApi";
import type { BinLocation, InventoryByBinItem, Product } from "../../../types";
import { parseScanValue } from "../../../utils/scannerUtils";

export type TransferFlowStep = "source_bin_scan" | "product_scan" | "quantity" | "target_bin_scan" | "confirm";

type UseStockTransferFlowParams = {
  products: Product[];
  bins: BinLocation[];
  onSourceBinResolved: (bin: BinLocation) => void;
  onTargetBinResolved: (bin: BinLocation) => void;
  onProductResolved: (product: Product) => void;
};

const flowSteps: TransferFlowStep[] = ["source_bin_scan", "product_scan", "quantity", "target_bin_scan", "confirm"];

export function useStockTransferFlow({
  products,
  bins,
  onSourceBinResolved,
  onTargetBinResolved,
  onProductResolved,
}: UseStockTransferFlowParams) {
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
        const byNumber = products.find(
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
      const byNumber = products.find((item) => item.product_number === parsed.normalized);
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
      const byCode = bins.find((bin) => bin.code === parsed.normalized);
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
      onSourceBinResolved(sourceBin);

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
      onProductResolved(product);
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
      onTargetBinResolved(targetBin);
      setFlowStep("confirm");
      setFlowFeedback("success", `Ziel erkannt: ${targetBin.code}`);
    } catch {
      setFlowFeedback("error", "Ziel-Lagerplatzscan fehlgeschlagen");
    } finally {
      setFlowLoading(false);
    }
  };

  const availableStock = useMemo(() => {
    if (!flowStockItem) {
      return 0;
    }
    return Number(flowStockItem.quantity) - Number(flowStockItem.reserved_quantity);
  }, [flowStockItem]);

  const transferQty = useMemo(() => Number(flowQuantity || 0), [flowQuantity]);

  const flowProgress = useMemo(() => {
    const flowStepIndex = flowSteps.findIndex((step) => step === flowStep);
    return ((flowStepIndex + 1) / flowSteps.length) * 100;
  }, [flowStep]);

  return {
    flowStep,
    setFlowStep,
    flowSourceBin,
    flowTargetBin,
    flowProduct,
    flowQuantity,
    setFlowQuantity,
    flowLoading,
    flowFeedbackStatus,
    flowFeedbackMessage,
    availableStock,
    transferQty,
    flowProgress,
    setFlowFeedback,
    resetFlow,
    onFlowSourceBinScan,
    onFlowProductScan,
    onFlowTargetBinScan,
  };
}
