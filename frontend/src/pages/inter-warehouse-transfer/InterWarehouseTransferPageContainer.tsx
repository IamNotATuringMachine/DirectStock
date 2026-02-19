import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchAllProducts } from "../../services/productsApi";
import {
  cancelInterWarehouseTransfer,
  createInterWarehouseTransfer,
  createInterWarehouseTransferItem,
  dispatchInterWarehouseTransfer,
  fetchInterWarehouseTransfer,
  fetchInterWarehouseTransfers,
  receiveInterWarehouseTransfer,
} from "../../services/interWarehouseTransfersApi";
import { fetchBins, fetchWarehouses, fetchZones } from "../../services/warehousesApi";
import type { BinLocation, Warehouse } from "../../types";
import { InterWarehouseTransferView } from "./InterWarehouseTransferView";
import { resolveBinFromScan, resolveProductFromScan } from "./scanResolvers";

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
    <InterWarehouseTransferView
      dispatchedTransferCount={dispatchedTransferCount}
      warehouseById={warehouseById}
      sidebarProps={{
        fromWarehouseId,
        onFromWarehouseIdChange: setFromWarehouseId,
        toWarehouseId,
        onToWarehouseIdChange: setToWarehouseId,
        transferNotes,
        onTransferNotesChange: setTransferNotes,
        onCreateTransfer: (event) => void onCreateTransfer(event),
        createTransferPending: createTransferMutation.isPending,
        warehouses: warehousesQuery.data ?? [],
        transfers: transfersQuery.data ?? [],
        selectedTransferId,
        onSelectTransfer: setSelectedTransferId,
        warehouseById,
      }}
      detailsProps={{
        selectedTransfer,
        onDispatch: (transferId) => {
          void dispatchMutation.mutateAsync(transferId);
        },
        dispatchPending: dispatchMutation.isPending,
        onReceive: (transferId) => {
          void receiveMutation.mutateAsync(transferId);
        },
        receivePending: receiveMutation.isPending,
        onCancel: (transferId) => {
          void cancelMutation.mutateAsync(transferId);
        },
        cancelPending: cancelMutation.isPending,
        onScanSourceBin,
        onScanProduct,
        onScanTargetBin,
        scanFeedbackStatus,
        scanFeedbackMessage,
        onAddItem: (event) => void onAddItem(event),
        products: productsQuery.data?.items ?? [],
        productId,
        onProductIdChange: setProductId,
        sourceBins: sourceBinsQuery.data ?? [],
        fromBinId,
        onFromBinIdChange: setFromBinId,
        targetBins: targetBinsQuery.data ?? [],
        toBinId,
        onToBinIdChange: setToBinId,
        requestedQuantity,
        onRequestedQuantityChange: setRequestedQuantity,
        unit,
        onUnitChange: setUnit,
        serialNumbersText,
        onSerialNumbersTextChange: setSerialNumbersText,
        createItemPending: createItemMutation.isPending,
        transferItems: transferDetailQuery.data?.items ?? [],
        transferItemsLoading: transferDetailQuery.isLoading,
      }}
    />
  );
}
