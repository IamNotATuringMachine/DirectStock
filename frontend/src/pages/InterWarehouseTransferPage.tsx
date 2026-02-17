import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import ScanFeedback from "../components/scanner/ScanFeedback";
import WorkflowScanInput from "../components/scanner/WorkflowScanInput";
import { fetchAllProducts, fetchProductByEan, fetchProductByQr } from "../services/productsApi";
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
    queryFn: () => fetchAllProducts(),
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
    <section className="page flex flex-col gap-6" data-testid="inter-warehouse-transfer-page">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="page-title">Zwischenlager-Transfer</h2>
          <p className="section-subtitle mt-1">
            Standortübergreifende Umlagerungen mit Transit-Status steuern.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] px-4 py-2 flex flex-col items-center min-w-[120px] shadow-sm">
            <span className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Transit</span>
            <span className="text-xl font-bold text-[var(--ink)]">{dispatchedTransferCount}</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Create & List */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          <div className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm p-6">
            <h3 className="section-title mb-4">1. Transfer anlegen</h3>
            <form onSubmit={(event) => void onCreateTransfer(event)} className="space-y-4">
              <div className="space-y-2">
                <label className="form-label-standard">Von Lager</label>
                <select
                  className="input w-full"
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
              </div>
              <div className="space-y-2">
                <label className="form-label-standard">Nach Lager</label>
                <select
                  className="input w-full"
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
              </div>
              <div className="space-y-2">
                <label className="form-label-standard">Notiz</label>
                <input
                  type="text"
                  className="input w-full"
                  value={transferNotes}
                  onChange={(event) => setTransferNotes(event.target.value)}
                  data-testid="iwt-notes-input"
                  placeholder="Referenz oder Grund"
                />
              </div>
              <button
                type="submit"
                disabled={createTransferMutation.isPending || !fromWarehouseId || !toWarehouseId || fromWarehouseId === toWarehouseId}
                className="btn btn-primary w-full justify-center"
                data-testid="iwt-create-btn"
              >
                {createTransferMutation.isPending ? "Wird angelegt..." : "Transfer anlegen"}
              </button>
            </form>
          </div>

          <div className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm overflow-hidden flex flex-col h-[600px]">
            <div className="p-4 border-b border-[var(--line)] bg-[var(--panel-soft)]">
              <h3 className="section-title">Offene Transfers</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {(transfersQuery.data ?? []).map((transfer) => (
                <button
                  key={transfer.id}
                  onClick={() => setSelectedTransferId(transfer.id)}
                  className={`w-full text-left p-3 rounded-[var(--radius-md)] border transition-colors ${selectedTransferId === transfer.id
                    ? "bg-[var(--panel-strong)] border-[var(--accent)]"
                    : "bg-[var(--bg)] border-[var(--line)] hover:bg-[var(--panel-soft)]"
                    }`}
                  data-testid={`iwt-item-${transfer.id}`}
                >
                  <div className="flex justify-between items-start mb-1 gap-2">
                    <span className="font-medium text-[var(--ink)] text-sm truncate block min-w-0">
                      {transfer.transfer_number}
                    </span>
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${transfer.status === "dispatched"
                        ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                        : transfer.status === "received"
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                          : transfer.status === "cancelled"
                            ? "bg-red-500/10 text-red-600 border-red-500/20"
                            : "bg-[var(--panel-soft)] text-[var(--muted)] border-[var(--line)]"
                        }`}
                    >
                      {transfer.status}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--muted)] flex items-center justify-between gap-2 overflow-hidden">
                    <span className="truncate min-w-0">
                      {warehouseById.get(transfer.from_warehouse_id)?.code ?? transfer.from_warehouse_id}
                      <span className="mx-1">→</span>
                      {warehouseById.get(transfer.to_warehouse_id)?.code ?? transfer.to_warehouse_id}
                    </span>
                  </div>
                </button>
              ))}
              {(transfersQuery.data ?? []).length === 0 && (
                <div className="p-8 text-center text-sm text-[var(--muted)] italic">
                  Keine Transfers gefunden.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Details & Items */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {!selectedTransfer ? (
            <div className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm p-12 text-center">
              <p className="text-[var(--muted)]">Bitte wählen Sie einen Transfer aus der Liste aus.</p>
            </div>
          ) : (
            <>
              {/* Transfer Header */}
              <div className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-lg font-medium text-[var(--ink)] flex items-center gap-2">
                    {selectedTransfer.transfer_number}
                  </h2>
                  <p className="text-sm text-[var(--muted)] mt-1">
                    Status: <strong className="uppercase">{selectedTransfer.status}</strong>
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => void dispatchMutation.mutateAsync(selectedTransfer.id)}
                    disabled={dispatchMutation.isPending || selectedTransfer.status !== "draft"}
                    className="btn btn-primary"
                    data-testid="iwt-dispatch-btn"
                  >
                    Dispatch
                  </button>
                  <button
                    onClick={() => void receiveMutation.mutateAsync(selectedTransfer.id)}
                    disabled={receiveMutation.isPending || selectedTransfer.status !== "dispatched"}
                    className="btn btn-primary bg-emerald-600 hover:bg-emerald-700 border-emerald-600"
                    data-testid="iwt-receive-btn"
                  >
                    Receive
                  </button>
                  <button
                    onClick={() => void cancelMutation.mutateAsync(selectedTransfer.id)}
                    disabled={cancelMutation.isPending || selectedTransfer.status !== "draft"}
                    className="btn btn-secondary text-[var(--destructive)] hover:bg-red-50"
                    data-testid="iwt-cancel-btn"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              {/* Scan Workflow */}
              <section className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm p-6" data-testid="iwt-scan-workflow">
                <div className="mb-4">
                  <h3 className="text-lg font-medium text-[var(--ink)]">2. Scan-Workflow & Positionen</h3>
                  <p className="text-sm text-[var(--muted)]">
                    Produkt und Bin-Locations per Scanner erfassen.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <WorkflowScanInput
                    enabled={selectedTransfer.status === "draft"}
                    isLoading={false}
                    label="Quell-Bin"
                    placeholder="Scan QR"
                    onScan={(value) => onScanSourceBin(value)}
                    testIdPrefix="iwt-scan-source-bin"
                  />
                  <WorkflowScanInput
                    enabled={selectedTransfer.status === "draft"}
                    isLoading={false}
                    label="Produkt"
                    placeholder="Scan EAN/QR"
                    onScan={(value) => onScanProduct(value)}
                    testIdPrefix="iwt-scan-product"
                  />
                  <WorkflowScanInput
                    enabled={selectedTransfer.status === "draft"}
                    isLoading={false}
                    label="Ziel-Bin"
                    placeholder="Scan QR"
                    onScan={(value) => onScanTargetBin(value)}
                    testIdPrefix="iwt-scan-target-bin"
                  />
                </div>

                {/* Feedback Message Area */}
                <div className="mb-6">
                  <ScanFeedback status={scanFeedbackStatus} message={scanFeedbackMessage} />
                </div>

                {/* Add Item Form */}
                <form onSubmit={(event) => void onAddItem(event)} className="bg-[var(--panel-soft)] rounded-[var(--radius-md)] p-4 mb-6 border border-[var(--line)]" data-testid="iwt-add-item-form">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-xs font-medium text-[var(--muted)]">Produkt</label>
                      <select
                        className="input w-full"
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
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-[var(--muted)]">Quell-Bin</label>
                      <select
                        className="input w-full"
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
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-[var(--muted)]">Ziel-Bin</label>
                      <select
                        className="input w-full"
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
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-[var(--muted)]">Menge</label>
                      <input
                        type="number"
                        min="0.001"
                        step="0.001"
                        className="input w-full"
                        value={requestedQuantity}
                        onChange={(event) => setRequestedQuantity(event.target.value)}
                        data-testid="iwt-qty-input"
                        disabled={selectedTransfer.status !== "draft"}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-[var(--muted)]">Einheit</label>
                      <input
                        type="text"
                        className="input w-full"
                        value={unit}
                        onChange={(event) => setUnit(event.target.value)}
                        data-testid="iwt-unit-input"
                        disabled={selectedTransfer.status !== "draft"}
                      />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-xs font-medium text-[var(--muted)]">Serials (Komma/Zeilen)</label>
                      <textarea
                        rows={1}
                        className="input w-full min-h-[42px] py-2"
                        value={serialNumbersText}
                        onChange={(event) => setSerialNumbersText(event.target.value)}
                        data-testid="iwt-serials-input"
                        disabled={selectedTransfer.status !== "draft"}
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      type="submit"
                      disabled={createItemMutation.isPending || selectedTransfer.status !== "draft" || !productId || !fromBinId || !toBinId}
                      className="btn btn-primary"
                      data-testid="iwt-add-item-btn"
                    >
                      Position hinzufügen
                    </button>
                  </div>
                </form>

                {/* Items Table */}
                <div className="overflow-x-auto border border-[var(--line)] rounded-[var(--radius-sm)]">
                  <table className="w-full text-sm text-left" data-testid="iwt-items-table">
                    <thead className="bg-[var(--panel-soft)] text-[var(--muted)] uppercase text-xs font-semibold">
                      <tr>
                        <th className="px-4 py-3">Produkt</th>
                        <th className="px-3 py-3">Von</th>
                        <th className="px-3 py-3">Nach</th>
                        <th className="px-3 py-3">Req</th>
                        <th className="px-3 py-3">Disp</th>
                        <th className="px-3 py-3">Recv</th>
                        <th className="px-3 py-3">Einh.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--line)] bg-[var(--bg)]">
                      {(transferDetailQuery.data?.items ?? []).map((item) => (
                        <tr key={item.id} className="hover:bg-[var(--panel-soft)] transition-colors">
                          <td className="px-4 py-3 font-medium text-[var(--ink)] whitespace-nowrap">{item.product_id}</td>
                          <td className="px-3 py-3 text-[var(--muted)] whitespace-nowrap">{item.from_bin_id}</td>
                          <td className="px-3 py-3 text-[var(--muted)] whitespace-nowrap">{item.to_bin_id}</td>
                          <td className="px-3 py-3 text-[var(--muted)] whitespace-nowrap">{item.requested_quantity}</td>
                          <td className="px-3 py-3 text-[var(--muted)] whitespace-nowrap">{item.dispatched_quantity}</td>
                          <td className="px-3 py-3 text-[var(--muted)] whitespace-nowrap">{item.received_quantity}</td>
                          <td className="px-3 py-3 text-[var(--muted)] whitespace-nowrap">{item.unit}</td>
                        </tr>
                      ))}
                      {!transferDetailQuery.isLoading && (transferDetailQuery.data?.items.length ?? 0) === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-6 text-center text-[var(--muted)] italic">
                            Keine Positionen vorhanden.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
