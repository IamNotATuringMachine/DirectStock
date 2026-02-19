import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  cancelGoodsReceipt,
  completeGoodsReceipt,
  createGoodsReceipt,
  createGoodsReceiptAdHocProduct,
  createGoodsReceiptFromPo,
  createGoodsReceiptItem,
  deleteGoodsReceipt,
  downloadGoodsReceiptItemLabelsPdf,
  downloadGoodsReceiptItemSerialLabelsPdf,
  fetchBinSuggestions,
} from "../../../services/operationsApi";
import { fetchAllProducts, fetchProductGroups } from "../../../services/productsApi";
import { fetchPurchaseOrderItems, fetchPurchaseOrders, resolvePurchaseOrder } from "../../../services/purchasingApi";
import { fetchSuppliers } from "../../../services/suppliersApi";
import { createBin, fetchBins, fetchWarehouses, fetchZones } from "../../../services/warehousesApi";
import { useAuthStore } from "../../../stores/authStore";
import { useGoodsReceiptQueries } from "./useGoodsReceiptQueries";
import { useGoodsReceiptState } from "./useGoodsReceiptState";
import { useGoodsReceiptActions } from "./useGoodsReceiptActions";
import { flowSteps } from "../state";
import { useGoodsReceiptDefaults } from "./useGoodsReceiptDefaults";
import { useGoodsReceiptSyncEffects } from "./useGoodsReceiptSyncEffects";

export function useGoodsReceiptFlow() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const canQuickCreateProduct = Boolean(user?.permissions?.includes("module.products.quick_create"));
  const canCreateBins = Boolean(user?.roles.some((role) => role === "admin" || role === "lagerleiter"));

  const state = useGoodsReceiptState();

  const { receiptsQuery, receiptItemsQuery } = useGoodsReceiptQueries(state.selectedReceiptId);

  const selectedReceipt = useMemo(
    () => receiptsQuery.data?.find((item) => item.id === state.selectedReceiptId) ?? null,
    [receiptsQuery.data, state.selectedReceiptId]
  );

  const currentReceiptMode = selectedReceipt?.mode ?? state.receiptMode;
  const currentReceiptSourceType = selectedReceipt?.source_type ?? state.sourceType;
  const conditionRequiredForCurrentReceipt = currentReceiptMode === "free" && currentReceiptSourceType !== "supplier";

  const productsQuery = useQuery({
    queryKey: ["products", "goods-receipt-picker"],
    queryFn: () => fetchAllProducts(),
  });

  const selectedProduct = useMemo(
    () => productsQuery.data?.items.find((item) => String(item.id) === state.selectedProductId) ?? null,
    [productsQuery.data, state.selectedProductId]
  );

  const filteredProducts = useMemo(() => {
    const needle = state.productSearch.trim().toLowerCase();
    if (!needle) {
      return productsQuery.data?.items ?? [];
    }
    return (productsQuery.data?.items ?? []).filter((item) =>
      [item.product_number, item.name, item.description ?? ""].some((value) => value.toLowerCase().includes(needle))
    );
  }, [productsQuery.data, state.productSearch]);

  const suppliersQuery = useQuery({
    queryKey: ["suppliers", "goods-receipt-picker"],
    queryFn: async () => {
      try {
        return await fetchSuppliers({ page: 1, pageSize: 200, isActive: true });
      } catch {
        return { items: [], total: 0, page: 1, page_size: 200 };
      }
    },
  });

  const purchaseOrdersQuery = useQuery({
    queryKey: ["purchase-orders", "goods-receipt-picker"],
    queryFn: async () => {
      const ordered = await fetchPurchaseOrders("ordered");
      const partiallyReceived = await fetchPurchaseOrders("partially_received");
      return [...ordered, ...partiallyReceived];
    },
  });

  const purchaseOrderItemsQuery = useQuery({
    queryKey: ["purchase-order-items", selectedReceipt?.purchase_order_id],
    queryFn: () => fetchPurchaseOrderItems(selectedReceipt?.purchase_order_id as number),
    enabled: Boolean(selectedReceipt?.purchase_order_id),
  });

  const binSuggestionsQuery = useQuery({
    queryKey: ["bin-suggestions", state.flowProduct?.id],
    queryFn: () => fetchBinSuggestions(state.flowProduct!.id),
    enabled: state.flowProduct !== null && state.flowStep === "bin_scan",
  });

  const productGroupsQuery = useQuery({
    queryKey: ["product-groups", "goods-receipt-adhoc"],
    queryFn: fetchProductGroups,
    enabled: canQuickCreateProduct,
  });

  const warehousesQuery = useQuery({
    queryKey: ["warehouses", "goods-receipt-picker"],
    queryFn: fetchWarehouses,
  });

  const zonesQuery = useQuery({
    queryKey: ["zones", "goods-receipt-picker", state.selectedWarehouseId],
    queryFn: () => fetchZones(state.selectedWarehouseId as number),
    enabled: state.selectedWarehouseId !== null,
  });

  const binsQuery = useQuery({
    queryKey: ["bins", "goods-receipt-picker", state.selectedZoneId],
    queryFn: () => fetchBins(state.selectedZoneId as number),
    enabled: state.selectedZoneId !== null,
  });

  const createReceiptMutation = useMutation({
    mutationFn: createGoodsReceipt,
    onSuccess: async (receipt) => {
      state.setNotes("");
      state.setSupplierId("");
      state.setPurchaseOrderId("");
      await queryClient.invalidateQueries({ queryKey: ["goods-receipts"] });
      state.setSelectedReceiptId(receipt.id);
    },
  });

  const createReceiptFromPoMutation = useMutation({
    mutationFn: createGoodsReceiptFromPo,
    onSuccess: async (receipt) => {
      await queryClient.invalidateQueries({ queryKey: ["goods-receipts"] });
      state.setSelectedReceiptId(receipt.id);
      state.setPurchaseOrderId("");
    },
  });

  const resolvePurchaseOrderMutation = useMutation({
    mutationFn: resolvePurchaseOrder,
    onSuccess: (resolved) => {
      state.setPurchaseOrderId(String(resolved.order.id));
      state.setFlowFeedbackStatus("success");
      state.setFlowFeedbackMessage(`PO aufgelöst: ${resolved.order.order_number}`);
    },
    onError: () => {
      state.setFlowFeedbackStatus("error");
      state.setFlowFeedbackMessage("PO-Nummer konnte nicht aufgelöst werden");
    },
  });

  const createItemMutation = useMutation({
    mutationFn: ({
      receiptId,
      productId,
      quantity,
      targetBinId,
      serialNumbers,
      purchaseOrderItemId,
      input_method,
      condition,
    }: {
      receiptId: number;
      productId: number;
      quantity: string;
      targetBinId: number;
      serialNumbers?: string[];
      purchaseOrderItemId?: number;
      input_method?: "scan" | "manual";
      condition?: string;
    }) =>
      createGoodsReceiptItem(receiptId, {
        product_id: productId,
        received_quantity: quantity,
        target_bin_id: targetBinId,
        unit: "piece",
        serial_numbers: serialNumbers,
        purchase_order_item_id: purchaseOrderItemId,
        input_method,
        condition: condition ?? "new",
      }),
    onSuccess: async () => {
      state.setReceivedQuantity("1");
      state.setSerialNumbersInput("");
      state.setScannedSerials([]);
      await queryClient.invalidateQueries({ queryKey: ["goods-receipt-items", state.selectedReceiptId] });
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: completeGoodsReceipt,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["goods-receipts"] });
      await queryClient.invalidateQueries({ queryKey: ["goods-receipt-items", state.selectedReceiptId] });
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelGoodsReceipt,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["goods-receipts"] });
      await queryClient.invalidateQueries({ queryKey: ["goods-receipt-items", state.selectedReceiptId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteGoodsReceipt,
    onSuccess: async () => {
      state.setSelectedReceiptId(null);
      await queryClient.invalidateQueries({ queryKey: ["goods-receipts"] });
      await queryClient.invalidateQueries({ queryKey: ["goods-receipt-items"] });
    },
  });

  const adHocProductMutation = useMutation({
    mutationFn: ({
      receiptId,
      payload,
    }: {
      receiptId: number;
      payload: Parameters<typeof createGoodsReceiptAdHocProduct>[1];
    }) => createGoodsReceiptAdHocProduct(receiptId, payload),
    onSuccess: async (product) => {
      await queryClient.invalidateQueries({ queryKey: ["product-groups", "goods-receipt-adhoc"] });
      await queryClient.invalidateQueries({ queryKey: ["products", "goods-receipt-picker"] });
      state.setSelectedProductId(String(product.id));
      state.resetAdHocModal();
    },
  });

  const createBinMutation = useMutation({
    mutationFn: ({ zoneId, code }: { zoneId: number; code: string }) =>
      createBin(zoneId, { code, bin_type: "storage", is_active: true }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ["bins", "goods-receipt-picker", state.selectedZoneId] });
      state.setSelectedBinId(String(created.id));
      state.setNewBinCode("");
      state.setFlowFeedbackStatus("success");
      state.setFlowFeedbackMessage(`Neuer Platz angelegt: ${created.code}`);
    },
    onError: () => {
      state.setFlowFeedbackStatus("error");
      state.setFlowFeedbackMessage("Neuen Lagerplatz anlegen fehlgeschlagen");
    },
  });

  const actions = useGoodsReceiptActions({
    ...state,
    selectedReceipt,
    selectedProduct,
    conditionRequiredForCurrentReceipt,
    productsQuery,
    binsQuery,
    purchaseOrderItemsQuery,
    createReceiptMutation,
    createItemMutation,
    adHocProductMutation,
    resolvePurchaseOrderMutation,
    downloadGoodsReceiptItemLabelsPdf,
    downloadGoodsReceiptItemSerialLabelsPdf,
  });

  useGoodsReceiptDefaults({
    selectedWarehouseId: state.selectedWarehouseId,
    setSelectedWarehouseId: state.setSelectedWarehouseId,
    warehouses: warehousesQuery.data,
    selectedZoneId: state.selectedZoneId,
    setSelectedZoneId: state.setSelectedZoneId,
    zones: zonesQuery.data,
    selectedBinId: state.selectedBinId,
    setSelectedBinId: state.setSelectedBinId,
    bins: binsQuery.data,
    selectedProductId: state.selectedProductId,
    setSelectedProductId: state.setSelectedProductId,
    products: productsQuery.data?.items,
  });

  useGoodsReceiptSyncEffects({
    receiptMode: state.receiptMode,
    sourceType: state.sourceType,
    manualCondition: state.manualCondition,
    setSourceType: state.setSourceType,
    setManualCondition: state.setManualCondition,
    selectedProductRequiresItemTracking: selectedProduct?.requires_item_tracking,
    setScannedSerials: state.setScannedSerials,
    setSerialNumbersInput: state.setSerialNumbersInput,
    selectedReceipt,
    purchaseOrderItems: purchaseOrderItemsQuery.data,
    selectedProductId: state.selectedProductId,
    setSelectedPurchaseOrderItemId: state.setSelectedPurchaseOrderItemId,
    setPurchaseOrderId: state.setPurchaseOrderId,
    setReceiptMode: state.setReceiptMode,
  });

  const flowStepIndex = flowSteps.findIndex((step) => step.id === state.flowStep);
  const flowProgress = ((flowStepIndex + 1) / flowSteps.length) * 100;

  return {
    ...state,
    ...actions,
    canQuickCreateProduct,
    canCreateBins,
    receiptsQuery,
    receiptItemsQuery,
    selectedReceipt,
    currentReceiptMode,
    currentReceiptSourceType,
    conditionRequiredForCurrentReceipt,
    productsQuery,
    selectedProduct,
    filteredProducts,
    suppliersQuery,
    purchaseOrdersQuery,
    purchaseOrderItemsQuery,
    binSuggestionsQuery,
    productGroupsQuery,
    warehousesQuery,
    zonesQuery,
    binsQuery,
    createReceiptMutation,
    createReceiptFromPoMutation,
    resolvePurchaseOrderMutation,
    createItemMutation,
    completeMutation,
    cancelMutation,
    deleteMutation,
    adHocProductMutation,
    createBinMutation,
    flowSteps,
    flowStepIndex,
    flowProgress,
  };
}
