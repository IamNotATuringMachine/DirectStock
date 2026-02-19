import type { FormEvent } from "react";
import { Building2, Plus, Trash2 } from "lucide-react";

import type { WarehouseZone, WarehouseZoneType } from "../../../types";
import { zoneTypeLabels, zoneTypes } from "../model";

export type WarehouseZonesPanelProps = {
  canWrite: boolean;
  selectedWarehouseId: number | null;
  zones: WarehouseZone[];
  selectedZoneId: number | null;
  onSelectZone: (zoneId: number) => void;
  isCreatingZone: boolean;
  onToggleCreateZone: () => void;
  onCancelCreateZone: () => void;
  zoneCode: string;
  onZoneCodeChange: (value: string) => void;
  zoneName: string;
  onZoneNameChange: (value: string) => void;
  zoneType: WarehouseZoneType;
  onZoneTypeChange: (value: WarehouseZoneType) => void;
  onCreateZone: (event: FormEvent) => void;
  createZonePending: boolean;
  onDeleteSelectedZone: () => void;
  deleteZonePending: boolean;
};

export function WarehouseZonesPanel({
  canWrite,
  selectedWarehouseId,
  zones,
  selectedZoneId,
  onSelectZone,
  isCreatingZone,
  onToggleCreateZone,
  onCancelCreateZone,
  zoneCode,
  onZoneCodeChange,
  zoneName,
  onZoneNameChange,
  zoneType,
  onZoneTypeChange,
  onCreateZone,
  createZonePending,
  onDeleteSelectedZone,
  deleteZonePending,
}: WarehouseZonesPanelProps) {
  return (
    <section className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm overflow-hidden flex flex-col h-[calc(100vh-12rem)] min-h-[500px]">
      <div className="p-4 border-b border-[var(--line)] bg-[var(--panel-soft)] flex items-center justify-between sticky top-0 z-10">
        <h3 className="section-title">Zonen</h3>
        {canWrite && selectedWarehouseId ? (
          <div className="flex items-center gap-1">
            {selectedZoneId ? (
              <button
                onClick={onDeleteSelectedZone}
                disabled={deleteZonePending}
                className="text-sm p-1.5 text-[var(--muted)] hover:text-rose-600 dark:hover:text-rose-300 hover:bg-[var(--panel-strong)] rounded-md transition-colors disabled:opacity-60"
                title="Ausgewählte Zone löschen"
                data-testid="warehouse-zone-delete-selected"
              >
                {deleteZonePending ? (
                  <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            ) : null}
            <button
              onClick={onToggleCreateZone}
              className="text-sm p-1.5 text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--panel-strong)] rounded-md transition-colors"
              title="Neue Zone"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-[var(--panel)]">
        {!selectedWarehouseId ? (
          <div className="h-full flex flex-col items-center justify-center text-[var(--muted)] p-4 text-center">
            <Building2 className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-sm">Wähle ein Lager aus, um Zonen zu sehen.</p>
          </div>
        ) : (
          <>
            {isCreatingZone ? (
              <form
                onSubmit={onCreateZone}
                className="p-3 bg-[var(--bg)] rounded-lg border border-[var(--line)] space-y-3 mb-4 animate-in fade-in slide-in-from-top-2"
              >
                <div className="space-y-2">
                  <input
                    className="input w-full px-3 py-2 text-sm border rounded-md bg-[var(--panel)] text-[var(--ink)] border-[var(--line)]"
                    placeholder="Zone-Code (z.B. Z-01)"
                    value={zoneCode}
                    onChange={(event) => onZoneCodeChange(event.target.value)}
                    required
                    autoFocus
                  />
                  <input
                    className="input w-full px-3 py-2 text-sm border rounded-md bg-[var(--panel)] text-[var(--ink)] border-[var(--line)]"
                    placeholder="Name"
                    value={zoneName}
                    onChange={(event) => onZoneNameChange(event.target.value)}
                    required
                  />
                  <select
                    className="input w-full px-3 py-2 text-sm border rounded-md bg-[var(--panel)] text-[var(--ink)] border-[var(--line)]"
                    value={zoneType}
                    onChange={(event) => onZoneTypeChange(event.target.value as WarehouseZoneType)}
                  >
                    {zoneTypes.map((type) => (
                      <option key={type} value={type}>
                        {zoneTypeLabels[type]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={onCancelCreateZone}
                    className="px-3 py-1.5 text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)]"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    disabled={createZonePending}
                    className="px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Anlegen
                  </button>
                </div>
              </form>
            ) : null}

            {zones.map((zone) => (
              <button
                key={zone.id}
                onClick={() => onSelectZone(zone.id)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  selectedZoneId === zone.id
                    ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800 ring-1 ring-emerald-200 dark:ring-emerald-800"
                    : "bg-[var(--panel)] border-[var(--line)] hover:border-[var(--line-strong)] hover:bg-[var(--panel-soft)]"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`font-semibold text-sm ${
                      selectedZoneId === zone.id ? "text-emerald-700 dark:text-emerald-300" : "text-[var(--ink)]"
                    }`}
                  >
                    {zone.code}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wide ${
                      selectedZoneId === zone.id
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : "bg-[var(--bg)] text-[var(--muted)] border border-[var(--line)]"
                    }`}
                  >
                    {zoneTypeLabels[zone.zone_type]}
                  </span>
                </div>
                <div
                  className={`text-sm truncate ${
                    selectedZoneId === zone.id ? "text-emerald-600/80 dark:text-emerald-300/80" : "text-[var(--muted)]"
                  }`}
                >
                  {zone.name}
                </div>
              </button>
            ))}

            {zones.length === 0 && !isCreatingZone ? (
              <div className="text-center py-8 text-[var(--muted)] text-sm">Keine Zonen vorhanden</div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
