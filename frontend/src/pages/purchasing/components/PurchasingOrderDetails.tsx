import type { FormEvent } from "react";
import { ArrowRight, CheckCircle, Mail, MessageSquare, Plus, RefreshCw, ShoppingCart } from "lucide-react";

import type {
  Product,
  PurchaseOrder,
  PurchaseOrderCommunicationEvent,
  PurchaseOrderItem,
  SupplierPurchaseEmailTemplate,
} from "../../../types";
import { purchaseTemplatePlaceholders, supplierCommStatusLabels } from "../model";

const supplierCommStatusClassMap: Record<PurchaseOrder["supplier_comm_status"], string> = {
  open_unsent: "bg-slate-100 text-slate-700",
  waiting_reply: "bg-amber-100 text-amber-700",
  reply_received_pending: "bg-blue-100 text-blue-700",
  confirmed_with_date: "bg-green-100 text-green-700",
  confirmed_undetermined: "bg-emerald-100 text-emerald-700",
};

function formatDateTime(value: string | null): string {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("de-DE");
}

function buildDocumentDownloadUrl(documentId: number): string {
  return `/api/documents/${documentId}/download`;
}

export type PurchasingOrderDetailsProps = {
  selectedOrder: PurchaseOrder | null;
  selectedSupplierName: string | null;
  allowedTransitions: PurchaseOrder["status"][];
  onStatusTransition: (orderId: number, nextStatus: PurchaseOrder["status"]) => void;
  statusMutationPending: boolean;
  onAddItem: (event: FormEvent) => void;
  productId: string;
  onProductIdChange: (value: string) => void;
  products: Product[];
  orderedQuantity: string;
  onOrderedQuantityChange: (value: string) => void;
  unitPrice: string;
  onUnitPriceChange: (value: string) => void;
  createItemPending: boolean;
  orderItems: PurchaseOrderItem[];
  orderItemsLoading: boolean;
  onSendOrderEmail: (orderId: number) => void;
  sendOrderEmailPending: boolean;
  onSyncMailbox: () => void;
  syncMailboxPending: boolean;
  mailboxSyncSummary: string | null;
  onConfirmSupplierReply: (
    orderId: number,
    payload: {
      supplier_comm_status: "confirmed_with_date" | "confirmed_undetermined";
      supplier_delivery_date?: string | null;
      supplier_last_reply_note?: string | null;
    }
  ) => void;
  confirmSupplierReplyPending: boolean;
  confirmationDeliveryDate: string;
  onConfirmationDeliveryDateChange: (value: string) => void;
  confirmationNote: string;
  onConfirmationNoteChange: (value: string) => void;
  communications: PurchaseOrderCommunicationEvent[];
  communicationsLoading: boolean;
  supplierTemplate: SupplierPurchaseEmailTemplate | null;
  supplierTemplateLoading: boolean;
  canEditSupplierTemplate: boolean;
  onTemplateFieldChange: (field: keyof Omit<SupplierPurchaseEmailTemplate, "supplier_id">, value: string) => void;
  onSaveSupplierTemplate: () => void;
  saveSupplierTemplatePending: boolean;
  templateFeedback: string | null;
};

export function PurchasingOrderDetails({
  selectedOrder,
  selectedSupplierName,
  allowedTransitions,
  onStatusTransition,
  statusMutationPending,
  onAddItem,
  productId,
  onProductIdChange,
  products,
  orderedQuantity,
  onOrderedQuantityChange,
  unitPrice,
  onUnitPriceChange,
  createItemPending,
  orderItems,
  orderItemsLoading,
  onSendOrderEmail,
  sendOrderEmailPending,
  onSyncMailbox,
  syncMailboxPending,
  mailboxSyncSummary,
  onConfirmSupplierReply,
  confirmSupplierReplyPending,
  confirmationDeliveryDate,
  onConfirmationDeliveryDateChange,
  confirmationNote,
  onConfirmationNoteChange,
  communications,
  communicationsLoading,
  supplierTemplate,
  supplierTemplateLoading,
  canEditSupplierTemplate,
  onTemplateFieldChange,
  onSaveSupplierTemplate,
  saveSupplierTemplatePending,
  templateFeedback,
}: PurchasingOrderDetailsProps) {
  if (!selectedOrder) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-12 text-center border border-dashed border-[var(--line-strong)] rounded-xl bg-[var(--panel)]/50">
        <div className="bg-[var(--panel-strong)] p-4 rounded-full mb-4">
          <ShoppingCart className="w-8 h-8 text-[var(--muted)]" />
        </div>
        <h3 className="text-lg font-medium text-[var(--ink)] mb-1">Keine Bestellung ausgewählt</h3>
        <p className="text-[var(--muted)] max-w-sm">
          Wählen Sie eine Bestellung aus der Liste links aus oder erstellen Sie eine neue, um Details zu sehen.
        </p>
      </div>
    );
  }

  const supplierStatusLabel = supplierCommStatusLabels[selectedOrder.supplier_comm_status];

  return (
    <div className="space-y-6">
      <div className="bg-[var(--panel)] border border-[var(--line)] rounded-xl shadow-sm p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Bestellung</span>
              <span
                className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                  selectedOrder.status === "completed"
                    ? "bg-green-100 text-green-700"
                    : selectedOrder.status === "cancelled"
                      ? "bg-red-100 text-red-700"
                      : "bg-blue-100 text-blue-700"
                }`}
              >
                {selectedOrder.status}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-xs font-semibold ${
                  supplierCommStatusClassMap[selectedOrder.supplier_comm_status]
                }`}
              >
                {supplierStatusLabel}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-[var(--ink)]" data-testid="purchase-order-selected-status">
              {selectedOrder.order_number} ({selectedOrder.status})
            </h2>
            <p className="text-sm text-[var(--muted)] mt-1">Lieferant: {selectedSupplierName ?? "-"}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {allowedTransitions.length > 0 ? (
              allowedTransitions.map((statusName) => (
                <button
                  key={statusName}
                  onClick={() => onStatusTransition(selectedOrder.id, statusName)}
                  disabled={statusMutationPending}
                  className="h-9 px-4 flex items-center gap-2 bg-[var(--panel-soft)] hover:bg-[var(--line)] border border-[var(--line)] text-[var(--ink)] text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  data-testid={`purchase-order-status-${statusName}`}
                >
                  <ArrowRight className="w-4 h-4" />
                  Mark as {statusName}
                </button>
              ))
            ) : (
              <span className="text-sm text-[var(--muted)] italic flex items-center gap-1">
                <CheckCircle className="w-4 h-4" />
                Endstatus erreicht
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <button
            type="button"
            onClick={() => onSendOrderEmail(selectedOrder.id)}
            disabled={sendOrderEmailPending || selectedOrder.supplier_comm_status !== "open_unsent"}
            className="h-10 px-4 flex items-center justify-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white rounded-lg text-sm font-medium disabled:opacity-50"
            data-testid="purchase-order-send-email-btn"
          >
            {sendOrderEmailPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            Bestellung senden
          </button>
          <button
            type="button"
            onClick={onSyncMailbox}
            disabled={syncMailboxPending}
            className="h-10 px-4 flex items-center justify-center gap-2 bg-[var(--panel-soft)] border border-[var(--line)] text-[var(--ink)] rounded-lg text-sm font-medium disabled:opacity-50"
            data-testid="purchase-order-sync-mail-btn"
          >
            {syncMailboxPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
            E-Mails synchronisieren
          </button>
          <div className="h-10 px-3 rounded-lg border border-[var(--line)] bg-[var(--bg)] text-xs text-[var(--muted)] flex items-center">
            {mailboxSyncSummary ?? "Noch kein Mail-Sync ausgeführt"}
          </div>
        </div>

        <div className="bg-[var(--bg)]/60 border border-[var(--line)] rounded-lg p-4 mb-6" data-testid="supplier-confirmation-section">
          <h4 className="text-sm font-semibold text-[var(--ink)] mb-3">Lieferantenrückmeldung</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs text-[var(--muted)] mb-1">Liefertermin</label>
              <input
                type="date"
                value={confirmationDeliveryDate}
                onChange={(event) => onConfirmationDeliveryDateChange(event.target.value)}
                className="w-full h-9 px-3 bg-[var(--panel)] border border-[var(--line)] rounded-lg text-sm text-[var(--ink)]"
                data-testid="supplier-confirmation-date"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-[var(--muted)] mb-1">Notiz zur Rückmeldung</label>
              <input
                value={confirmationNote}
                onChange={(event) => onConfirmationNoteChange(event.target.value)}
                className="w-full h-9 px-3 bg-[var(--panel)] border border-[var(--line)] rounded-lg text-sm text-[var(--ink)]"
                placeholder="Optional"
                data-testid="supplier-confirmation-note"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                onConfirmSupplierReply(selectedOrder.id, {
                  supplier_comm_status: "confirmed_with_date",
                  supplier_delivery_date: confirmationDeliveryDate || null,
                  supplier_last_reply_note: confirmationNote.trim() || null,
                })
              }
              disabled={confirmSupplierReplyPending}
              className="h-9 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              data-testid="supplier-confirm-with-date"
            >
              Bestätigen mit Termin
            </button>
            <button
              type="button"
              onClick={() =>
                onConfirmSupplierReply(selectedOrder.id, {
                  supplier_comm_status: "confirmed_undetermined",
                  supplier_delivery_date: null,
                  supplier_last_reply_note: confirmationNote.trim() || null,
                })
              }
              disabled={confirmSupplierReplyPending}
              className="h-9 px-4 bg-[var(--panel-soft)] border border-[var(--line)] text-[var(--ink)] rounded-lg text-sm font-medium disabled:opacity-50"
              data-testid="supplier-confirm-undetermined"
            >
              Bestätigen unbestimmt
            </button>
          </div>
          <div className="text-xs text-[var(--muted)] mt-3">
            Aktuell: {supplierStatusLabel} | Liefertermin: {selectedOrder.supplier_delivery_date ?? "unbestimmt"}
          </div>
        </div>

        {selectedOrder.status === "draft" ? (
          <div className="bg-[var(--bg)]/50 rounded-lg p-4 border border-[var(--line)] mb-6">
            <h4 className="text-sm font-semibold text-[var(--ink)] mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4" /> Position hinzufügen
            </h4>
            <form
              onSubmit={onAddItem}
              className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end"
              data-testid="purchase-order-item-form"
            >
              <div className="md:col-span-6">
                <label className="block text-xs font-medium text-[var(--muted)] mb-1">Produkt</label>
                <select
                  className="w-full h-9 px-3 bg-[var(--panel)] border border-[var(--line)] rounded-lg text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]"
                  value={productId}
                  onChange={(event) => onProductIdChange(event.target.value)}
                  data-testid="purchase-order-item-product-select"
                  aria-label="Produkt für Bestellposition auswählen"
                  required
                >
                  <option value="">Produkt wählen...</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.product_number} - {product.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-[var(--muted)] mb-1">Menge</label>
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  className="w-full h-9 px-3 bg-[var(--panel)] border border-[var(--line)] rounded-lg text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]"
                  value={orderedQuantity}
                  onChange={(event) => onOrderedQuantityChange(event.target.value)}
                  data-testid="purchase-order-item-quantity-input"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-[var(--muted)] mb-1">Preis (Optional)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full h-9 px-3 bg-[var(--panel)] border border-[var(--line)] rounded-lg text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]"
                  value={unitPrice}
                  onChange={(event) => onUnitPriceChange(event.target.value)}
                  placeholder="0.00"
                  data-testid="purchase-order-item-price-input"
                />
              </div>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={createItemPending}
                  className="w-full h-9 flex items-center justify-center gap-2 bg-[var(--ink)] hover:bg-[var(--ink)]/90 text-[var(--bg)] text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  data-testid="purchase-order-item-add-btn"
                >
                  Hinzufügen
                </button>
              </div>
            </form>
          </div>
        ) : null}

        <div className="overflow-x-auto border border-[var(--line)] rounded-lg mb-6">
          <table className="w-full text-left text-sm" data-testid="purchase-order-items-list">
            <thead className="bg-[var(--panel-strong)] text-[var(--muted)] font-medium">
              <tr>
                <th className="px-4 py-3">Produkt ID</th>
                <th className="px-4 py-3 text-right">Menge</th>
                <th className="px-4 py-3">Einheit</th>
                <th className="px-4 py-3 text-right">Preis</th>
                <th className="px-4 py-3 text-right">Summe</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--line)]">
              {orderItems.map((item) => (
                <tr key={item.id} className="bg-[var(--panel)] hover:bg-[var(--panel-soft)] transition-colors">
                  <td className="px-4 py-3 font-medium text-[var(--ink)]">#{item.product_id}</td>
                  <td className="px-4 py-3 text-right text-[var(--ink)]">{item.ordered_quantity}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{item.unit}</td>
                  <td className="px-4 py-3 text-right text-[var(--muted)]">
                    {item.unit_price ? Number(item.unit_price).toFixed(2) : "-"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-[var(--ink)]">
                    {item.unit_price ? (Number(item.unit_price) * Number(item.ordered_quantity)).toFixed(2) : "-"}
                  </td>
                </tr>
              ))}

              {!orderItemsLoading && orderItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[var(--muted)]">
                    Keine Positionen in dieser Bestellung.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="bg-[var(--bg)]/50 border border-[var(--line)] rounded-lg p-4 mb-6" data-testid="purchase-order-communications">
          <h4 className="text-sm font-semibold text-[var(--ink)] mb-3">Kommunikations-Timeline</h4>
          <div className="space-y-2">
            {communications.map((entry) => (
              <div key={entry.id} className="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2">
                <div className="flex justify-between items-center gap-3">
                  <div className="text-sm text-[var(--ink)]">
                    {entry.direction === "outbound" ? "Ausgang" : "Eingang"} · {entry.event_type}
                  </div>
                  <div className="text-xs text-[var(--muted)]">{formatDateTime(entry.occurred_at)}</div>
                </div>
                <div className="text-xs text-[var(--muted)] mt-1 truncate">Betreff: {entry.subject ?? "-"}</div>
                <div className="text-xs text-[var(--muted)] mt-1">Von: {entry.from_address ?? "-"} | An: {entry.to_address ?? "-"}</div>
                {entry.document_id ? (
                  <a
                    href={buildDocumentDownloadUrl(entry.document_id)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex mt-2 text-xs text-[var(--accent)] hover:underline"
                  >
                    Anhang herunterladen
                  </a>
                ) : null}
              </div>
            ))}
            {!communicationsLoading && communications.length === 0 ? (
              <div className="text-sm text-[var(--muted)]">Noch keine Kommunikationsereignisse vorhanden.</div>
            ) : null}
          </div>
        </div>

        <div className="bg-[var(--bg)]/50 border border-[var(--line)] rounded-lg p-4" data-testid="supplier-template-editor">
          <div className="flex items-center justify-between gap-4 mb-3">
            <h4 className="text-sm font-semibold text-[var(--ink)]">Lieferanten-E-Mail-Template</h4>
            <button
              type="button"
              onClick={onSaveSupplierTemplate}
              disabled={!canEditSupplierTemplate || saveSupplierTemplatePending || !supplierTemplate}
              className="h-9 px-4 bg-[var(--ink)] hover:bg-[var(--ink)]/90 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              data-testid="supplier-template-save"
            >
              Template speichern
            </button>
          </div>
          {supplierTemplateLoading ? <p className="text-sm text-[var(--muted)]">Template wird geladen...</p> : null}
          {supplierTemplate ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[var(--muted)] mb-1">Anrede</label>
                <input
                  value={supplierTemplate.salutation ?? ""}
                  onChange={(event) => onTemplateFieldChange("salutation", event.target.value)}
                  className="w-full h-9 px-3 bg-[var(--panel)] border border-[var(--line)] rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--muted)] mb-1">Betreff-Template</label>
                <input
                  value={supplierTemplate.subject_template ?? ""}
                  onChange={(event) => onTemplateFieldChange("subject_template", event.target.value)}
                  className="w-full h-9 px-3 bg-[var(--panel)] border border-[var(--line)] rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--muted)] mb-1">Body-Template</label>
                <textarea
                  value={supplierTemplate.body_template ?? ""}
                  onChange={(event) => onTemplateFieldChange("body_template", event.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 bg-[var(--panel)] border border-[var(--line)] rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--muted)] mb-1">Signatur</label>
                <textarea
                  value={supplierTemplate.signature ?? ""}
                  onChange={(event) => onTemplateFieldChange("signature", event.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-[var(--panel)] border border-[var(--line)] rounded-lg text-sm"
                />
              </div>
              <div className="text-xs text-[var(--muted)]">
                Platzhalter: {purchaseTemplatePlaceholders.join(", ")}
              </div>
              {templateFeedback ? <div className="text-xs text-[var(--muted)]">{templateFeedback}</div> : null}
              {!canEditSupplierTemplate ? (
                <div className="text-xs text-[var(--muted)]">Keine Berechtigung für Lieferanten-Templates.</div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">Wähle eine Bestellung mit Lieferant, um das Template zu bearbeiten.</p>
          )}
        </div>
      </div>
    </div>
  );
}
