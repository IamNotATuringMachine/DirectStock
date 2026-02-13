import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import ScanFeedback from "../components/scanner/ScanFeedback";
import WorkflowScanInput from "../components/scanner/WorkflowScanInput";
import { fetchProductByEan, fetchProductByQr, fetchProducts } from "../services/productsApi";
import {
  cancelInterWarehouseTransfer,
  createInterWarehouseTransfer,
  createInterWarehouseTransferItem,
  dispatchInterWarehouseTransfer,
  fetchInterWarehouseTransfer,
  fetchInterWarehouseTransfers,
  receiveInterWarehouseTransfer,
} from "../services/interWarehouseTransfersApi";
import { fetchBinByQr, fetchBins, fetchWarehouses, fetchZones } from "../services/warehousesApi";
import type { BinLocation, Warehouse } from "../types";
import { parseScanValue } from "../utils/scannerUtils";

async function fetchWarehouseBins(warehouseId: number): Promise<BinLocation[]> {
  const zones = await fetchZones(warehouseId);
  if (!zones.length) {
    return [];
  }
  const nestedBins = await Promise.all(zones.map((zone) => fetchBins(zone.id)));
  return nestedBins.flat();
}

export default function InterWarehouseTransferPage() {
  const queryClient = useQueryClient();
  const [selectedTransferId, setSelectedTransferId] = useState<number | null>(null);

  const [fromWarehouseId, setFromWarehouseId] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [transferNotes, setTransferNotes] = useState("");

  const [productId, setProductId] = useState("");
  const [fromBinId, setFromBinId] = useState("");
  const [toBinId, setToBinId] = useState("");
  const [requestedQuantity, setRequestedQuantity] = useState("1");
  const [unit, setUnit] = useState("piece");
  const [batchNumber, setBatchNumber] = useState("");
  const [serialNumbersText, setSerialNumbersText] = useState("");
  const [scanFeedbackStatus, setScanFeedbackStatus] = useState<"idle" | "success" | "error">("idle");
  const [scanFeedbackMessage, setScanFeedbackMessage] = useState<string | null>(null);

  const warehousesQuery = useQuery({
    queryKey: ["warehouses", "inter-warehouse-transfer"],
    queryFn: fetchWarehouses,
  });

  const productsQuery = useQuery({
    queryKey: ["products", "inter-warehouse-transfer-picker"],
    queryFn: () => fetchProducts({ page: 1, pageSize: 200 }),
  });

  const transfersQuery = useQuery({
    queryKey: ["inter-warehouse-transfers"],
    queryFn: fetchInterWarehouseTransfers,
  });

  const transferDetailQuery = useQuery({
    queryKey: ["inter-warehouse-transfer-detail", selectedTransferId],
    queryFn: () => fetchInterWarehouseTransfer(selectedTransferId as number),
    enabled: selectedTransferId !== null,
  });

  const selectedTransfer = transferDetailQuery.data?.transfer ?? null;

  const sourceBinsQuery = useQuery({
    queryKey: ["inter-warehouse-source-bins", selectedTransfer?.from_warehouse_id],
    queryFn: () => fetchWarehouseBins(selectedTransfer?.from_warehouse_id as number),
    enabled: selectedTransfer !== null,
  });

  const targetBinsQuery = useQuery({
    queryKey: ["inter-warehouse-target-bins", selectedTransfer?.to_warehouse_id],
    queryFn: () => fetchWarehouseBins(selectedTransfer?.to_warehouse_id as number),
    enabled: selectedTransfer !== null,
  });

  const createTransferMutation = useMutation({
    mutationFn: createInterWarehouseTransfer,
    onSuccess: async (transfer) => {
      setTransferNotes("");
      await queryClient.invalidateQueries({ queryKey: ["inter-warehouse-transfers"] });
      setSelectedTransferId(transfer.id);
    },
  });

  const createItemMutation = useMutation({
    mutationFn: ({
      transferId,
      payload,
    }: {
      transferId: number;
      payload: Parameters<typeof createInterWarehouseTransferItem>[1];
    }) => createInterWarehouseTransferItem(transferId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["inter-warehouse-transfer-detail", selectedTransferId] }),
        queryClient.invalidateQueries({ queryKey: ["inter-warehouse-transfers"] }),
      ]);
      setRequestedQuantity("1");
      setBatchNumber("");
      setSerialNumbersText("");
    },
  });

  const dispatchMutation = useMutation({
    mutationFn: dispatchInterWarehouseTransfer,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["inter-warehouse-transfer-detail", selectedTransferId] }),
        queryClient.invalidateQueries({ queryKey: ["inter-warehouse-transfers"] }),
      ]);
    },
  });

  const receiveMutation = useMutation({
    mutationFn: receiveInterWarehouseTransfer,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["inter-warehouse-transfer-detail", selectedTransferId] }),
        queryClient.invalidateQueries({ queryKey: ["inter-warehouse-transfers"] }),
      ]);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelInterWarehouseTransfer,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["inter-warehouse-transfer-detail", selectedTransferId] }),
        queryClient.invalidateQueries({ queryKey: ["inter-warehouse-transfers"] }),
      ]);
    },
  });

  useEffect(() => {
    if (!fromWarehouseId && warehousesQuery.data?.length) {
      setFromWarehouseId(String(warehousesQuery.data[0].id));
    }
  }, [fromWarehouseId, warehousesQuery.data]);

  useEffect(() => {
    if (!toWarehouseId && warehousesQuery.data && warehousesQuery.data.length > 1) {
      setToWarehouseId(String(warehousesQuery.data[1].id));
    } else if (!toWarehouseId && warehousesQuery.data?.length === 1) {
      setToWarehouseId(String(warehousesQuery.data[0].id));
    }
  }, [toWarehouseId, warehousesQuery.data]);

  useEffect(() => {
    if (!productId && productsQuery.data?.items.length) {
      setProductId(String(productsQuery.data.items[0].id));
    }
  }, [productId, productsQuery.data]);

  useEffect(() => {
    setFromBinId("");
    setToBinId("");
  }, [selectedTransferId]);

  useEffect(() => {
    if (!fromBinId && sourceBinsQuery.data?.length) {
      setFromBinId(String(sourceBinsQuery.data[0].id));
    }
  }, [fromBinId, sourceBinsQuery.data]);

  useEffect(() => {
    if (!toBinId && targetBinsQuery.data?.length) {
      setToBinId(String(targetBinsQuery.data[0].id));
    }
  }, [toBinId, targetBinsQuery.data]);

  const warehouseById = useMemo(() => {
    const map = new Map<number, Warehouse>();
    for (const warehouse of warehousesQuery.data ?? []) {
      map.set(warehouse.id, warehouse);
    }
    return map;
  }, [warehousesQuery.data]);

  const dispatchedTransferCount = useMemo(
    () => (transfersQuery.data ?? []).filter((item) => item.status === "dispatched").length,
    [transfersQuery.data]
  );

  const onCreateTransfer = async (event: FormEvent) => {
    event.preventDefault();
    if (!fromWarehouseId || !toWarehouseId || fromWarehouseId === toWarehouseId) {
      return;
    }
    await createTransferMutation.mutateAsync({
      from_warehouse_id: Number(fromWarehouseId),
      to_warehouse_id: Number(toWarehouseId),
      notes: transferNotes.trim() || undefined,
    });
  };

  const onAddItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedTransferId || !productId || !fromBinId || !toBinId) {
      return;
    }
    const serial_numbers = serialNumbersText
      .split(/[\n,;]/)
      .map((value) => value.trim())
      .filter(Boolean);

    await createItemMutation.mutateAsync({
      transferId: selectedTransferId,
      payload: {
        product_id: Number(productId),
        from_bin_id: Number(fromBinId),
        to_bin_id: Number(toBinId),
        requested_quantity: requestedQuantity,
        unit: unit.trim() || "piece",
        batch_number: batchNumber.trim() || null,
        serial_numbers: serial_numbers.length > 0 ? serial_numbers : null,
      },
    });
  };

  const setFeedback = (status: "idle" | "success" | "error", message: string | null) => {
    setScanFeedbackStatus(status);
    setScanFeedbackMessage(message);
  };

  const resolveProductFromScan = async (scanInput: string) => {
    const parsed = parseScanValue(scanInput);
    if (parsed.type === "ean") {
      return fetchProductByEan(parsed.value);
    }
    if (parsed.type === "product_qr") {
      return fetchProductByQr(parsed.normalized);
    }
    return fetchProductByQr(parsed.normalized);
  };

  const resolveBinFromScan = async (scanInput: string) => {
    const parsed = parseScanValue(scanInput);
    if (parsed.type !== "bin_qr") {
      throw new Error("invalid_bin_scan");
    }
    return fetchBinByQr(parsed.normalized);
  };

  const onScanProduct = async (scanInput: string) => {
    if (selectedTransfer?.status !== "draft") {
      return;
    }
    try {
      const product = await resolveProductFromScan(scanInput);
      setProductId(String(product.id));
      setFeedback("success", `Produkt gesetzt: ${product.product_number}`);
    } catch {
      setFeedback("error", "Produktscan fehlgeschlagen");
    }
  };

  const onScanSourceBin = async (scanInput: string) => {
    if (selectedTransfer?.status !== "draft") {
      return;
    }
    try {
      const bin = await resolveBinFromScan(scanInput);
      const matchesSource = (sourceBinsQuery.data ?? []).some((item) => item.id === bin.id);
      if (!matchesSource) {
        setFeedback("error", "Gescanntes Bin gehört nicht zum Quelllager");
        return;
      }
      setFromBinId(String(bin.id));
      setFeedback("success", `Quell-Bin gesetzt: ${bin.code}`);
    } catch {
      setFeedback("error", "Quell-Bin-Scan fehlgeschlagen");
    }
  };

  const onScanTargetBin = async (scanInput: string) => {
    if (selectedTransfer?.status !== "draft") {
      return;
    }
    try {
      const bin = await resolveBinFromScan(scanInput);
      const matchesTarget = (targetBinsQuery.data ?? []).some((item) => item.id === bin.id);
      if (!matchesTarget) {
        setFeedback("error", "Gescanntes Bin gehört nicht zum Ziellager");
        return;
      }
      setToBinId(String(bin.id));
      setFeedback("success", `Ziel-Bin gesetzt: ${bin.code}`);
    } catch {
      setFeedback("error", "Ziel-Bin-Scan fehlgeschlagen");
    }
  };

  return (
    <section className="panel" data-testid="inter-warehouse-transfer-page">
      <header className="panel-header">
        <div>
          <h2>Inter-Warehouse Transfer</h2>
          <p className="panel-subtitle">Standortübergreifende Umlagerungen mit Transit-Status steuern.</p>
        </div>
      </header>

      <div className="kpi-grid" style={{ marginBottom: "1rem" }}>
        <div className="kpi-card" data-testid="iwt-transit-count">
          <span>Transfers in Transit</span>
          <strong>{dispatchedTransferCount}</strong>
        </div>
      </div>

      <div className="warehouse-grid">
        <article className="subpanel">
          <h3>1. Transfer anlegen</h3>
          <form className="form-grid" onSubmit={(event) => void onCreateTransfer(event)} data-testid="iwt-create-form">
            <label>
              Von Lager
              <select
                className="input"
                value={fromWarehouseId}
                onChange={(event) => setFromWarehouseId(event.target.value)}
                data-testid="iwt-from-warehouse-select"
              >
                {(warehousesQuery.data ?? []).map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.code} - {warehouse.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nach Lager
              <select
                className="input"
                value={toWarehouseId}
                onChange={(event) => setToWarehouseId(event.target.value)}
                data-testid="iwt-to-warehouse-select"
              >
                {(warehousesQuery.data ?? []).map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.code} - {warehouse.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Notiz
              <input
                className="input"
                value={transferNotes}
                onChange={(event) => setTransferNotes(event.target.value)}
                data-testid="iwt-notes-input"
              />
            </label>
            <button
              className="btn"
              type="submit"
              disabled={createTransferMutation.isPending || !fromWarehouseId || !toWarehouseId || fromWarehouseId === toWarehouseId}
              data-testid="iwt-create-btn"
            >
              Transfer anlegen
            </button>
          </form>

          <div className="list-stack small" data-testid="iwt-list">
            {(transfersQuery.data ?? []).map((transfer) => (
              <button
                key={transfer.id}
                className={`list-item ${selectedTransferId === transfer.id ? "active" : ""}`}
                onClick={() => setSelectedTransferId(transfer.id)}
                data-testid={`iwt-item-${transfer.id}`}
              >
                <strong>{transfer.transfer_number}</strong>
                <span>
                  {warehouseById.get(transfer.from_warehouse_id)?.code ?? transfer.from_warehouse_id} -&gt;{" "}
                  {warehouseById.get(transfer.to_warehouse_id)?.code ?? transfer.to_warehouse_id}
                </span>
                <small>{transfer.status}</small>
              </button>
            ))}
          </div>
        </article>

        <article className="subpanel">
          <h3>2. Positionen und Status</h3>
          {!selectedTransfer ? <p>Bitte Transfer auswählen.</p> : null}

          {selectedTransfer ? (
            <>
              <p data-testid="iwt-selected-status">
                {selectedTransfer.transfer_number} | Status: <strong>{selectedTransfer.status}</strong>
              </p>

              <article className="subpanel" data-testid="iwt-scan-workflow">
                <h4>Scan-Workflow</h4>
                <p className="panel-subtitle">Produkt und Bin-Locations per Scanner vorbelegen.</p>
                <WorkflowScanInput
                  enabled={selectedTransfer.status === "draft"}
                  isLoading={false}
                  label="1) Quell-Bin scannen"
                  placeholder="Quell-Bin QR scannen"
                  onScan={(value) => onScanSourceBin(value)}
                  testIdPrefix="iwt-scan-source-bin"
                />
                <WorkflowScanInput
                  enabled={selectedTransfer.status === "draft"}
                  isLoading={false}
                  label="2) Produkt scannen"
                  placeholder="Produkt QR/EAN scannen"
                  onScan={(value) => onScanProduct(value)}
                  testIdPrefix="iwt-scan-product"
                />
                <WorkflowScanInput
                  enabled={selectedTransfer.status === "draft"}
                  isLoading={false}
                  label="3) Ziel-Bin scannen"
                  placeholder="Ziel-Bin QR scannen"
                  onScan={(value) => onScanTargetBin(value)}
                  testIdPrefix="iwt-scan-target-bin"
                />
                <ScanFeedback status={scanFeedbackStatus} message={scanFeedbackMessage} />
              </article>

              <form className="form-grid" onSubmit={(event) => void onAddItem(event)} data-testid="iwt-add-item-form">
                <label>
                  Produkt
                  <select
                    className="input"
                    value={productId}
                    onChange={(event) => setProductId(event.target.value)}
                    data-testid="iwt-product-select"
                    disabled={selectedTransfer.status !== "draft"}
                  >
                    {(productsQuery.data?.items ?? []).map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.product_number} - {product.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Quell-Bin
                  <select
                    className="input"
                    value={fromBinId}
                    onChange={(event) => setFromBinId(event.target.value)}
                    data-testid="iwt-from-bin-select"
                    disabled={selectedTransfer.status !== "draft"}
                  >
                    {(sourceBinsQuery.data ?? []).map((bin) => (
                      <option key={bin.id} value={bin.id}>
                        {bin.code}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Ziel-Bin
                  <select
                    className="input"
                    value={toBinId}
                    onChange={(event) => setToBinId(event.target.value)}
                    data-testid="iwt-to-bin-select"
                    disabled={selectedTransfer.status !== "draft"}
                  >
                    {(targetBinsQuery.data ?? []).map((bin) => (
                      <option key={bin.id} value={bin.id}>
                        {bin.code}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Menge
                  <input
                    className="input"
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={requestedQuantity}
                    onChange={(event) => setRequestedQuantity(event.target.value)}
                    data-testid="iwt-qty-input"
                    disabled={selectedTransfer.status !== "draft"}
                  />
                </label>
                <label>
                  Einheit
                  <input
                    className="input"
                    value={unit}
                    onChange={(event) => setUnit(event.target.value)}
                    data-testid="iwt-unit-input"
                    disabled={selectedTransfer.status !== "draft"}
                  />
                </label>
                <label>
                  Batch (optional)
                  <input
                    className="input"
                    value={batchNumber}
                    onChange={(event) => setBatchNumber(event.target.value)}
                    data-testid="iwt-batch-input"
                    disabled={selectedTransfer.status !== "draft"}
                  />
                </label>
                <label>
                  Serials (optional, Komma/Zeilen)
                  <textarea
                    className="input"
                    value={serialNumbersText}
                    onChange={(event) => setSerialNumbersText(event.target.value)}
                    data-testid="iwt-serials-input"
                    disabled={selectedTransfer.status !== "draft"}
                  />
                </label>
                <button
                  className="btn"
                  type="submit"
                  disabled={createItemMutation.isPending || selectedTransfer.status !== "draft" || !productId || !fromBinId || !toBinId}
                  data-testid="iwt-add-item-btn"
                >
                  Position hinzufügen
                </button>
              </form>

              <div className="actions-cell" style={{ margin: "1rem 0" }}>
                <button
                  className="btn"
                  onClick={() => void dispatchMutation.mutateAsync(selectedTransfer.id)}
                  disabled={dispatchMutation.isPending || selectedTransfer.status !== "draft"}
                  data-testid="iwt-dispatch-btn"
                >
                  Dispatch
                </button>
                <button
                  className="btn"
                  onClick={() => void receiveMutation.mutateAsync(selectedTransfer.id)}
                  disabled={receiveMutation.isPending || selectedTransfer.status !== "dispatched"}
                  data-testid="iwt-receive-btn"
                >
                  Receive
                </button>
                <button
                  className="btn"
                  onClick={() => void cancelMutation.mutateAsync(selectedTransfer.id)}
                  disabled={cancelMutation.isPending || selectedTransfer.status !== "draft"}
                  data-testid="iwt-cancel-btn"
                >
                  Cancel
                </button>
              </div>

              <div className="table-wrap">
                <table className="products-table" data-testid="iwt-items-table">
                  <thead>
                    <tr>
                      <th>Produkt</th>
                      <th>Von Bin</th>
                      <th>Nach Bin</th>
                      <th>Requested</th>
                      <th>Dispatched</th>
                      <th>Received</th>
                      <th>Einheit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(transferDetailQuery.data?.items ?? []).map((item) => (
                      <tr key={item.id}>
                        <td>{item.product_id}</td>
                        <td>{item.from_bin_id}</td>
                        <td>{item.to_bin_id}</td>
                        <td>{item.requested_quantity}</td>
                        <td>{item.dispatched_quantity}</td>
                        <td>{item.received_quantity}</td>
                        <td>{item.unit}</td>
                      </tr>
                    ))}
                    {!transferDetailQuery.isLoading && (transferDetailQuery.data?.items.length ?? 0) === 0 ? (
                      <tr>
                        <td colSpan={7}>Keine Positionen vorhanden.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </article>
      </div>
    </section>
  );
}
