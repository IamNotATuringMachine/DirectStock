import { useState, useMemo } from "react";
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

const formatCurrency = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return "-";
  return Number(value).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
};

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

  const selectedInvoice = useMemo(
    () => invoicesQuery.data?.items.find((inv) => inv.id === selectedInvoiceId),
    [invoicesQuery.data, selectedInvoiceId]
  );

  return (
    <section className="page flex flex-col gap-6" data-testid="invoices-page">
      {/* Header Section */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Rechnungen</h1>
          <p className="section-subtitle mt-1">
            Rechnung, Teilrechnung und E-Invoice Export.
          </p>
        </div>
      </header>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* Left Column: Create Invoice */}
        <div className="lg:col-span-4 bg-[var(--panel)] rounded-[var(--radius-lg)] border border-[var(--line)] p-6 shadow-sm">
          <h2 className="section-title mb-4">Rechnung erzeugen</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="salesOrderSelect" className="form-label-standard">
                Sales Order wählen
              </label>
              <select
                id="salesOrderSelect"
                className="input w-full"
                value={salesOrderId}
                onChange={(event) => setSalesOrderId(event.target.value)}
              >
                <option value="">Bitte wählen...</option>
                {(ordersQuery.data?.items ?? []).map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.order_number}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="btn btn-primary w-full justify-center"
              type="button"
              disabled={!salesOrderId || createMutation.isPending}
              onClick={() => void createMutation.mutateAsync({ sales_order_id: Number(salesOrderId) })}
            >
              {createMutation.isPending ? "Erstelle..." : "Rechnung erstellen"}
            </button>
          </div>
        </div>

        {/* Right Column: List & Details */}
        <div className="lg:col-span-8 space-y-6">

          {/* List of Invoices */}
          <div className="bg-[var(--panel)] rounded-[var(--radius-lg)] border border-[var(--line)] shadow-sm overflow-hidden flex flex-col max-h-[400px]">
            <div className="px-6 py-4 border-b border-[var(--line)] bg-[var(--panel-soft)] flex justify-between items-center">
              <h3 className="section-title">Rechnungsliste</h3>
              <span className="text-xs font-mono text-[var(--muted)] bg-[var(--bg)] px-2 py-1 rounded border border-[var(--line)]">
                Total: {invoicesQuery.data?.items?.length || 0}
              </span>
            </div>

            <div className="overflow-y-auto space-y-1 p-2">
              {(invoicesQuery.data?.items ?? []).map((invoice) => (
                <button
                  key={invoice.id}
                  className={`w-full text-left px-4 py-3 rounded-md hover:bg-[var(--panel-soft)] transition-colors flex items-center justify-between group ${selectedInvoiceId === invoice.id
                      ? "bg-[var(--panel-strong)] ring-1 ring-[var(--line)] shadow-sm"
                      : "border border-transparent"
                    }`}
                  onClick={() => setSelectedInvoiceId(invoice.id)}
                >
                  <div className="min-w-0 flex-1 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium text-[var(--ink)] truncate">
                        {invoice.invoice_number}
                      </span>
                      <span className="text-xs text-[var(--muted)] truncate">
                        Build from Order #{invoice.sales_order_id}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-medium text-[var(--ink)] tracking-tight tabular-nums text-sm">
                      {formatCurrency(invoice.total_gross)}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium w-fit border ${invoice.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                        invoice.status === 'SENT' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' :
                          'bg-[var(--bg)] text-[var(--muted)] border-[var(--line)]'
                      }`}>
                      {invoice.status}
                    </span>
                  </div>
                </button>
              ))}
              {(!invoicesQuery.data?.items || invoicesQuery.data.items.length === 0) && (
                <div className="p-8 text-center text-[var(--muted)] italic text-sm">
                  Keine Rechnungen gefunden.
                </div>
              )}
            </div>
          </div>

          {/* Selected Invoice Details */}
          {selectedInvoiceId && invoiceDetailQuery.data && (
            <div className="bg-[var(--panel)] rounded-[var(--radius-lg)] border border-[var(--line)] p-6 shadow-sm animate-in slide-in-from-bottom-2 duration-300">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6 border-b border-[var(--line)] pb-6">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--ink)]">
                    Rechnung <span className="font-mono">{invoiceDetailQuery.data.invoice.invoice_number}</span>
                  </h3>
                  <p className="text-sm text-[var(--muted)] mt-1">Details und Teilpositionen buchen</p>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <button
                    className="btn btn-sm btn-outline"
                    type="button"
                    onClick={() => void exportXMutation.mutateAsync(selectedInvoiceId)}
                  >
                    XRechnung
                  </button>
                  <button
                    className="btn btn-sm btn-outline"
                    type="button"
                    onClick={() => void exportZMutation.mutateAsync(selectedInvoiceId)}
                  >
                    ZUGFeRD
                  </button>
                </div>
              </div>

              {/* Partial Invoice Form */}
              <div className="bg-[var(--panel-soft)] p-4 rounded-lg border border-[var(--line)] mb-6">
                <h4 className="text-sm font-medium text-[var(--ink)] mb-3">Teilposition buchen</h4>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className="md:col-span-4 space-y-2">
                    <label className="text-xs font-medium text-[var(--muted)]">Sales Item ID</label>
                    <input
                      className="input w-full h-9 text-sm"
                      placeholder="ID"
                      value={partialItemId}
                      onChange={(event) => setPartialItemId(event.target.value)}
                    />
                  </div>
                  <div className="md:col-span-4 space-y-2">
                    <label className="text-xs font-medium text-[var(--muted)]">Menge</label>
                    <input
                      className="input w-full h-9 text-sm"
                      placeholder="Anzahl"
                      value={partialQuantity}
                      onChange={(event) => setPartialQuantity(event.target.value)}
                    />
                  </div>
                  <div className="md:col-span-4">
                    <button
                      className="btn btn-primary h-9 w-full justify-center text-sm"
                      type="button"
                      disabled={!partialItemId || partialMutation.isPending}
                      onClick={() =>
                        void partialMutation.mutateAsync({
                          invoiceId: selectedInvoiceId,
                          itemId: Number(partialItemId),
                          quantity: partialQuantity,
                        })
                      }
                    >
                      Buchen
                    </button>
                  </div>
                </div>
              </div>

              {/* Positions Table */}
              <div className="overflow-x-auto border border-[var(--line)] rounded-[var(--radius-sm)]">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[var(--panel-soft)] text-[var(--muted)] uppercase text-xs font-semibold">
                    <tr>
                      <th className="px-4 py-3">#</th>
                      <th className="px-4 py-3">Item ID</th>
                      <th className="px-4 py-3 text-right">Menge</th>
                      <th className="px-4 py-3 text-right">Netto</th>
                      <th className="px-4 py-3 text-right">Brutto</th>
                    </tr>
                  </thead>
                  <tbody className="bg-[var(--bg)] divide-y divide-[var(--line)]">
                    {invoiceDetailQuery.data.items.map((item) => (
                      <tr key={item.id} className="hover:bg-[var(--panel-soft)] transition-colors">
                        <td className="px-4 py-3 font-mono text-[var(--muted)]">{item.line_no}</td>
                        <td className="px-4 py-3 font-mono text-[var(--ink)]">{item.sales_order_item_id ?? "-"}</td>
                        <td className="px-4 py-3 text-right font-mono">{item.quantity}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(item.net_total)}</td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums text-[var(--ink)]">{formatCurrency(item.gross_total)}</td>
                      </tr>
                    ))}
                    {(!invoiceDetailQuery.data.items || invoiceDetailQuery.data.items.length === 0) && (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-[var(--muted)] italic">
                          Keine Positionen in dieser Rechnung.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          )}

        </div>
      </div>
    </section>
  );
}
