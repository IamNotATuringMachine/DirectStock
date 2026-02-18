import { ReceiptItemForm } from "./ReceiptItemForm";

export function GoodsReceiptItemsListSection({ vm }: { vm: any }) {
  return (
    <ReceiptItemForm>
      <div className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm flex flex-col h-[calc(100vh-200px)] min-h-[500px] overflow-hidden">
        <div className="p-4 border-b border-[var(--line)] bg-[var(--panel-soft)]">
          <h3 className="section-title">3. Erfasste Positionen</h3>
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-3" data-testid="goods-receipt-items-list">
          <div className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-2 px-1">Liste</div>

          {(vm.receiptItemsQuery.data ?? []).map((item: any) => (
            <div
              key={item.id}
              className="p-3 border border-[var(--line)] rounded-[var(--radius-sm)] bg-[var(--bg)] hover:border-[var(--line-strong)] transition-colors min-w-0"
              data-testid={`goods-receipt-item-row-${item.id}`}
            >
              <div className="flex justify-between items-start mb-1 gap-2">
                <strong className="text-[var(--ink)] text-sm font-semibold truncate block break-words min-w-0 pr-2">
                  {item.product_number ? `${item.product_number} · ${item.product_name ?? ""}` : `#${item.product_id}`}
                </strong>
                <span className="text-xs font-mono bg-[var(--panel-soft)] px-1.5 py-0.5 rounded border border-[var(--line)] text-[var(--ink)] shrink-0">
                  {item.received_quantity}
                </span>
              </div>
              <div className="text-xs text-[var(--muted)] flex items-center gap-2 truncate">
                <span className="truncate">Menge: {item.received_quantity}</span>
                <span className="truncate">Ziel: {item.target_bin_code ?? `Bin #${item.target_bin_id}`}</span>
                {item.expected_open_quantity ? (
                  <span className="truncate">Soll offen: {item.expected_open_quantity}</span>
                ) : null}
                {item.variance_quantity ? <span className="truncate">Delta: {item.variance_quantity}</span> : null}
              </div>
              <div className="mt-1 text-xs text-[var(--muted)]">
                Zustand:{" "}
                {item.condition === "new" ? "Neuware" : item.condition === "defective" ? "Defekt" : "Reparaturbedarf"}
              </div>
              {item.serial_numbers && item.serial_numbers.length > 0 ? (
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-[var(--muted)]">Seriennummern: {item.serial_numbers.length}</span>
                  <button
                    type="button"
                    className="btn btn-ghost text-xs"
                    onClick={() =>
                      vm.selectedReceiptId && void vm.triggerSerialLabelDownload(vm.selectedReceiptId, item.id)
                    }
                    data-testid={`goods-receipt-item-print-labels-btn-${item.id}`}
                  >
                    Labels drucken
                  </button>
                </div>
              ) : (
                <div className="mt-2 flex items-center justify-end">
                  <button
                    type="button"
                    className="btn btn-ghost text-xs"
                    onClick={() =>
                      vm.selectedReceiptId && void vm.triggerItemLabelDownload(vm.selectedReceiptId, item.id)
                    }
                    data-testid={`goods-receipt-item-print-item-labels-btn-${item.id}`}
                  >
                    Artikel-Labels drucken
                  </button>
                </div>
              )}
            </div>
          ))}
          {!vm.receiptItemsQuery.isLoading && (vm.receiptItemsQuery.data?.length ?? 0) === 0 ? (
            <div className="text-center text-[var(--muted)] py-8 italic text-sm border border-dashed border-[var(--line)] rounded-[var(--radius-md)]">
              Noch keine Positionen erfasst.
            </div>
          ) : null}
        </div>
      </div>
    </ReceiptItemForm>
  );
}
