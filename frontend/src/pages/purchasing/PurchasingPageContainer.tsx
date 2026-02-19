import { type FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchAbcClassification, recomputeAbcClassification } from "../../services/abcApi";
import {
  convertPurchaseRecommendation,
  dismissPurchaseRecommendation,
  fetchPurchaseRecommendations,
  generatePurchaseRecommendations,
} from "../../services/purchaseRecommendationsApi";
import {
  createPurchaseOrder,
  createPurchaseOrderItem,
  fetchPurchaseOrderItems,
  fetchPurchaseOrders,
  updatePurchaseOrderStatus,
} from "../../services/purchasingApi";
import { fetchAllProducts } from "../../services/productsApi";
import { fetchSuppliers } from "../../services/suppliersApi";
import type { PurchaseOrder } from "../../types";
import { PurchasingView } from "./PurchasingView";
import { transitionTargets, type PurchasingTab } from "./model";

export default function PurchasingPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<PurchasingTab>("orders");

  const [supplierId, setSupplierId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  const [productId, setProductId] = useState<string>("");
  const [orderedQuantity, setOrderedQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");

  const suppliersQuery = useQuery({
    queryKey: ["suppliers", "purchasing"],
    queryFn: () => fetchSuppliers({ page: 1, pageSize: 200, isActive: true }),
    enabled: tab === "orders" || tab === "recommendations",
  });

  const productsQuery = useQuery({
    queryKey: ["products", "purchasing-picker"],
    queryFn: () => fetchAllProducts(),
    enabled: tab === "orders",
  });

  const ordersQuery = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: () => fetchPurchaseOrders(),
    enabled: tab === "orders",
  });

  const orderItemsQuery = useQuery({
    queryKey: ["purchase-order-items", selectedOrderId],
    queryFn: () => fetchPurchaseOrderItems(selectedOrderId as number),
    enabled: tab === "orders" && selectedOrderId !== null,
  });

  const abcQuery = useQuery({
    queryKey: ["abc-classification"],
    queryFn: () => fetchAbcClassification(),
    enabled: tab === "abc",
  });

  const recommendationsQuery = useQuery({
    queryKey: ["purchase-recommendations"],
    queryFn: () => fetchPurchaseRecommendations({ status: "open" }),
    enabled: tab === "recommendations",
  });

  const createOrderMutation = useMutation({
    mutationFn: createPurchaseOrder,
    onSuccess: async (order) => {
      setNotes("");
      setSupplierId("");
      await queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      setSelectedOrderId(order.id);
    },
  });

  const createItemMutation = useMutation({
    mutationFn: ({
      orderId,
      payload,
    }: {
      orderId: number;
      payload: Parameters<typeof createPurchaseOrderItem>[1];
    }) => createPurchaseOrderItem(orderId, payload),
    onSuccess: async () => {
      setOrderedQuantity("1");
      setUnitPrice("");
      await queryClient.invalidateQueries({ queryKey: ["purchase-order-items", selectedOrderId] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ orderId, nextStatus }: { orderId: number; nextStatus: PurchaseOrder["status"] }) =>
      updatePurchaseOrderStatus(orderId, nextStatus),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["purchase-order-items", selectedOrderId] });
    },
  });

  const recomputeAbcMutation = useMutation({
    mutationFn: () => recomputeAbcClassification(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["abc-classification"] });
    },
  });

  const generateRecommendationsMutation = useMutation({
    mutationFn: () => generatePurchaseRecommendations(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["purchase-recommendations"] });
    },
  });

  const convertRecommendationMutation = useMutation({
    mutationFn: (recommendationId: number) => convertPurchaseRecommendation(recommendationId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["purchase-recommendations"] }),
        queryClient.invalidateQueries({ queryKey: ["purchase-orders"] }),
      ]);
    },
  });

  const dismissRecommendationMutation = useMutation({
    mutationFn: (recommendationId: number) => dismissPurchaseRecommendation(recommendationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["purchase-recommendations"] });
    },
  });

  const selectedOrder = useMemo(
    () => ordersQuery.data?.find((order) => order.id === selectedOrderId) ?? null,
    [ordersQuery.data, selectedOrderId]
  );

  const allowedTransitions = selectedOrder ? transitionTargets[selectedOrder.status] : [];

  const onCreateOrder = async (event: FormEvent) => {
    event.preventDefault();
    await createOrderMutation.mutateAsync({
      supplier_id: supplierId ? Number(supplierId) : null,
      notes: notes.trim() || undefined,
    });
  };

  const onAddItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedOrderId || !productId) {
      return;
    }

    await createItemMutation.mutateAsync({
      orderId: selectedOrderId,
      payload: {
        product_id: Number(productId),
        ordered_quantity: orderedQuantity,
        unit: "piece",
        unit_price: unitPrice.trim() ? unitPrice.trim() : null,
      },
    });
  };

  return (
    <PurchasingView
      tab={tab}
      onTabChange={setTab}
      ordersSidebarProps={{
        supplierId,
        onSupplierIdChange: setSupplierId,
        notes,
        onNotesChange: setNotes,
        onCreateOrder: (event) => void onCreateOrder(event),
        createOrderPending: createOrderMutation.isPending,
        suppliers: suppliersQuery.data?.items ?? [],
        orders: ordersQuery.data ?? [],
        selectedOrderId,
        onSelectOrder: setSelectedOrderId,
        ordersLoading: ordersQuery.isLoading,
      }}
      orderDetailsProps={{
        selectedOrder,
        allowedTransitions,
        onStatusTransition: (orderId, nextStatus) => {
          void statusMutation.mutateAsync({ orderId, nextStatus });
        },
        statusMutationPending: statusMutation.isPending,
        onAddItem: (event) => void onAddItem(event),
        productId,
        onProductIdChange: setProductId,
        products: productsQuery.data?.items ?? [],
        orderedQuantity,
        onOrderedQuantityChange: setOrderedQuantity,
        unitPrice,
        onUnitPriceChange: setUnitPrice,
        createItemPending: createItemMutation.isPending,
        orderItems: orderItemsQuery.data ?? [],
        orderItemsLoading: orderItemsQuery.isLoading,
      }}
      abcTabProps={{
        items: abcQuery.data?.items ?? [],
        loading: abcQuery.isLoading,
        recomputePending: recomputeAbcMutation.isPending,
        onRecompute: () => {
          void recomputeAbcMutation.mutateAsync();
        },
      }}
      recommendationsTabProps={{
        items: recommendationsQuery.data?.items ?? [],
        loading: recommendationsQuery.isLoading,
        generatePending: generateRecommendationsMutation.isPending,
        convertPending: convertRecommendationMutation.isPending,
        dismissPending: dismissRecommendationMutation.isPending,
        onGenerate: () => {
          void generateRecommendationsMutation.mutateAsync();
        },
        onConvert: (recommendationId) => {
          void convertRecommendationMutation.mutateAsync(recommendationId);
        },
        onDismiss: (recommendationId) => {
          void dismissRecommendationMutation.mutateAsync(recommendationId);
        },
      }}
    />
  );
}
