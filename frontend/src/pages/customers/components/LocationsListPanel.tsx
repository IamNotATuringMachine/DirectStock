import { MapPin, Plus, Trash2 } from "lucide-react";

import type { CustomerLocation } from "../../../types";

type LocationsListPanelProps = {
  hasSelectedCustomer: boolean;
  selectedCustomerName: string | null;
  locations: CustomerLocation[];
  selectedLocationId: number | null;
  onSelectLocation: (locationId: number) => void;
  onOpenCreateModal: () => void;
  onDeleteLocation: (locationId: number) => void;
};

export function LocationsListPanel({
  hasSelectedCustomer,
  selectedCustomerName,
  locations,
  selectedLocationId,
  onSelectLocation,
  onOpenCreateModal,
  onDeleteLocation,
}: LocationsListPanelProps) {
  return (
    <article className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] p-5 shadow-sm space-y-4">
      <header className="flex items-center justify-between gap-3">
        <h3 className="section-title flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          Standorte
        </h3>
        <button
          className="btn btn-primary"
          type="button"
          onClick={onOpenCreateModal}
          disabled={!hasSelectedCustomer}
          data-testid="locations-open-create-modal"
        >
          <Plus className="w-4 h-4" />
          Neuer Standort
        </button>
      </header>

      <p className="text-sm text-[var(--muted)]">
        {selectedCustomerName ? `Ausgewählter Kunde: ${selectedCustomerName}` : "Bitte zuerst einen Kunden auswählen."}
      </p>

      <div className="border border-[var(--line)] rounded-[var(--radius-sm)] divide-y divide-[var(--line)] max-h-[420px] overflow-auto">
        {!hasSelectedCustomer ? (
          <p className="px-3 py-6 text-sm text-[var(--muted)]">Kunde auswählen, um Standorte zu sehen.</p>
        ) : locations.length === 0 ? (
          <p className="px-3 py-6 text-sm text-[var(--muted)]">Noch keine Standorte für diesen Kunden vorhanden.</p>
        ) : (
          locations.map((location) => (
            <div
              key={location.id}
              className={`px-3 py-2 ${selectedLocationId === location.id ? "bg-[var(--panel-strong)]" : ""}`}
              data-testid={`customer-location-item-${location.id}`}
            >
              <button
                type="button"
                className="w-full text-left hover:bg-[var(--panel-soft)] rounded"
                onClick={() => onSelectLocation(location.id)}
              >
                <p className="font-medium text-sm">{location.name}</p>
                <p className="text-xs text-[var(--muted)]">{location.location_code}</p>
              </button>
              <button
                type="button"
                className="text-xs mt-1 text-red-600 inline-flex items-center gap-1"
                onClick={() => onDeleteLocation(location.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Standort löschen
              </button>
            </div>
          ))
        )}
      </div>
    </article>
  );
}
