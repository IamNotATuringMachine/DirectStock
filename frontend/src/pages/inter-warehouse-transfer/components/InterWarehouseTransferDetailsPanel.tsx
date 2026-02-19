import type { FormEvent } from "react";

import ScanFeedback from "../../../components/scanner/ScanFeedback";
import WorkflowScanInput from "../../../components/scanner/WorkflowScanInput";
import type { BinLocation, InterWarehouseTransfer, InterWarehouseTransferItem, Product } from "../../../types";

export type InterWarehouseTransferDetailsPanelProps = {
  selectedTransfer: InterWarehouseTransfer | null;
  onDispatch: (transferId: number) => void;
  dispatchPending: boolean;
  onReceive: (transferId: number) => void;
  receivePending: boolean;
  onCancel: (transferId: number) => void;
  cancelPending: boolean;
  onScanSourceBin: (value: string) => void | Promise<void>;
  onScanProduct: (value: string) => void | Promise<void>;
  onScanTargetBin: (value: string) => void | Promise<void>;
  scanFeedbackStatus: "idle" | "success" | "error";
  scanFeedbackMessage: string | null;
  onAddItem: (event: FormEvent) => void;
  products: Product[];
  productId: string;
  onProductIdChange: (value: string) => void;
  sourceBins: BinLocation[];
  fromBinId: string;
  onFromBinIdChange: (value: string) => void;
  targetBins: BinLocation[];
  toBinId: string;
  onToBinIdChange: (value: string) => void;
  requestedQuantity: string;
  onRequestedQuantityChange: (value: string) => void;
  unit: string;
  onUnitChange: (value: string) => void;
  serialNumbersText: string;
  onSerialNumbersTextChange: (value: string) => void;
  createItemPending: boolean;
  transferItems: InterWarehouseTransferItem[];
  transferItemsLoading: boolean;
};

export function InterWarehouseTransferDetailsPanel({
  selectedTransfer,
  onDispatch,
  dispatchPending,
  onReceive,
  receivePending,
  onCancel,
  cancelPending,
  onScanSourceBin,
  onScanProduct,
  onScanTargetBin,
  scanFeedbackStatus,
  scanFeedbackMessage,
  onAddItem,
  products,
  productId,
  onProductIdChange,
  sourceBins,
  fromBinId,
  onFromBinIdChange,
  targetBins,
  toBinId,
  onToBinIdChange,
  requestedQuantity,
  onRequestedQuantityChange,
  unit,
  onUnitChange,
  serialNumbersText,
  onSerialNumbersTextChange,
  createItemPending,
  transferItems,
  transferItemsLoading,
}: InterWarehouseTransferDetailsPanelProps) {
  if (!selectedTransfer) {
    return (
      <div className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm p-12 text-center">
        <p className="text-[var(--muted)]">Bitte wählen Sie einen Transfer aus der Liste aus.</p>
      </div>
    );
  }

  const draftMode = selectedTransfer.status === "draft";

  return (
    <>
      <div className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-medium text-[var(--ink)] flex items-center gap-2">{selectedTransfer.transfer_number}</h2>
          <p className="text-sm text-[var(--muted)] mt-1">
            Status: <strong className="uppercase" data-testid="iwt-selected-status">{selectedTransfer.status}</strong>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onDispatch(selectedTransfer.id)}
            disabled={dispatchPending || selectedTransfer.status !== "draft"}
            className="btn btn-primary"
            data-testid="iwt-dispatch-btn"
          >
            Dispatch
          </button>
          <button
            onClick={() => onReceive(selectedTransfer.id)}
            disabled={receivePending || selectedTransfer.status !== "dispatched"}
            className="btn btn-primary bg-emerald-600 hover:bg-emerald-700 border-emerald-600"
            data-testid="iwt-receive-btn"
          >
            Receive
          </button>
          <button
            onClick={() => onCancel(selectedTransfer.id)}
            disabled={cancelPending || selectedTransfer.status !== "draft"}
            className="btn btn-secondary text-[var(--destructive)] hover:bg-red-50"
            data-testid="iwt-cancel-btn"
          >
            Cancel
          </button>
        </div>
      </div>

      <section
        className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm p-6"
        data-testid="iwt-scan-workflow"
      >
        <div className="mb-4">
          <h3 className="text-lg font-medium text-[var(--ink)]">2. Scan-Workflow & Positionen</h3>
          <p className="text-sm text-[var(--muted)]">Produkt und Bin-Locations per Scanner erfassen.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <WorkflowScanInput
            enabled={draftMode}
            isLoading={false}
            label="Quell-Bin"
            placeholder="Scan QR"
            onScan={onScanSourceBin}
            testIdPrefix="iwt-scan-source-bin"
          />
          <WorkflowScanInput
            enabled={draftMode}
            isLoading={false}
            label="Produkt"
            placeholder="Scan EAN/QR"
            onScan={onScanProduct}
            testIdPrefix="iwt-scan-product"
          />
          <WorkflowScanInput
            enabled={draftMode}
            isLoading={false}
            label="Ziel-Bin"
            placeholder="Scan QR"
            onScan={onScanTargetBin}
            testIdPrefix="iwt-scan-target-bin"
          />
        </div>

        <div className="mb-6">
          <ScanFeedback status={scanFeedbackStatus} message={scanFeedbackMessage} />
        </div>

        <form
          onSubmit={onAddItem}
          className="bg-[var(--panel-soft)] rounded-[var(--radius-md)] p-4 mb-6 border border-[var(--line)]"
          data-testid="iwt-add-item-form"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-medium text-[var(--muted)]">Produkt</label>
              <select
                className="input w-full"
                value={productId}
                onChange={(event) => onProductIdChange(event.target.value)}
                data-testid="iwt-product-select"
                disabled={!draftMode}
              >
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.product_number} - {product.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--muted)]">Quell-Bin</label>
              <select
                className="input w-full"
                value={fromBinId}
                onChange={(event) => onFromBinIdChange(event.target.value)}
                data-testid="iwt-from-bin-select"
                disabled={!draftMode}
              >
                {sourceBins.map((bin) => (
                  <option key={bin.id} value={bin.id}>
                    {bin.code}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--muted)]">Ziel-Bin</label>
              <select
                className="input w-full"
                value={toBinId}
                onChange={(event) => onToBinIdChange(event.target.value)}
                data-testid="iwt-to-bin-select"
                disabled={!draftMode}
              >
                {targetBins.map((bin) => (
                  <option key={bin.id} value={bin.id}>
                    {bin.code}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--muted)]">Menge</label>
              <input
                type="number"
                min="0.001"
                step="0.001"
                className="input w-full"
                value={requestedQuantity}
                onChange={(event) => onRequestedQuantityChange(event.target.value)}
                data-testid="iwt-qty-input"
                disabled={!draftMode}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--muted)]">Einheit</label>
              <input
                type="text"
                className="input w-full"
                value={unit}
                onChange={(event) => onUnitChange(event.target.value)}
                data-testid="iwt-unit-input"
                disabled={!draftMode}
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-medium text-[var(--muted)]">Serials (Komma/Zeilen)</label>
              <textarea
                rows={1}
                className="input w-full min-h-[42px] py-2"
                value={serialNumbersText}
                onChange={(event) => onSerialNumbersTextChange(event.target.value)}
                data-testid="iwt-serials-input"
                disabled={!draftMode}
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={createItemPending || !draftMode || !productId || !fromBinId || !toBinId}
              className="btn btn-primary"
              data-testid="iwt-add-item-btn"
            >
              Position hinzufügen
            </button>
          </div>
        </form>

        <div className="overflow-x-auto border border-[var(--line)] rounded-[var(--radius-sm)]">
          <table className="w-full text-sm text-left" data-testid="iwt-items-table">
            <thead className="bg-[var(--panel-soft)] text-[var(--muted)] uppercase text-xs font-semibold">
              <tr>
                <th className="px-4 py-3">Produkt</th>
                <th className="px-3 py-3">Von</th>
                <th className="px-3 py-3">Nach</th>
                <th className="px-3 py-3">Req</th>
                <th className="px-3 py-3">Disp</th>
                <th className="px-3 py-3">Recv</th>
                <th className="px-3 py-3">Einh.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)] bg-[var(--bg)]">
              {transferItems.map((item) => (
                <tr key={item.id} className="hover:bg-[var(--panel-soft)] transition-colors">
                  <td className="px-4 py-3 font-medium text-[var(--ink)] whitespace-nowrap">{item.product_id}</td>
                  <td className="px-3 py-3 text-[var(--muted)] whitespace-nowrap">{item.from_bin_id}</td>
                  <td className="px-3 py-3 text-[var(--muted)] whitespace-nowrap">{item.to_bin_id}</td>
                  <td className="px-3 py-3 text-[var(--muted)] whitespace-nowrap">{item.requested_quantity}</td>
                  <td className="px-3 py-3 text-[var(--muted)] whitespace-nowrap">{item.dispatched_quantity}</td>
                  <td className="px-3 py-3 text-[var(--muted)] whitespace-nowrap">{item.received_quantity}</td>
                  <td className="px-3 py-3 text-[var(--muted)] whitespace-nowrap">{item.unit}</td>
                </tr>
              ))}

              {!transferItemsLoading && transferItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-[var(--muted)] italic">
                    Keine Positionen vorhanden.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
