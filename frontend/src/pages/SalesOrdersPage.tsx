import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchCustomers } from "../services/customersApi";
import { fetchAllProducts } from "../services/productsApi";
import { fetchServices } from "../services/servicesApi";
import {
  addSalesOrderItem,
  createDeliveryNote,
  createSalesOrder,
  fetchSalesOrder,
  fetchSalesOrders,
  updateSalesOrder,
} from "../services/salesOrdersApi";

export default function SalesOrdersPage() {
  const queryClient = useQueryClient();
  const [customerId, setCustomerId] = useState<string>("");
  const [itemType, setItemType] = useState<"product" | "service">("product");
  const [productId, setProductId] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>("");
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
  const productsQuery = useQuery({
    queryKey: ["products", "sales-order"],
    queryFn: () => fetchAllProducts(),
  });
  const servicesQuery = useQuery({
    queryKey: ["services", "sales-order"],
    queryFn: () => fetchServices({ page: 1, pageSize: 200, status: "active" }),
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
        item_type: itemType,
        product_id: itemType === "product" ? Number(productId) : undefined,
        service_id: itemType === "service" ? Number(serviceId) : undefined,
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

  const onCreateOrder = async (event: FormEvent) => {
    event.preventDefault();
    await createMutation.mutateAsync({
      customer_id: customerId ? Number(customerId) : undefined,
      items: [],
    });
  };

  const selectedOrder = selectedOrderQuery.data;

  const disableAddItem = useMemo(() => {
    if (selectedOrderId === null) {
      return true;
    }
    if (itemType === "product") {
      return !productId;
    }
    return !serviceId;
  }, [itemType, productId, selectedOrderId, serviceId]);

  return (
    <section className="panel" data-testid="sales-orders-page">
      <header className="panel-header">
        <div>
          <h2>Sales Orders</h2>
          <p className="panel-subtitle">Aufträge mit Produkt- und Servicepositionen.</p>
        </div>
      </header>

      <article className="subpanel">
        <h3>Neuen Auftrag erstellen</h3>
        <form className="inline-form" onSubmit={(event) => void onCreateOrder(event)}>
          <select className="input" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
            <option value="">Ohne Kunde</option>
            {(customersQuery.data?.items ?? []).map((customer) => (
              <option key={customer.id} value={customer.id}>{customer.company_name}</option>
            ))}
          </select>
          <button className="btn" type="submit" disabled={createMutation.isPending}>Auftrag anlegen</button>
        </form>
      </article>

      <article className="subpanel">
        <h3>Aufträge</h3>
        <div className="table-wrap">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>Nummer</th>
                <th>Status</th>
                <th>Kunde</th>
                <th>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {(ordersQuery.data?.items ?? []).map((order) => (
                <tr key={order.id}>
                  <td>{order.order_number}</td>
                  <td>{order.status}</td>
                  <td>{order.customer_id ?? "-"}</td>
                  <td>
                    <div className="actions-cell">
                      <button className="btn" type="button" onClick={() => setSelectedOrderId(order.id)}>Öffnen</button>
                      <button className="btn" type="button" onClick={() => void updateMutation.mutateAsync({ orderId: order.id, status: "confirmed" })}>Bestätigen</button>
                      <button className="btn" type="button" onClick={() => void deliveryNoteMutation.mutateAsync(order.id)}>Lieferschein</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      {selectedOrder ? (
        <article className="subpanel">
          <h3>Auftrag {selectedOrder.order.order_number}</h3>
          <div className="inline-form">
            <select className="input" value={itemType} onChange={(event) => setItemType(event.target.value as "product" | "service")}>
              <option value="product">Produkt</option>
              <option value="service">Service</option>
            </select>
            {itemType === "product" ? (
              <select className="input" value={productId} onChange={(event) => setProductId(event.target.value)}>
                <option value="">Produkt wählen</option>
                {(productsQuery.data?.items ?? []).map((product) => (
                  <option key={product.id} value={product.id}>{product.product_number} | {product.name}</option>
                ))}
              </select>
            ) : (
              <select className="input" value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
                <option value="">Service wählen</option>
                {(servicesQuery.data?.items ?? []).map((service) => (
                  <option key={service.id} value={service.id}>{service.service_number} | {service.name}</option>
                ))}
              </select>
            )}
            <input className="input" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            <button
              className="btn"
              type="button"
              disabled={disableAddItem || addItemMutation.isPending}
              onClick={() => selectedOrderId !== null && void addItemMutation.mutateAsync({ orderId: selectedOrderId })}
            >
              Position hinzufügen
            </button>
          </div>

          <div className="table-wrap">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Typ</th>
                  <th>Referenz</th>
                  <th>Menge</th>
                  <th>Invoiced</th>
                </tr>
              </thead>
              <tbody>
                {selectedOrder.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.line_no}</td>
                    <td>{item.item_type}</td>
                    <td>{item.item_type === "product" ? item.product_id : item.service_id}</td>
                    <td>{item.quantity}</td>
                    <td>{item.invoiced_quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      ) : null}
    </section>
  );
}
