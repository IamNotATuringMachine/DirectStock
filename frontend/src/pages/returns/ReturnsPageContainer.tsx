import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { downloadDocumentBlob } from "../../services/documentsApi";
import { fetchAllProducts } from "../../services/productsApi";
import {
  createReturnOrder,
  createReturnOrderItem,
  dispatchReturnOrderItemExternal,
  fetchReturnOrderItems,
  fetchReturnOrders,
  receiveReturnOrderItemExternal,
  updateReturnOrderStatus,
} from "../../services/returnsApi";
import { fetchBins, fetchWarehouses, fetchZones } from "../../services/warehousesApi";
import { ReturnsView } from "./ReturnsView";
import { transitionTargets, type ReturnDecision, type ReturnOrderStatus, type ReturnRepairMode } from "./model";

export default function ReturnsPage() {
  const queryClient = useQueryClient();
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [sourceType, setSourceType] = useState<"customer" | "technician">("customer");
  const [sourceReference, setSourceReference] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [decision, setDecision] = useState<ReturnDecision>("restock");
  const [repairMode, setRepairMode] = useState<ReturnRepairMode>("internal");
  const [externalPartner, setExternalPartner] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [selectedBinId, setSelectedBinId] = useState("");

  const ordersQuery = useQuery({
    queryKey: ["return-orders"],
    queryFn: fetchReturnOrders,
  });

  const productsQuery = useQuery({
    queryKey: ["products", "returns-picker"],
    queryFn: () => fetchAllProducts(),
  });

  const warehousesQuery = useQuery({
    queryKey: ["warehouses", "returns-picker"],
    queryFn: fetchWarehouses,
  });

  const zonesQuery = useQuery({
    queryKey: ["zones", "returns-picker", selectedWarehouseId],
    queryFn: () => fetchZones(selectedWarehouseId as number),
    enabled: selectedWarehouseId !== null,
  });

  const binsQuery = useQuery({
    queryKey: ["bins", "returns-picker", selectedZoneId],
    queryFn: () => fetchBins(selectedZoneId as number),
    enabled: selectedZoneId !== null,
  });

  const itemsQuery = useQuery({
    queryKey: ["return-order-items", selectedOrderId],
    queryFn: () => fetchReturnOrderItems(selectedOrderId as number),
    enabled: selectedOrderId !== null,
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

  const createOrderMutation = useMutation({
    mutationFn: createReturnOrder,
    onSuccess: async (order) => {
      await queryClient.invalidateQueries({ queryKey: ["return-orders"] });
      setSelectedOrderId(order.id);
      setNotes("");
      setSourceReference("");
    },
  });

  const createItemMutation = useMutation({
    mutationFn: ({
      orderId,
      payload,
    }: {
      orderId: number;
      payload: Parameters<typeof createReturnOrderItem>[1];
    }) => createReturnOrderItem(orderId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["return-order-items", selectedOrderId] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: number; status: ReturnOrderStatus }) =>
      updateReturnOrderStatus(orderId, status),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["return-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["return-order-items", selectedOrderId] }),
      ]);
    },
  });

  const dispatchExternalMutation = useMutation({
    mutationFn: ({
      orderId,
      itemId,
      externalPartnerName,
    }: {
      orderId: number;
      itemId: number;
      externalPartnerName?: string;
    }) =>
      dispatchReturnOrderItemExternal(orderId, itemId, {
        external_partner: externalPartnerName?.trim() || undefined,
      }),
    onSuccess: async (payload) => {
      await queryClient.invalidateQueries({ queryKey: ["return-order-items", selectedOrderId] });
      if (payload.document_id) {
        const blob = await downloadDocumentBlob(payload.document_id);
        const objectUrl = URL.createObjectURL(blob);
        window.open(objectUrl, "_blank", "noopener,noreferrer");
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      }
    },
  });

  const receiveExternalMutation = useMutation({
    mutationFn: ({
      orderId,
      itemId,
      targetBinId,
    }: {
      orderId: number;
      itemId: number;
      targetBinId: number;
    }) => receiveReturnOrderItemExternal(orderId, itemId, { target_bin_id: targetBinId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["return-order-items", selectedOrderId] });
    },
  });

  const selectedOrder = useMemo(
    () => ordersQuery.data?.find((order) => order.id === selectedOrderId) ?? null,
    [ordersQuery.data, selectedOrderId]
  );

  const allowedTransitions = useMemo(() => {
    if (!selectedOrder) {
      return [];
    }
    if (!(selectedOrder.status in transitionTargets)) {
      return [];
    }
    return transitionTargets[selectedOrder.status as ReturnOrderStatus] ?? [];
  }, [selectedOrder]);

  const onCreateOrder = async (event: FormEvent) => {
    event.preventDefault();
    await createOrderMutation.mutateAsync({
      source_type: sourceType,
      source_reference: sourceReference.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  const onCreateItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedOrderId || !productId) {
      return;
    }
    await createItemMutation.mutateAsync({
      orderId: selectedOrderId,
      payload: {
        product_id: Number(productId),
        quantity,
        unit: "piece",
        decision,
        repair_mode: decision === "repair" ? repairMode : undefined,
        external_partner:
          decision === "repair" && repairMode === "external" ? externalPartner.trim() || undefined : undefined,
        target_bin_id: selectedBinId ? Number(selectedBinId) : undefined,
      },
    });
  };

  return (
    <ReturnsView
      ordersPanelProps={{
        orders: ordersQuery.data ?? [],
        selectedOrderId,
        onSelectOrder: setSelectedOrderId,
        sourceType,
        onSourceTypeChange: setSourceType,
        sourceReference,
        onSourceReferenceChange: setSourceReference,
        notes,
        onNotesChange: setNotes,
        onCreateOrder: (event) => void onCreateOrder(event),
        createOrderPending: createOrderMutation.isPending,
      }}
      itemsPanelProps={{
        selectedOrder,
        onCreateItem: (event) => void onCreateItem(event),
        productId,
        onProductIdChange: setProductId,
        products: productsQuery.data?.items ?? [],
        quantity,
        onQuantityChange: setQuantity,
        decision,
        onDecisionChange: setDecision,
        repairMode,
        onRepairModeChange: setRepairMode,
        externalPartner,
        onExternalPartnerChange: setExternalPartner,
        selectedWarehouseId,
        onSelectedWarehouseIdChange: setSelectedWarehouseId,
        selectedZoneId,
        onSelectedZoneIdChange: setSelectedZoneId,
        selectedBinId,
        onSelectedBinIdChange: setSelectedBinId,
        warehouses: warehousesQuery.data ?? [],
        zones: zonesQuery.data ?? [],
        bins: binsQuery.data ?? [],
        createItemPending: createItemMutation.isPending,
        items: itemsQuery.data ?? [],
        onDispatchExternal: (itemId) => {
          if (!selectedOrder) {
            return;
          }
          const item = (itemsQuery.data ?? []).find((candidate) => candidate.id === itemId);
          void dispatchExternalMutation.mutateAsync({
            orderId: selectedOrder.id,
            itemId,
            externalPartnerName: externalPartner || item?.external_partner || undefined,
          });
        },
        dispatchExternalPending: dispatchExternalMutation.isPending,
        onReceiveExternal: (itemId) => {
          if (!selectedOrder || !selectedBinId) {
            return;
          }
          void receiveExternalMutation.mutateAsync({
            orderId: selectedOrder.id,
            itemId,
            targetBinId: Number(selectedBinId),
          });
        },
        receiveExternalPending: receiveExternalMutation.isPending,
      }}
      workflowPanelProps={{
        selectedOrder,
        allowedTransitions,
        onStatusTransition: (status) => {
          if (!selectedOrder) {
            return;
          }
          void statusMutation.mutateAsync({
            orderId: selectedOrder.id,
            status,
          });
        },
        statusPending: statusMutation.isPending,
      }}
    />
  );
}
