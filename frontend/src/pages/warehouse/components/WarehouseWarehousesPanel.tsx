import type { FormEvent } from "react";
import { Plus } from "lucide-react";

import type { Warehouse } from "../../../types";

export type WarehouseWarehousesPanelProps = {
  canWrite: boolean;
  warehouses: Warehouse[];
  selectedWarehouseId: number | null;
  onSelectWarehouse: (warehouseId: number) => void;
  isCreatingWarehouse: boolean;
  onToggleCreateWarehouse: () => void;
  onCancelCreateWarehouse: () => void;
  warehouseCode: string;
  onWarehouseCodeChange: (value: string) => void;
  warehouseName: string;
  onWarehouseNameChange: (value: string) => void;
  warehouseAddress: string;
  onWarehouseAddressChange: (value: string) => void;
  onCreateWarehouse: (event: FormEvent) => void;
  createWarehousePending: boolean;
};

export function WarehouseWarehousesPanel({
  canWrite,
  warehouses,
  selectedWarehouseId,
  onSelectWarehouse,
  isCreatingWarehouse,
  onToggleCreateWarehouse,
  onCancelCreateWarehouse,
  warehouseCode,
  onWarehouseCodeChange,
  warehouseName,
  onWarehouseNameChange,
  warehouseAddress,
  onWarehouseAddressChange,
  onCreateWarehouse,
  createWarehousePending,
}: WarehouseWarehousesPanelProps) {
  return (
    <section className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm overflow-hidden flex flex-col h-[calc(100vh-12rem)] min-h-[500px]">
      <div className="p-4 border-b border-[var(--line)] bg-[var(--panel-soft)] flex items-center justify-between sticky top-0 z-10">
        <h3 className="section-title">Lager</h3>
        {canWrite ? (
          <button
            onClick={onToggleCreateWarehouse}
            className="text-sm p-1.5 text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--panel-strong)] rounded-md transition-colors"
            title="Neues Lager"
          >
            <Plus className="w-4 h-4" />
          </button>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-[var(--panel)]">
        {isCreatingWarehouse ? (
          <form
            onSubmit={onCreateWarehouse}
            className="p-3 bg-[var(--bg)] rounded-lg border border-[var(--line)] space-y-3 mb-4 animate-in fade-in slide-in-from-top-2"
          >
            <div className="space-y-2">
              <input
                className="input w-full px-3 py-2 text-sm border rounded-md bg-[var(--panel)] text-[var(--ink)] border-[var(--line)]"
                placeholder="Code (z.B. WH-MAIN)"
                value={warehouseCode}
                onChange={(event) => onWarehouseCodeChange(event.target.value)}
                required
                autoFocus
              />
              <input
                className="input w-full px-3 py-2 text-sm border rounded-md bg-[var(--panel)] text-[var(--ink)] border-[var(--line)]"
                placeholder="Name"
                value={warehouseName}
                onChange={(event) => onWarehouseNameChange(event.target.value)}
                required
              />
              <input
                className="input w-full px-3 py-2 text-sm border rounded-md bg-[var(--panel)] text-[var(--ink)] border-[var(--line)]"
                placeholder="Adresse"
                value={warehouseAddress}
                onChange={(event) => onWarehouseAddressChange(event.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancelCreateWarehouse}
                className="px-3 py-1.5 text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)]"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={createWarehousePending}
                className="px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
              >
                Anlegen
              </button>
            </div>
          </form>
        ) : null}

        {warehouses.map((warehouse) => (
          <button
            key={warehouse.id}
            onClick={() => onSelectWarehouse(warehouse.id)}
            className={`w-full text-left p-3 rounded-lg border transition-all ${
              selectedWarehouseId === warehouse.id
                ? "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 ring-1 ring-blue-200 dark:ring-blue-800"
                : "bg-[var(--panel)] border-[var(--line)] hover:border-[var(--line-strong)] hover:bg-[var(--panel-soft)]"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span
                className={`font-semibold text-sm ${
                  selectedWarehouseId === warehouse.id ? "text-blue-700 dark:text-blue-300" : "text-[var(--ink)]"
                }`}
              >
                {warehouse.code}
              </span>
              {selectedWarehouseId === warehouse.id ? <div className="w-2 h-2 rounded-full bg-blue-500" /> : null}
            </div>
            <div
              className={`text-sm truncate ${
                selectedWarehouseId === warehouse.id
                  ? "text-blue-600/80 dark:text-blue-300/80"
                  : "text-[var(--muted)]"
              }`}
            >
              {warehouse.name}
            </div>
          </button>
        ))}

        {warehouses.length === 0 ? (
          <div className="text-center py-8 text-[var(--muted)] text-sm">Keine Lager vorhanden</div>
        ) : null}
      </div>
    </section>
  );
}
