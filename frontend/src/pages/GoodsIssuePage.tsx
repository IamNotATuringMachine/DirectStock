import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import ScanFeedback from "../components/scanner/ScanFeedback";
import WorkflowScanInput from "../components/scanner/WorkflowScanInput";
import { fetchInventoryByBin } from "../services/inventoryApi";
import {
  cancelGoodsIssue,
  completeGoodsIssue,
  createGoodsIssue,
  createGoodsIssueItem,
  fetchGoodsIssueItems,
  fetchGoodsIssues,
} from "../services/operationsApi";
import { fetchProductByEan, fetchProductByQr, fetchProducts } from "../services/productsApi";
import { fetchBinByQr, fetchBins, fetchWarehouses, fetchZones } from "../services/warehousesApi";
import type { BinLocation, InventoryByBinItem, Product } from "../types";
import { parseScanValue } from "../utils/scannerUtils";

type IssueFlowStep = "source_bin_scan" | "product_scan" | "quantity" | "confirm";

const flowSteps: Array<{ id: IssueFlowStep; label: string }> = [
  { id: "source_bin_scan", label: "Quelle scannen" },
  { id: "product_scan", label: "Artikel scannen" },
  { id: "quantity", label: "Menge erfassen" },
  { id: "confirm", label: "Bestätigen" },
];

export default function GoodsIssuePage() {
  const queryClient = useQueryClient();

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
    queryFn: () => fetchProducts({ page: 1, pageSize: 200 }),
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
      setCustomerReference("");
      await queryClient.invalidateQueries({ queryKey: ["goods-issues"] });
      setSelectedIssueId(issue.id);
    },
  });

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
    await createIssueMutation.mutateAsync({ customer_reference: customerReference.trim() || undefined });
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
    <section className="panel">
      <header className="panel-header">
        <div>
          <h2>Warenausgang</h2>
          <p className="panel-subtitle">Beleg anlegen, Entnahme positionieren und WA abschließen.</p>
        </div>
      </header>

      <div className="warehouse-grid">
        <article className="subpanel">
          <h3>1. Beleg anlegen</h3>
          <form className="form-grid" onSubmit={(event) => void onCreateIssue(event)}>
            <input
              className="input"
              placeholder="Kundenreferenz (optional)"
              value={customerReference}
              onChange={(event) => setCustomerReference(event.target.value)}
            />
            <button className="btn" type="submit" disabled={createIssueMutation.isPending}>
              WA-Header erstellen
            </button>
          </form>

          <div className="list-stack small">
            {(issuesQuery.data ?? []).map((issue) => (
              <button
                key={issue.id}
                className={`list-item ${selectedIssueId === issue.id ? "active" : ""}`}
                onClick={() => setSelectedIssueId(issue.id)}
              >
                <strong>{issue.issue_number}</strong>
                <span>Status: {issue.status}</span>
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
              testIdPrefix="goods-issue-flow-source-scan"
            />
          ) : null}

          {flowStep === "product_scan" ? (
            <WorkflowScanInput
              enabled
              isLoading={flowLoading}
              label="Artikel scannen"
              placeholder="Artikel scannen"
              onScan={(value) => onFlowProductScan(value)}
              testIdPrefix="goods-issue-flow-product-scan"
            />
          ) : null}

          {flowStep === "quantity" ? (
            <div className="workflow-block">
              <p className="workflow-label">Menge erfassen</p>
              <p>
                Verfügbar: <strong>{availableStock.toFixed(3)}</strong>
              </p>
              <input
                className="input"
                type="number"
                min="0.001"
                step="0.001"
                value={flowQuantity}
                onChange={(event) => setFlowQuantity(event.target.value)}
              />
              {remainingAfterIssue <= 2 ? <p className="warning">Warnung: niedriger Restbestand nach Entnahme.</p> : null}
              <button className="btn workflow-btn" onClick={() => setFlowStep("confirm")}>
                Weiter zur Bestätigung
              </button>
            </div>
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
                <strong>Rest danach:</strong> {remainingAfterIssue.toFixed(3)}
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
                setSelectedBinId("");
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
                setSelectedBinId("");
              }}
            >
              {(zonesQuery.data ?? []).map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.code} - {zone.name}
                </option>
              ))}
            </select>

            <select className="input" value={selectedBinId} onChange={(event) => setSelectedBinId(event.target.value)}>
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
              value={requestedQuantity}
              onChange={(event) => setRequestedQuantity(event.target.value)}
              required
            />

            <button
              className="btn"
              type="submit"
              disabled={!selectedIssueId || selectedIssue?.status !== "draft" || createItemMutation.isPending}
            >
              Position hinzufügen
            </button>
          </form>

          <div className="actions-cell">
            <button
              className="btn"
              disabled={!selectedIssueId || selectedIssue?.status !== "draft" || completeMutation.isPending}
              onClick={() => selectedIssueId && void completeMutation.mutateAsync(selectedIssueId)}
            >
              WA abschließen
            </button>
            <button
              className="btn"
              disabled={!selectedIssueId || selectedIssue?.status !== "draft" || cancelMutation.isPending}
              onClick={() => selectedIssueId && void cancelMutation.mutateAsync(selectedIssueId)}
            >
              WA stornieren
            </button>
          </div>
        </article>

        <article className="subpanel">
          <h3>3. Erfasste Positionen</h3>
          <div className="list-stack small">
            {(issueItemsQuery.data ?? []).map((item) => (
              <div key={item.id} className="list-item static-item">
                <strong>Produkt #{item.product_id}</strong>
                <span>
                  Menge {item.requested_quantity} | Quelle-Bin #{item.source_bin_id}
                </span>
              </div>
            ))}
            {!issueItemsQuery.isLoading && (issueItemsQuery.data?.length ?? 0) === 0 ? (
              <p>Noch keine Positionen.</p>
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}
