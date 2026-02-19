import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  cancelStockTransfer,
  completeStockTransfer,
  createStockTransfer,
  createStockTransferItem,
  fetchStockTransferItems,
  fetchStockTransfers,
} from "../../services/operationsApi";
import { fetchAllProducts } from "../../services/productsApi";
import { fetchBins, fetchWarehouses, fetchZones } from "../../services/warehousesApi";
import { StockTransferView } from "./StockTransferView";
import { useStockTransferFlow } from "./hooks/useStockTransferFlow";

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

  const {
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
  } = useStockTransferFlow({
    products: productsQuery.data?.items ?? [],
    bins: binsQuery.data ?? [],
    onSourceBinResolved: (sourceBin) => setFromBinId(String(sourceBin.id)),
    onTargetBinResolved: (targetBin) => setToBinId(String(targetBin.id)),
    onProductResolved: (product) => setSelectedProductId(String(product.id)),
  });

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
    <StockTransferView
      notes={notes}
      setNotes={setNotes}
      selectedTransferId={selectedTransferId}
      selectedTransfer={selectedTransfer}
      transfers={transfersQuery.data ?? []}
      transferItems={transferItemsQuery.data ?? []}
      onSelectTransfer={(id) => setSelectedTransferId(id)}
      onCreateTransfer={(event) => void onCreateTransfer(event)}
      createTransferPending={createTransferMutation.isPending}
      onComplete={() => selectedTransferId && void completeMutation.mutateAsync(selectedTransferId)}
      completePending={completeMutation.isPending}
      onCancel={() => selectedTransferId && void cancelMutation.mutateAsync(selectedTransferId)}
      cancelPending={cancelMutation.isPending}
      flowStep={flowStep}
      onSetFlowStep={setFlowStep}
      flowProgress={flowProgress}
      flowLoading={flowLoading}
      flowSourceBin={flowSourceBin}
      flowTargetBin={flowTargetBin}
      flowProduct={flowProduct}
      flowQuantity={flowQuantity}
      setFlowQuantity={setFlowQuantity}
      availableStock={availableStock}
      flowFeedbackStatus={flowFeedbackStatus}
      flowFeedbackMessage={flowFeedbackMessage}
      onFlowSourceBinScan={onFlowSourceBinScan}
      onFlowProductScan={onFlowProductScan}
      onFlowTargetBinScan={onFlowTargetBinScan}
      onConfirmFlowItem={() => void onConfirmFlowItem()}
      resetFlow={resetFlow}
      onAddItem={(event) => void onAddItem(event)}
      products={productsQuery.data?.items ?? []}
      bins={binsQuery.data ?? []}
      selectedProductId={selectedProductId}
      setSelectedProductId={setSelectedProductId}
      fromBinId={fromBinId}
      setFromBinId={setFromBinId}
      toBinId={toBinId}
      setToBinId={setToBinId}
      quantity={quantity}
      setQuantity={setQuantity}
      createItemPending={createItemMutation.isPending}
    />
  );
}
