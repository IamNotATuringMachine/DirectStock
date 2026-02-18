import WorkflowScanInput from "../../../components/scanner/WorkflowScanInput";
import { ReceiptHeaderForm } from "./ReceiptHeaderForm";

export function GoodsReceiptReceiptListSection({ vm }: { vm: any }) {
  return (
    <ReceiptHeaderForm>
      <div className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm flex flex-col h-[calc(100vh-200px)] min-h-[500px] overflow-hidden">
        <div className="p-4 border-b border-[var(--line)] bg-[var(--panel-soft)]">
          <h3 className="section-title">1. Beleg anlegen</h3>
        </div>

        <div className="p-4 flex-1 overflow-hidden flex flex-col gap-4">
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => void vm.onCreateReceipt(event)}
            data-testid="goods-receipt-create-form"
          >
            <div className="space-y-1">
              <label className="block text-sm font-medium text-[var(--ink)] mb-1.5">Eingangskanal</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={`btn text-xs justify-center ${vm.receiptMode === "po" ? "btn-primary" : "btn-ghost border border-[var(--line)]"}`}
                  onClick={() => vm.setReceiptMode("po")}
                  data-testid="goods-receipt-mode-po-btn"
                >
                  Modus A: Bestellung
                </button>
                <button
                  type="button"
                  className={`btn text-xs justify-center ${vm.receiptMode === "free" ? "btn-primary" : "btn-ghost border border-[var(--line)]"}`}
                  onClick={() => vm.setReceiptMode("free")}
                  data-testid="goods-receipt-mode-free-btn"
                >
                  Modus B: Frei
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-[var(--ink)] mb-1.5" htmlFor="goods-receipt-po-select">
                Bestellauftrag
              </label>
              <select
                id="goods-receipt-po-select"
                className="input w-full min-w-0"
                value={vm.purchaseOrderId}
                onChange={(event) => vm.setPurchaseOrderId(event.target.value)}
                disabled={vm.receiptMode !== "po"}
                data-testid="goods-receipt-po-select"
              >
                <option value="">Kein Auftrag</option>
                {(vm.purchaseOrdersQuery.data ?? []).map((purchaseOrder: any) => (
                  <option key={purchaseOrder.id} value={purchaseOrder.id}>
                    {purchaseOrder.order_number} ({purchaseOrder.status})
                  </option>
                ))}
              </select>
              {vm.receiptMode === "po" ? (
                <div className="space-y-2 mt-1.5">
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <input
                      className="input w-full"
                      value={vm.poResolveInput}
                      onChange={(event) => vm.setPoResolveInput(event.target.value)}
                      placeholder="PO-Nummer scannen/eingeben"
                      data-testid="goods-receipt-po-resolve-input"
                    />
                    <button
                      type="button"
                      className="btn btn-ghost text-xs border border-[var(--line)]"
                      onClick={() => void vm.resolvePurchaseOrderNumber(vm.poResolveInput)}
                      disabled={vm.resolvePurchaseOrderMutation.isPending || !vm.poResolveInput.trim()}
                      data-testid="goods-receipt-po-resolve-btn"
                    >
                      Auflösen
                    </button>
                  </div>
                  <WorkflowScanInput
                    enabled
                    isLoading={vm.resolvePurchaseOrderMutation.isPending}
                    label="PO-Nummer scannen"
                    placeholder="DS:PO:... oder PO-Nummer"
                    onScan={(value) => vm.resolvePurchaseOrderNumber(value)}
                    testIdPrefix="goods-receipt-po-scan"
                  />
                </div>
              ) : null}
              {vm.purchaseOrderId && vm.receiptMode === "po" ? (
                <button
                  type="button"
                  className="btn btn-ghost w-full justify-center mt-1.5 border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white text-xs"
                  onClick={() => void vm.createReceiptFromPoMutation.mutateAsync(Number(vm.purchaseOrderId))}
                  disabled={vm.createReceiptFromPoMutation.isPending}
                  data-testid="goods-receipt-from-po-btn"
                >
                  {vm.createReceiptFromPoMutation.isPending ? "Wird angelegt…" : "Positionen aus Bestellung übernehmen"}
                </button>
              ) : null}
            </div>

            <div className="space-y-1">
              <label
                className="block text-sm font-medium text-[var(--ink)] mb-1.5"
                htmlFor="goods-receipt-supplier-select"
              >
                Warenlieferant
              </label>
              <select
                id="goods-receipt-supplier-select"
                className="input w-full min-w-0"
                value={vm.supplierId}
                onChange={(event) => vm.setSupplierId(event.target.value)}
                disabled={vm.receiptMode === "free" && vm.sourceType !== "supplier"}
                data-testid="goods-receipt-supplier-select"
              >
                <option value="">Kein Warenlieferant</option>
                {(vm.suppliersQuery.data?.items ?? []).map((supplier: any) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.supplier_number} - {supplier.company_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label
                className="block text-sm font-medium text-[var(--ink)] mb-1.5"
                htmlFor="goods-receipt-source-type-select"
              >
                Quelle
              </label>
              <select
                id="goods-receipt-source-type-select"
                className="input w-full min-w-0"
                value={vm.sourceType}
                onChange={(event) => vm.setSourceType(event.target.value as "supplier" | "technician" | "other")}
                disabled={vm.receiptMode === "po"}
                data-testid="goods-receipt-source-type-select"
              >
                <option value="supplier">Lieferant</option>
                <option value="technician">Techniker-Rückläufer</option>
                <option value="other">Sonstige Quelle</option>
              </select>
            </div>

            <div className="flex gap-2">
              <input
                className="input w-full min-w-0"
                placeholder="Notiz (optional)"
                value={vm.notes}
                onChange={(event) => vm.setNotes(event.target.value)}
                data-testid="goods-receipt-notes-input"
              />
              <button
                className="btn btn-primary shrink-0"
                type="submit"
                disabled={vm.createReceiptMutation.isPending}
                data-testid="goods-receipt-create-btn"
              >
                Neu
              </button>
            </div>
          </form>

          {vm.receiptMode === "po" ? (
            <div className="border border-[var(--line)] rounded-[var(--radius-sm)] bg-[var(--panel-soft)] p-2 max-h-28 overflow-y-auto space-y-1">
              {(vm.purchaseOrdersQuery.data ?? []).map((purchaseOrder: any) => (
                <button
                  key={purchaseOrder.id}
                  type="button"
                  className={`w-full text-left px-2 py-1.5 rounded text-xs border ${String(purchaseOrder.id) === vm.purchaseOrderId ? "border-[var(--accent)] bg-[var(--panel)]" : "border-transparent hover:border-[var(--line)]"}`}
                  onClick={() => {
                    vm.setPurchaseOrderId(String(purchaseOrder.id));
                    vm.setPoResolveInput(purchaseOrder.order_number);
                  }}
                  data-testid={`goods-receipt-po-open-item-${purchaseOrder.id}`}
                >
                  {purchaseOrder.order_number} · {purchaseOrder.status}
                </button>
              ))}
            </div>
          ) : null}

          <div className="border-b border-[var(--line)] my-1"></div>

          <div
            className="flex-1 overflow-y-auto border border-[var(--line)] rounded-[var(--radius-sm)] bg-[var(--bg)]"
            data-testid="goods-receipt-list"
          >
            {(vm.receiptsQuery.data ?? []).length === 0 ? (
              <div className="p-8 text-center text-[var(--muted)] italic text-sm">Keine offenen Belege gefunden.</div>
            ) : (
              <div className="divide-y divide-[var(--line)]">
                {(vm.receiptsQuery.data ?? []).map((receipt: any) => (
                  <div
                    key={receipt.id}
                    className={`w-full p-3 hover:bg-[var(--panel-soft)] transition-colors flex items-center justify-between gap-3 group
                            ${vm.selectedReceiptId === receipt.id ? "bg-[var(--panel-strong)] border-l-4 border-l-[var(--accent)] pl-[calc(0.75rem-4px)]" : "border-l-4 border-l-transparent"}
                          `}
                  >
                    <button
                      className="text-left min-w-0 flex-1"
                      onClick={() => vm.setSelectedReceiptId(receipt.id)}
                      data-testid={`goods-receipt-item-${receipt.id}`}
                    >
                      <div className="font-medium text-[var(--ink)] truncate">{receipt.receipt_number}</div>
                      <div className="text-xs text-[var(--muted)] flex items-center gap-1.5 mt-0.5">
                        <span
                          className={`inline-block w-2 h-2 rounded-full
                                ${
                                  receipt.status === "completed"
                                    ? "bg-emerald-500"
                                    : receipt.status === "cancelled"
                                      ? "bg-red-500"
                                      : "bg-amber-500"
                                }
                              `}
                        ></span>
                        {receipt.status}
                      </div>
                    </button>

                    {receipt.status === "draft" ? (
                      <button
                        type="button"
                        className="btn btn-ghost shrink-0 text-xs text-[var(--destructive)] hover:bg-red-50"
                        disabled={vm.deleteMutation.isPending}
                        onClick={() => {
                          if (!window.confirm("Diesen Draft-Beleg wirklich loeschen?")) {
                            return;
                          }
                          void vm.deleteMutation.mutateAsync(receipt.id);
                        }}
                        data-testid={`goods-receipt-item-delete-btn-${receipt.id}`}
                      >
                        Loeschen
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </ReceiptHeaderForm>
  );
}
