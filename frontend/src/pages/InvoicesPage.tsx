import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchSalesOrders } from "../services/salesOrdersApi";
import {
  createInvoice,
  createInvoicePartial,
  exportXrechnung,
  exportZugferd,
  fetchInvoice,
  fetchInvoices,
} from "../services/invoicesApi";

export default function InvoicesPage() {
  const queryClient = useQueryClient();
  const [salesOrderId, setSalesOrderId] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [partialItemId, setPartialItemId] = useState("");
  const [partialQuantity, setPartialQuantity] = useState("1");

  const invoicesQuery = useQuery({
    queryKey: ["invoices"],
    queryFn: () => fetchInvoices({ page: 1, pageSize: 200 }),
  });
  const ordersQuery = useQuery({
    queryKey: ["sales-orders", "invoices"],
    queryFn: () => fetchSalesOrders({ page: 1, pageSize: 200 }),
  });

  const invoiceDetailQuery = useQuery({
    queryKey: ["invoice", selectedInvoiceId],
    queryFn: () => fetchInvoice(selectedInvoiceId as number),
    enabled: selectedInvoiceId !== null,
  });

  const createMutation = useMutation({
    mutationFn: createInvoice,
    onSuccess: async (detail) => {
      setSelectedInvoiceId(detail.invoice.id);
      await queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });

  const partialMutation = useMutation({
    mutationFn: ({ invoiceId, itemId, quantity }: { invoiceId: number; itemId: number; quantity: string }) =>
      createInvoicePartial(invoiceId, [{ sales_order_item_id: itemId, quantity }]),
    onSuccess: async () => {
      if (selectedInvoiceId !== null) {
        await queryClient.invalidateQueries({ queryKey: ["invoice", selectedInvoiceId] });
      }
      await queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });

  const exportXMutation = useMutation({
    mutationFn: exportXrechnung,
  });

  const exportZMutation = useMutation({
    mutationFn: exportZugferd,
  });

  return (
    <section className="panel" data-testid="invoices-page">
      <header className="panel-header">
        <div>
          <h2>Rechnungen</h2>
          <p className="panel-subtitle">Rechnung, Teilrechnung und E-Invoice Export.</p>
        </div>
      </header>

      <article className="subpanel">
        <h3>Rechnung erzeugen</h3>
        <div className="inline-form">
          <select className="input" value={salesOrderId} onChange={(event) => setSalesOrderId(event.target.value)}>
            <option value="">Sales Order wählen</option>
            {(ordersQuery.data?.items ?? []).map((order) => (
              <option key={order.id} value={order.id}>{order.order_number}</option>
            ))}
          </select>
          <button
            className="btn"
            type="button"
            disabled={!salesOrderId || createMutation.isPending}
            onClick={() => void createMutation.mutateAsync({ sales_order_id: Number(salesOrderId) })}
          >
            Rechnung erstellen
          </button>
        </div>
      </article>

      <article className="subpanel">
        <h3>Rechnungsliste</h3>
        <div className="table-wrap">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>Nummer</th>
                <th>Status</th>
                <th>Order</th>
                <th>Brutto</th>
                <th>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {(invoicesQuery.data?.items ?? []).map((invoice) => (
                <tr key={invoice.id}>
                  <td>{invoice.invoice_number}</td>
                  <td>{invoice.status}</td>
                  <td>{invoice.sales_order_id}</td>
                  <td>{invoice.total_gross}</td>
                  <td>
                    <div className="actions-cell">
                      <button className="btn" type="button" onClick={() => setSelectedInvoiceId(invoice.id)}>Öffnen</button>
                      <button className="btn" type="button" onClick={() => void exportXMutation.mutateAsync(invoice.id)}>XRechnung</button>
                      <button className="btn" type="button" onClick={() => void exportZMutation.mutateAsync(invoice.id)}>ZUGFeRD</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      {invoiceDetailQuery.data ? (
        <article className="subpanel">
          <h3>Rechnung {invoiceDetailQuery.data.invoice.invoice_number}</h3>
          <div className="inline-form">
            <input
              className="input"
              placeholder="sales_order_item_id"
              value={partialItemId}
              onChange={(event) => setPartialItemId(event.target.value)}
            />
            <input
              className="input"
              placeholder="Menge"
              value={partialQuantity}
              onChange={(event) => setPartialQuantity(event.target.value)}
            />
            <button
              className="btn"
              type="button"
              disabled={!partialItemId || partialMutation.isPending || selectedInvoiceId === null}
              onClick={() =>
                selectedInvoiceId !== null &&
                void partialMutation.mutateAsync({
                  invoiceId: selectedInvoiceId,
                  itemId: Number(partialItemId),
                  quantity: partialQuantity,
                })
              }
            >
              Teilposition buchen
            </button>
          </div>

          <div className="table-wrap">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>SalesItem</th>
                  <th>Menge</th>
                  <th>Netto</th>
                  <th>Brutto</th>
                </tr>
              </thead>
              <tbody>
                {invoiceDetailQuery.data.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.line_no}</td>
                    <td>{item.sales_order_item_id ?? "-"}</td>
                    <td>{item.quantity}</td>
                    <td>{item.net_total}</td>
                    <td>{item.gross_total}</td>
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
