import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import ScanFeedback from "../components/scanner/ScanFeedback";
import WorkflowScanInput from "../components/scanner/WorkflowScanInput";
import {
  cancelGoodsReceipt,
  completeGoodsReceipt,
  createGoodsReceipt,
  createGoodsReceiptItem,
  fetchGoodsReceiptItems,
  fetchGoodsReceipts,
} from "../services/operationsApi";
import { fetchProductByEan, fetchProductByQr, fetchProducts } from "../services/productsApi";
import { fetchBinByQr, fetchBins, fetchWarehouses, fetchZones } from "../services/warehousesApi";
import type { BinLocation, Product } from "../types";
import { parseScanValue } from "../utils/scannerUtils";

type ReceiptFlowStep = "product_scan" | "quantity" | "bin_scan" | "confirm";

const flowSteps: Array<{ id: ReceiptFlowStep; label: string }> = [
  { id: "product_scan", label: "Artikel scannen" },
  { id: "quantity", label: "Menge erfassen" },
  { id: "bin_scan", label: "Lagerplatz scannen" },
  { id: "confirm", label: "Bestätigen" },
];

export default function GoodsReceiptPage() {
  const queryClient = useQueryClient();

  const [notes, setNotes] = useState("");
  const [selectedReceiptId, setSelectedReceiptId] = useState<number | null>(null);

  const [selectedProductId, setSelectedProductId] = useState("");
  const [receivedQuantity, setReceivedQuantity] = useState("1");

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

  const receiptItemsQuery = useQuery({
    queryKey: ["goods-receipt-items", selectedReceiptId],
    queryFn: () => fetchGoodsReceiptItems(selectedReceiptId as number),
    enabled: selectedReceiptId !== null,
  });

  const productsQuery = useQuery({
    queryKey: ["products", "goods-receipt-picker"],
    queryFn: () => fetchProducts({ page: 1, pageSize: 200 }),
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
    }: {
      receiptId: number;
      productId: number;
      quantity: string;
      targetBinId: number;
    }) =>
      createGoodsReceiptItem(receiptId, {
        product_id: productId,
        received_quantity: quantity,
        target_bin_id: targetBinId,
        unit: "piece",
      }),
    onSuccess: async () => {
      setReceivedQuantity("1");
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

  const selectedReceipt = useMemo(
    () => receiptsQuery.data?.find((item) => item.id === selectedReceiptId) ?? null,
    [receiptsQuery.data, selectedReceiptId]
  );

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
    await createReceiptMutation.mutateAsync({ notes: notes.trim() || undefined });
  };

  const onAddItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedReceiptId || !selectedProductId || !selectedBinId) {
      return;
    }
    await createItemMutation.mutateAsync({
      receiptId: selectedReceiptId,
      productId: Number(selectedProductId),
      quantity: receivedQuantity,
      targetBinId: Number(selectedBinId),
    });
  };

  const onConfirmFlowItem = async () => {
    if (!selectedReceiptId || !flowProduct || !flowBin) {
      setFlowFeedback("error", "Bitte zuerst WE-Header sowie Produkt und Lagerplatz erfassen");
      return;
    }

    await createItemMutation.mutateAsync({
      receiptId: selectedReceiptId,
      productId: flowProduct.id,
      quantity: flowQuantity,
      targetBinId: flowBin.id,
    });

    setFlowFeedback("success", "Position erfasst");
    resetFlow();
  };

  return (
    <section className="panel" data-testid="goods-receipt-page">
      <header className="panel-header">
        <div>
          <h2>Wareneingang</h2>
          <p className="panel-subtitle">Header anlegen, Positionen erfassen und WE abschließen.</p>
        </div>
      </header>

      <div className="warehouse-grid">
        <article className="subpanel">
          <h3>1. Beleg anlegen</h3>
          <form className="form-grid" onSubmit={(event) => void onCreateReceipt(event)} data-testid="goods-receipt-create-form">
            <input
              className="input"
              placeholder="Notiz (optional)"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              data-testid="goods-receipt-notes-input"
            />
            <button className="btn" type="submit" disabled={createReceiptMutation.isPending} data-testid="goods-receipt-create-btn">
              WE-Header erstellen
            </button>
          </form>

          <div className="list-stack small" data-testid="goods-receipt-list">
            {(receiptsQuery.data ?? []).map((receipt) => (
              <button
                key={receipt.id}
                className={`list-item ${selectedReceiptId === receipt.id ? "active" : ""}`}
                onClick={() => setSelectedReceiptId(receipt.id)}
                data-testid={`goods-receipt-item-${receipt.id}`}
              >
                <strong>{receipt.receipt_number}</strong>
                <span>Status: {receipt.status}</span>
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

          {flowStep === "product_scan" ? (
            <WorkflowScanInput
              enabled
              isLoading={flowLoading}
              label="Artikel scannen (QR/EAN)"
              placeholder="Artikelcode scannen"
              onScan={(value) => onFlowProductScan(value)}
              testIdPrefix="goods-receipt-flow-product-scan"
            />
          ) : null}

          {flowStep === "quantity" ? (
            <div className="workflow-block">
              <p className="workflow-label">Menge erfassen</p>
              <input
                className="input"
                type="number"
                min="0.001"
                step="0.001"
                value={flowQuantity}
                onChange={(event) => setFlowQuantity(event.target.value)}
                data-testid="goods-receipt-flow-quantity-input"
              />
              <button className="btn workflow-btn" onClick={() => setFlowStep("bin_scan")}>
                Weiter zu Lagerplatz-Scan
              </button>
            </div>
          ) : null}

          {flowStep === "bin_scan" ? (
            <WorkflowScanInput
              enabled
              isLoading={flowLoading}
              label="Lagerplatz scannen"
              placeholder="Lagerplatzcode scannen"
              onScan={(value) => onFlowBinScan(value)}
              testIdPrefix="goods-receipt-flow-bin-scan"
            />
          ) : null}

          {flowStep === "confirm" ? (
            <div className="workflow-block">
              <p className="workflow-label">Bestätigen</p>
              <p>
                <strong>Produkt:</strong> {flowProduct?.product_number} - {flowProduct?.name}
              </p>
              <p>
                <strong>Menge:</strong> {flowQuantity}
              </p>
              <p>
                <strong>Zielplatz:</strong> {flowBin?.code}
              </p>
              <button className="btn workflow-btn" onClick={() => void onConfirmFlowItem()} disabled={createItemMutation.isPending}>
                Position bestätigen
              </button>
            </div>
          ) : null}

          <ScanFeedback status={flowFeedbackStatus} message={flowFeedbackMessage} />

          <hr className="workflow-divider" />

          <h3>2b. Formular-Fallback</h3>
          <form className="form-grid" onSubmit={(event) => void onAddItem(event)} data-testid="goods-receipt-item-form">
            <select
              className="input"
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

            <select
              className="input"
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
                  {warehouse.code} - {warehouse.name}
                </option>
              ))}
            </select>

            <select
              className="input"
              value={selectedZoneId ?? ""}
              onChange={(event) => {
                setSelectedZoneId(Number(event.target.value));
                setSelectedBinId("");
              }}
              data-testid="goods-receipt-zone-select"
            >
              {(zonesQuery.data ?? []).map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.code} - {zone.name}
                </option>
              ))}
            </select>

            <select
              className="input"
              value={selectedBinId}
              onChange={(event) => setSelectedBinId(event.target.value)}
              data-testid="goods-receipt-bin-select"
            >
              {(binsQuery.data ?? []).map((bin) => (
                <option key={bin.id} value={bin.id}>
                  {bin.code}
                </option>
              ))}
            </select>

            <input
              className="input"
              type="number"
              min="0.001"
              step="0.001"
              value={receivedQuantity}
              onChange={(event) => setReceivedQuantity(event.target.value)}
              required
              data-testid="goods-receipt-quantity-input"
            />

            <button
              className="btn"
              type="submit"
              disabled={!selectedReceiptId || selectedReceipt?.status !== "draft" || createItemMutation.isPending}
              data-testid="goods-receipt-add-item-btn"
            >
              Position hinzufügen
            </button>
          </form>

          <div className="actions-cell">
            <button
              className="btn"
              disabled={!selectedReceiptId || selectedReceipt?.status !== "draft" || completeMutation.isPending}
              onClick={() => selectedReceiptId && void completeMutation.mutateAsync(selectedReceiptId)}
              data-testid="goods-receipt-complete-btn"
            >
              WE abschließen
            </button>
            <button
              className="btn"
              disabled={!selectedReceiptId || selectedReceipt?.status !== "draft" || cancelMutation.isPending}
              onClick={() => selectedReceiptId && void cancelMutation.mutateAsync(selectedReceiptId)}
              data-testid="goods-receipt-cancel-btn"
            >
              WE stornieren
            </button>
          </div>
        </article>

        <article className="subpanel">
          <h3>3. Erfasste Positionen</h3>
          <div className="list-stack small" data-testid="goods-receipt-items-list">
            {(receiptItemsQuery.data ?? []).map((item) => (
              <div key={item.id} className="list-item static-item" data-testid={`goods-receipt-item-row-${item.id}`}>
                <strong>Produkt #{item.product_id}</strong>
                <span>
                  Menge {item.received_quantity} | Ziel-Bin #{item.target_bin_id}
                </span>
              </div>
            ))}
            {!receiptItemsQuery.isLoading && (receiptItemsQuery.data?.length ?? 0) === 0 ? (
              <p>Noch keine Positionen.</p>
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}
