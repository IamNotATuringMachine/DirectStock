import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCustomerLocations, fetchCustomers } from "../../services/customersApi";
import { fetchInventoryByBin } from "../../services/inventoryApi";
import {
  cancelGoodsIssue,
  completeGoodsIssue,
  createGoodsIssue,
  createGoodsIssueItem,
  fetchGoodsIssueItems,
  fetchGoodsIssues,
} from "../../services/operationsApi";
import { fetchAllProducts } from "../../services/productsApi";
import { fetchBins, fetchWarehouses, fetchZones } from "../../services/warehousesApi";
import type { BinLocation, InventoryByBinItem, Product } from "../../types";
import { flowSteps, type IssueFlowStep } from "./model";
import { resolveBinFromScan, resolveProductFromScan } from "./scanResolvers";
import { GoodsIssueView } from "./GoodsIssueView";

export default function GoodsIssuePage() {
  const queryClient = useQueryClient();
  const [customerId, setCustomerId] = useState<string>("");
  const [customerLocationId, setCustomerLocationId] = useState<string>("");
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
    queryFn: () => fetchAllProducts(),
  });

  const customersQuery = useQuery({
    queryKey: ["customers", "goods-issue-picker"],
    queryFn: async () => {
      try {
        return await fetchCustomers({ page: 1, pageSize: 200, isActive: true });
      } catch {
        return { items: [], total: 0, page: 1, page_size: 200 };
      }
    },
  });

  const customerLocationsQuery = useQuery({
    queryKey: ["customer-locations", "goods-issue-picker", customerId],
    queryFn: () => fetchCustomerLocations(Number(customerId), { isActive: true }),
    enabled: Boolean(customerId),
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
      setCustomerId("");
      setCustomerLocationId("");
      setCustomerReference("");
      await queryClient.invalidateQueries({ queryKey: ["goods-issues"] });
      setSelectedIssueId(issue.id);
    },
  });

  useEffect(() => {
    setCustomerLocationId("");
  }, [customerId]);

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

  const onFlowSourceBinScan = async (value: string) => {
    setFlowLoading(true);
    try {
      const sourceBin = await resolveBinFromScan(value, binsQuery.data ?? []);
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
      const product = await resolveProductFromScan(value, productsQuery.data?.items ?? []);
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
    await createIssueMutation.mutateAsync({
      customer_id: customerId ? Number(customerId) : undefined,
      customer_location_id: customerLocationId ? Number(customerLocationId) : undefined,
      customer_reference: customerReference.trim() || undefined,
    });
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
    <GoodsIssueView
      customerId={customerId}
      setCustomerId={setCustomerId}
      customerLocationId={customerLocationId}
      setCustomerLocationId={setCustomerLocationId}
      customerReference={customerReference}
      setCustomerReference={setCustomerReference}
      customers={customersQuery.data?.items ?? []}
      customerLocations={customerLocationsQuery.data ?? []}
      onCreateIssue={(event) => void onCreateIssue(event)}
      createIssuePending={createIssueMutation.isPending}
      issues={issuesQuery.data ?? []}
      selectedIssueId={selectedIssueId}
      onSelectIssue={(id) => setSelectedIssueId(id)}
      selectedIssue={selectedIssue}
      flowStep={flowStep}
      setFlowStep={setFlowStep}
      flowProgress={flowProgress}
      flowLoading={flowLoading}
      onFlowSourceBinScan={onFlowSourceBinScan}
      onFlowProductScan={onFlowProductScan}
      flowQuantity={flowQuantity}
      setFlowQuantity={setFlowQuantity}
      availableStock={availableStock}
      remainingAfterIssue={remainingAfterIssue}
      onConfirmFlowItem={() => void onConfirmFlowItem()}
      createItemPending={createItemMutation.isPending}
      flowSourceBin={flowSourceBin}
      flowProduct={flowProduct}
      flowFeedbackStatus={flowFeedbackStatus}
      flowFeedbackMessage={flowFeedbackMessage}
      onCompleteIssue={() => selectedIssueId && void completeMutation.mutateAsync(selectedIssueId)}
      completePending={completeMutation.isPending}
      onCancelIssue={() => selectedIssueId && void cancelMutation.mutateAsync(selectedIssueId)}
      cancelPending={cancelMutation.isPending}
      issueItems={issueItemsQuery.data ?? []}
      onAddItem={(event) => void onAddItem(event)}
      selectedProductId={selectedProductId}
      setSelectedProductId={setSelectedProductId}
      products={productsQuery.data?.items ?? []}
      selectedWarehouseId={selectedWarehouseId}
      setSelectedWarehouseId={setSelectedWarehouseId}
      setSelectedZoneId={setSelectedZoneId}
      setSelectedBinId={setSelectedBinId}
      warehouses={warehousesQuery.data ?? []}
      selectedBinId={selectedBinId}
      bins={binsQuery.data ?? []}
      requestedQuantity={requestedQuantity}
      setRequestedQuantity={setRequestedQuantity}
    />
  );
}
