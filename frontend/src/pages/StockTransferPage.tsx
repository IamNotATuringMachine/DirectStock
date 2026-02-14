import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
  { id: "source_bin_scan", label: "Quelle scannen" },
  { id: "product_scan", label: "Artikel scannen" },
  { id: "quantity", label: "Menge" },
  { id: "target_bin_scan", label: "Ziel scannen" },
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
    <section className="panel" data-testid="stock-transfer-page">
      <header className="panel-header">
        <div>
          <h2>Umlagerung</h2>
          <p className="panel-subtitle">Transferbeleg anlegen, Positionen erfassen und atomar umbuchen.</p>
        </div>
      </header>

      <div className="warehouse-grid">
        <article className="subpanel">
          <h3>1. Beleg anlegen</h3>
          <form className="form-grid" onSubmit={(event) => void onCreateTransfer(event)}>
            <input
              className="input"
              placeholder="Notiz (optional)"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
            <button className="btn" type="submit" disabled={createTransferMutation.isPending}>
              Umlagerung erstellen
            </button>
          </form>

          <div className="list-stack small">
            {(transfersQuery.data ?? []).map((transfer) => (
              <button
                key={transfer.id}
                className={`list-item ${selectedTransferId === transfer.id ? "active" : ""}`}
                onClick={() => setSelectedTransferId(transfer.id)}
              >
                <strong>{transfer.transfer_number}</strong>
                <span>Status: {transfer.status}</span>
              </button>
            ))}
          </div>
        </article>

        <article className="subpanel">
          <h3>2. Scanner-Workflow</h3>

          <div className="workflow-progress">
            <div className="workflow-progress-track">
              <div className="workflow-progress-value" style={{ width: `${flowProgress}%` }} />
            </div>
            <div className="workflow-step-list">
              {flowSteps.map((step, index) => (
                <span key={step.id} className={`workflow-step-chip ${index <= flowStepIndex ? "active" : ""}`}>
                  {step.label}
                </span>
              ))}
            </div>
          </div>

          {flowStep === "source_bin_scan" ? (
            <WorkflowScanInput
              enabled
              isLoading={flowLoading}
              label="Quell-Lagerplatz scannen"
              placeholder="Quelle scannen"
              onScan={(value) => onFlowSourceBinScan(value)}
              testIdPrefix="stock-transfer-flow-source-scan"
            />
          ) : null}

          {flowStep === "product_scan" ? (
            <WorkflowScanInput
              enabled
              isLoading={flowLoading}
              label="Artikel scannen"
              placeholder="Artikel scannen"
              onScan={(value) => onFlowProductScan(value)}
              testIdPrefix="stock-transfer-flow-product-scan"
            />
          ) : null}

          {flowStep === "quantity" ? (
            <div className="workflow-block">
              <p className="workflow-label">Menge erfassen</p>
              <p>
                Verfügbar in Quelle: <strong>{availableStock.toFixed(3)}</strong>
              </p>
              <input
                className="input"
                type="number"
                min="0.001"
                step="0.001"
                value={flowQuantity}
                onChange={(event) => setFlowQuantity(event.target.value)}
              />
              <button className="btn workflow-btn" onClick={() => setFlowStep("target_bin_scan")}>
                Weiter zu Ziel-Scan
              </button>
            </div>
          ) : null}

          {flowStep === "target_bin_scan" ? (
            <WorkflowScanInput
              enabled
              isLoading={flowLoading}
              label="Ziel-Lagerplatz scannen"
              placeholder="Ziel scannen"
              onScan={(value) => onFlowTargetBinScan(value)}
              testIdPrefix="stock-transfer-flow-target-scan"
            />
          ) : null}

          {flowStep === "confirm" ? (
            <div className="workflow-block">
              <p className="workflow-label">Bestätigen</p>
              <p>
                <strong>Quelle:</strong> {flowSourceBin?.code}
              </p>
              <p>
                <strong>Produkt:</strong> {flowProduct?.product_number} - {flowProduct?.name}
              </p>
              <p>
                <strong>Menge:</strong> {flowQuantity}
              </p>
              <p>
                <strong>Ziel:</strong> {flowTargetBin?.code}
              </p>
              <p>
                <strong>Rest in Quelle danach:</strong> {remainingAfterTransfer.toFixed(3)}
              </p>
              <button className="btn workflow-btn" onClick={() => void onConfirmFlowItem()} disabled={createItemMutation.isPending}>
                Position bestätigen
              </button>
            </div>
          ) : null}

          <ScanFeedback status={flowFeedbackStatus} message={flowFeedbackMessage} />

          <hr className="workflow-divider" />

          <h3>2b. Formular-Fallback</h3>
          <form className="form-grid" onSubmit={(event) => void onAddItem(event)}>
            <select
              className="input"
              value={selectedProductId}
              onChange={(event) => setSelectedProductId(event.target.value)}
              required
            >
              <option value="">Artikel wählen</option>
              {(productsQuery.data?.items ?? []).map((product) => (
                <option key={product.id} value={product.id}>
                  {product.product_number} - {product.name}
                </option>
              ))}
            </select>

            <select
              className="input"
              value={selectedWarehouseId ?? ""}
              onChange={(event) => {
                setSelectedWarehouseId(Number(event.target.value));
                setSelectedZoneId(null);
                setFromBinId("");
                setToBinId("");
              }}
            >
              {(warehousesQuery.data ?? []).map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.code} - {warehouse.name}
                </option>
              ))}
            </select>

            <select
              className="input"
              value={selectedZoneId ?? ""}
              onChange={(event) => {
                setSelectedZoneId(Number(event.target.value));
                setFromBinId("");
                setToBinId("");
              }}
            >
              {(zonesQuery.data ?? []).map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.code} - {zone.name}
                </option>
              ))}
            </select>

            <select className="input" value={fromBinId} onChange={(event) => setFromBinId(event.target.value)}>
              {(binsQuery.data ?? []).map((bin) => (
                <option key={bin.id} value={bin.id}>
                  Quelle: {bin.code}
                </option>
              ))}
            </select>

            <select className="input" value={toBinId} onChange={(event) => setToBinId(event.target.value)}>
              {(binsQuery.data ?? []).map((bin) => (
                <option key={bin.id} value={bin.id}>
                  Ziel: {bin.code}
                </option>
              ))}
            </select>

            <input
              className="input"
              type="number"
              min="0.001"
              step="0.001"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              required
            />

            <button
              className="btn"
              type="submit"
              disabled={!selectedTransferId || selectedTransfer?.status !== "draft" || createItemMutation.isPending}
            >
              Position hinzufügen
            </button>
          </form>

          <div className="actions-cell">
            <button
              className="btn"
              disabled={!selectedTransferId || selectedTransfer?.status !== "draft" || completeMutation.isPending}
              onClick={() => selectedTransferId && void completeMutation.mutateAsync(selectedTransferId)}
            >
              Umlagerung abschließen
            </button>
            <button
              className="btn"
              disabled={!selectedTransferId || selectedTransfer?.status !== "draft" || cancelMutation.isPending}
              onClick={() => selectedTransferId && void cancelMutation.mutateAsync(selectedTransferId)}
            >
              Umlagerung stornieren
            </button>
          </div>
        </article>

        <article className="subpanel">
          <h3>3. Erfasste Positionen</h3>
          <div className="list-stack small">
            {(transferItemsQuery.data ?? []).map((item) => (
              <div key={item.id} className="list-item static-item">
                <strong>Produkt #{item.product_id}</strong>
                <span>
                  Menge {item.quantity} | Bin {item.from_bin_id} → {item.to_bin_id}
                </span>
              </div>
            ))}
            {!transferItemsQuery.isLoading && (transferItemsQuery.data?.length ?? 0) === 0 ? (
              <p>Noch keine Positionen.</p>
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}
