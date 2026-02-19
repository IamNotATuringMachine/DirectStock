import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchCustomerLocations, fetchCustomers } from "../services/customersApi";
import { fetchAllProducts } from "../services/productsApi";
import {
  addSalesOrderItem,
  createDeliveryNote,
  createSalesOrder,
  fetchSalesOrder,
  fetchSalesOrders,
  updateSalesOrder,
} from "../services/salesOrdersApi";
import { SalesOrdersView } from "./sales-orders/SalesOrdersView";

export default function SalesOrdersPage() {
  const queryClient = useQueryClient();
  const [customerId, setCustomerId] = useState<string>("");
  const [customerLocationId, setCustomerLocationId] = useState<string>("");
  const [productId, setProductId] = useState<string>("");
  const [quantity, setQuantity] = useState("1");
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

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

  return (
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
  );
}
