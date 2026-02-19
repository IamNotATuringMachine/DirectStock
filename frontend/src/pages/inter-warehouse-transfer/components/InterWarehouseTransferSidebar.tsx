import type { FormEvent } from "react";

import type { InterWarehouseTransfer, Warehouse } from "../../../types";

export type InterWarehouseTransferSidebarProps = {
  fromWarehouseId: string;
  onFromWarehouseIdChange: (value: string) => void;
  toWarehouseId: string;
  onToWarehouseIdChange: (value: string) => void;
  transferNotes: string;
  onTransferNotesChange: (value: string) => void;
  onCreateTransfer: (event: FormEvent) => void;
  createTransferPending: boolean;
  warehouses: Warehouse[];
  transfers: InterWarehouseTransfer[];
  selectedTransferId: number | null;
  onSelectTransfer: (transferId: number) => void;
  warehouseById: Map<number, Warehouse>;
};

export function InterWarehouseTransferSidebar({
  fromWarehouseId,
  onFromWarehouseIdChange,
  toWarehouseId,
  onToWarehouseIdChange,
  transferNotes,
  onTransferNotesChange,
  onCreateTransfer,
  createTransferPending,
  warehouses,
  transfers,
  selectedTransferId,
  onSelectTransfer,
  warehouseById,
}: InterWarehouseTransferSidebarProps) {
  return (
    <div className="flex flex-col gap-6 lg:col-span-1">
      <div className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm p-6">
        <h3 className="section-title mb-4">1. Transfer anlegen</h3>
        <form onSubmit={onCreateTransfer} className="space-y-4">
          <div className="space-y-2">
            <label className="form-label-standard">Von Lager</label>
            <select
              className="input w-full"
              value={fromWarehouseId}
              onChange={(event) => onFromWarehouseIdChange(event.target.value)}
              data-testid="iwt-from-warehouse-select"
            >
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.code} - {warehouse.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="form-label-standard">Nach Lager</label>
            <select
              className="input w-full"
              value={toWarehouseId}
              onChange={(event) => onToWarehouseIdChange(event.target.value)}
              data-testid="iwt-to-warehouse-select"
            >
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.code} - {warehouse.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="form-label-standard">Notiz</label>
            <input
              type="text"
              className="input w-full"
              value={transferNotes}
              onChange={(event) => onTransferNotesChange(event.target.value)}
              data-testid="iwt-notes-input"
              placeholder="Referenz oder Grund"
            />
          </div>

          <button
            type="submit"
            disabled={createTransferPending || !fromWarehouseId || !toWarehouseId || fromWarehouseId === toWarehouseId}
            className="btn btn-primary w-full justify-center"
            data-testid="iwt-create-btn"
          >
            {createTransferPending ? "Wird angelegt..." : "Transfer anlegen"}
          </button>
        </form>
      </div>

      <div className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm overflow-hidden flex flex-col h-[600px]">
        <div className="p-4 border-b border-[var(--line)] bg-[var(--panel-soft)]">
          <h3 className="section-title">Offene Transfers</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {transfers.map((transfer) => {
            const isSelected = selectedTransferId === transfer.id;
            return (
              <button
                key={transfer.id}
                onClick={() => onSelectTransfer(transfer.id)}
                className={`w-full text-left p-3 rounded-[var(--radius-md)] border transition-colors ${
                  isSelected
                    ? "bg-[var(--panel-strong)] border-[var(--accent)]"
                    : "bg-[var(--bg)] border-[var(--line)] hover:bg-[var(--panel-soft)]"
                }`}
                data-testid={`iwt-item-${transfer.id}`}
              >
                <div className="flex justify-between items-start mb-1 gap-2">
                  <span className="font-medium text-[var(--ink)] text-sm truncate block min-w-0">
                    {transfer.transfer_number}
                  </span>
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${
                      transfer.status === "dispatched"
                        ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                        : transfer.status === "received"
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                          : transfer.status === "cancelled"
                            ? "bg-red-500/10 text-red-600 border-red-500/20"
                            : "bg-[var(--panel-soft)] text-[var(--muted)] border-[var(--line)]"
                    }`}
                  >
                    {transfer.status}
                  </span>
                </div>
                <div className="text-xs text-[var(--muted)] flex items-center justify-between gap-2 overflow-hidden">
                  <span className="truncate min-w-0">
                    {warehouseById.get(transfer.from_warehouse_id)?.code ?? transfer.from_warehouse_id}
                    <span className="mx-1">→</span>
                    {warehouseById.get(transfer.to_warehouse_id)?.code ?? transfer.to_warehouse_id}
                  </span>
                </div>
              </button>
            );
          })}

          {transfers.length === 0 ? (
            <div className="p-8 text-center text-sm text-[var(--muted)] italic">Keine Transfers gefunden.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
