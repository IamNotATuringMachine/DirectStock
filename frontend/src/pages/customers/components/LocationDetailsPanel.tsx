import { FilePenLine, MapPinned } from "lucide-react";

import type { CustomerLocation } from "../../../types";

type LocationDetailsPanelProps = {
  hasSelectedCustomer: boolean;
  selectedLocation: CustomerLocation | null;
  onOpenEditModal: () => void;
};

function renderValue(value: string | null): string {
  return value && value.trim().length > 0 ? value : "-";
}

export function LocationDetailsPanel({ hasSelectedCustomer, selectedLocation, onOpenEditModal }: LocationDetailsPanelProps) {
  return (
    <article className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] p-5 shadow-sm space-y-4">
      <header className="flex items-center justify-between gap-3">
        <h3 className="section-title flex items-center gap-2">
          <MapPinned className="w-4 h-4" />
          Standortdaten
        </h3>
        <button
          type="button"
          className="btn"
          onClick={onOpenEditModal}
          disabled={!selectedLocation}
          data-testid="location-edit-open"
        >
          <FilePenLine className="w-4 h-4" />
          Standort bearbeiten
        </button>
      </header>

      {!hasSelectedCustomer ? (
        <p className="text-sm text-[var(--muted)]">Bitte zuerst einen Kunden auswählen.</p>
      ) : !selectedLocation ? (
        <p className="text-sm text-[var(--muted)]">Bitte einen Standort/Markt auswählen, um Details zu sehen.</p>
      ) : (
        <div className="space-y-4" data-testid="customer-location-details">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">Standortcode</dt>
              <dd className="text-sm font-medium">{selectedLocation.location_code}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">Name</dt>
              <dd className="text-sm font-medium">{selectedLocation.name}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">Telefon</dt>
              <dd className="text-sm">{renderValue(selectedLocation.phone)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">E-Mail</dt>
              <dd className="text-sm">{renderValue(selectedLocation.email)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">Straße</dt>
              <dd className="text-sm">{renderValue(selectedLocation.street)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">Hausnummer</dt>
              <dd className="text-sm">{renderValue(selectedLocation.house_number)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">PLZ</dt>
              <dd className="text-sm">{renderValue(selectedLocation.postal_code)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">Ort</dt>
              <dd className="text-sm">{renderValue(selectedLocation.city)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">Land</dt>
              <dd className="text-sm">{selectedLocation.country_code}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">Status</dt>
              <dd className="text-sm flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs ${
                    selectedLocation.is_active ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-700"
                  }`}
                >
                  {selectedLocation.is_active ? "Aktiv" : "Inaktiv"}
                </span>
                {selectedLocation.is_primary ? (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">Primär</span>
                ) : null}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </article>
  );
}
