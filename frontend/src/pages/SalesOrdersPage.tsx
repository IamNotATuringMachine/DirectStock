import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { OperationSignoffModal } from "../components/operations/OperationSignoffModal";
import { fetchCustomerLocations, fetchCustomers } from "../services/customersApi";
import {
  fetchOperationSignoffSettings,
  fetchOperators,
  unlockOperator,
  updateOperator,
} from "../services/operatorsApi";
import { fetchAllProducts } from "../services/productsApi";
import {
  addSalesOrderItem,
  completeSalesOrder,
  createDeliveryNote,
  createSalesOrder,
  fetchSalesOrder,
  fetchSalesOrders,
  updateSalesOrder,
} from "../services/salesOrdersApi";
import { useAuthStore } from "../stores/authStore";
import type { CompletionSignoffPayload } from "../types";
import { isOperationSignoffRequired } from "../utils/tabletOps";
import { SalesOrdersView } from "./sales-orders/SalesOrdersView";

export default function SalesOrdersPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const requiresSignoffCompletion = isOperationSignoffRequired(user);
  const [customerId, setCustomerId] = useState<string>("");
  const [customerLocationId, setCustomerLocationId] = useState<string>("");
  const [productId, setProductId] = useState<string>("");
  const [quantity, setQuantity] = useState("1");
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [isSignoffModalOpen, setIsSignoffModalOpen] = useState(false);

  const ordersQuery = useQuery({
    queryKey: ["sales-orders"],
    queryFn: () => fetchSalesOrders({ page: 1, pageSize: 200 }),
  });
  const customersQuery = useQuery({
    queryKey: ["customers", "sales-order"],
    queryFn: () => fetchCustomers({ page: 1, pageSize: 200, isActive: true }),
  });
  const customerLocationsQuery = useQuery({
    queryKey: ["customer-locations", "sales-order", customerId],
    queryFn: () => fetchCustomerLocations(Number(customerId), { isActive: true }),
    enabled: Boolean(customerId),
  });
  const productsQuery = useQuery({
    queryKey: ["products", "sales-order"],
    queryFn: () => fetchAllProducts(),
  });

  const selectedOrderQuery = useQuery({
    queryKey: ["sales-order", selectedOrderId],
    queryFn: () => fetchSalesOrder(selectedOrderId as number),
    enabled: selectedOrderId !== null,
  });

  const operatorsQuery = useQuery({
    queryKey: ["operators"],
    queryFn: fetchOperators,
    enabled: requiresSignoffCompletion,
  });

  const signoffSettingsQuery = useQuery({
    queryKey: ["operators", "signoff-settings"],
    queryFn: fetchOperationSignoffSettings,
    enabled: requiresSignoffCompletion,
  });

  const createMutation = useMutation({
    mutationFn: createSalesOrder,
    onSuccess: async (detail) => {
      setSelectedOrderId(detail.order.id);
      await queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
    },
  });

  const addItemMutation = useMutation({
    mutationFn: ({ orderId }: { orderId: number }) =>
      addSalesOrderItem(orderId, {
        item_type: "product",
        product_id: Number(productId),
        quantity,
        unit: "piece",
      }),
    onSuccess: async () => {
      if (selectedOrderId !== null) {
        await queryClient.invalidateQueries({ queryKey: ["sales-order", selectedOrderId] });
      }
      await queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: number; status: string }) => updateSalesOrder(orderId, { status }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      if (selectedOrderId !== null) {
        await queryClient.invalidateQueries({ queryKey: ["sales-order", selectedOrderId] });
      }
    },
  });

  const unlockOperatorMutation = useMutation({
    mutationFn: unlockOperator,
  });

  const updateOperatorPinMutation = useMutation({
    mutationFn: ({
      operatorId,
      pin,
      pinEnabledOnly = false,
    }: {
      operatorId: number;
      pin?: string;
      pinEnabledOnly?: boolean;
    }) =>
      updateOperator(operatorId, pinEnabledOnly ? { pin_enabled: true } : { pin, pin_enabled: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["operators"] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: ({
      orderId,
      payload,
    }: {
      orderId: number;
      payload?: CompletionSignoffPayload;
    }) => completeSalesOrder(orderId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      if (selectedOrderId !== null) {
        await queryClient.invalidateQueries({ queryKey: ["sales-order", selectedOrderId] });
      }
    },
  });

  const deliveryNoteMutation = useMutation({
    mutationFn: (orderId: number) => createDeliveryNote(orderId),
  });

  const onCreateOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await createMutation.mutateAsync({
      customer_id: customerId ? Number(customerId) : undefined,
      customer_location_id: customerLocationId ? Number(customerLocationId) : undefined,
      items: [],
    });
  };

  useEffect(() => {
    setCustomerLocationId("");
  }, [customerId]);

  const selectedOrder = selectedOrderQuery.data ?? null;

  const disableAddItem = useMemo(() => {
    if (selectedOrderId === null) {
      return true;
    }
    return !productId;
  }, [productId, selectedOrderId]);

  const onCompleteOrder = async (orderId: number) => {
    if (!requiresSignoffCompletion) {
      await completeMutation.mutateAsync({ orderId });
      return;
    }
    setSelectedOrderId(orderId);
    setIsSignoffModalOpen(true);
  };

  const onConfirmSignoff = async (payload: CompletionSignoffPayload) => {
    if (!selectedOrderId) {
      return;
    }
    await completeMutation.mutateAsync({ orderId: selectedOrderId, payload });
    setIsSignoffModalOpen(false);
  };

  return (
    <>
      <SalesOrdersView
        orders={ordersQuery.data?.items ?? []}
        selectedOrderId={selectedOrderId}
        onSelectOrder={setSelectedOrderId}
        onConfirmOrder={(orderId) => {
          void updateMutation.mutateAsync({ orderId, status: "confirmed" });
        }}
        onDeliverOrder={(orderId) => {
          void deliveryNoteMutation.mutateAsync(orderId);
        }}
        onCompleteOrder={(orderId) => {
          void onCompleteOrder(orderId);
        }}
        completeOrderPending={completeMutation.isPending}
        customers={customersQuery.data?.items ?? []}
        customerLocations={customerLocationsQuery.data ?? []}
        customerId={customerId}
        onCustomerIdChange={setCustomerId}
        customerLocationId={customerLocationId}
        onCustomerLocationIdChange={setCustomerLocationId}
        onCreateOrder={(event) => void onCreateOrder(event)}
        createOrderPending={createMutation.isPending}
        selectedOrder={selectedOrder}
        products={productsQuery.data?.items ?? []}
        productId={productId}
        onProductIdChange={setProductId}
        quantity={quantity}
        onQuantityChange={setQuantity}
        disableAddItem={disableAddItem}
        addItemPending={addItemMutation.isPending}
        onAddItem={() => {
          if (selectedOrderId === null) {
            return;
          }
          void addItemMutation.mutateAsync({ orderId: selectedOrderId });
        }}
      />
      <OperationSignoffModal
        isOpen={isSignoffModalOpen}
        title="Verkaufsauftrag abschließen"
        operators={operatorsQuery.data ?? []}
        settings={signoffSettingsQuery.data ?? null}
        loading={operatorsQuery.isLoading || signoffSettingsQuery.isLoading}
        submitting={completeMutation.isPending || updateOperatorPinMutation.isPending}
        onClose={() => setIsSignoffModalOpen(false)}
        onUnlock={(pin) => unlockOperatorMutation.mutateAsync(pin)}
        onSetOperatorPin={(operatorId, pin) => updateOperatorPinMutation.mutateAsync({ operatorId, pin })}
        onEnableOperatorPin={(operatorId) => updateOperatorPinMutation.mutateAsync({ operatorId, pinEnabledOnly: true })}
        onConfirm={(payload) => onConfirmSignoff(payload)}
      />
    </>
  );
}
