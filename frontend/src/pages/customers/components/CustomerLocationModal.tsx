import { type FormEvent, useEffect } from "react";
import { MapPin, Save, X } from "lucide-react";

export type CustomerLocationFormValues = {
  location_code: string;
  name: string;
  phone: string;
  email: string;
  street: string;
  house_number: string;
  address_line2: string;
  postal_code: string;
  city: string;
  country_code: string;
  is_primary: boolean;
  is_active: boolean;
};

type CustomerLocationModalProps = {
  isOpen: boolean;
  mode: "create" | "edit";
  values: CustomerLocationFormValues;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: <K extends keyof CustomerLocationFormValues>(field: K, value: CustomerLocationFormValues[K]) => void;
};

export function CustomerLocationModal({
  isOpen,
  mode,
  values,
  isSubmitting,
  onClose,
  onSubmit,
  onChange,
}: CustomerLocationModalProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const isCreate = mode === "create";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        className="bg-[var(--panel)] rounded-[var(--radius-lg)] shadow-2xl w-full max-w-2xl border border-[var(--line)] flex flex-col max-h-[90vh] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-location-title"
        aria-describedby="customer-location-description"
        data-testid={isCreate ? "location-create-modal" : "location-edit-modal"}
      >
        <header className="p-6 border-b border-[var(--line)] flex justify-between items-center bg-[var(--panel-soft)]/50">
          <div>
            <h3 id="customer-location-title" className="section-title flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              {isCreate ? "Neuer Standort" : "Standort bearbeiten"}
            </h3>
            <p id="customer-location-description" className="text-sm text-[var(--muted)]">
              {isCreate ? "Legen Sie einen neuen Markt/Standort an." : "Aktualisieren Sie die Stammdaten des Standorts."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--ink)] transition-colors p-1 rounded hover:bg-[var(--panel-soft)]"
            aria-label="Schließen"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-6 overflow-y-auto custom-scrollbar">
          <form id={`customer-location-form-${mode}`} className="space-y-4" onSubmit={onSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                className="input w-full"
                placeholder="Standortcode*"
                value={values.location_code}
                onChange={(event) => onChange("location_code", event.target.value)}
                required
                autoFocus
              />
              <input
                className="input w-full"
                placeholder="Standortname*"
                value={values.name}
                onChange={(event) => onChange("name", event.target.value)}
                required
              />
              <input
                className="input w-full"
                placeholder="Telefon"
                value={values.phone}
                onChange={(event) => onChange("phone", event.target.value)}
              />
              <input
                className="input w-full"
                placeholder="E-Mail"
                type="email"
                value={values.email}
                onChange={(event) => onChange("email", event.target.value)}
              />
              <input
                className="input w-full"
                placeholder="Straße"
                value={values.street}
                onChange={(event) => onChange("street", event.target.value)}
              />
              <input
                className="input w-full"
                placeholder="Hausnummer"
                value={values.house_number}
                onChange={(event) => onChange("house_number", event.target.value)}
              />
              <input
                className="input w-full"
                placeholder="Adresszusatz"
                value={values.address_line2}
                onChange={(event) => onChange("address_line2", event.target.value)}
              />
              <input
                className="input w-full"
                placeholder="PLZ"
                value={values.postal_code}
                onChange={(event) => onChange("postal_code", event.target.value)}
              />
              <input
                className="input w-full"
                placeholder="Ort"
                value={values.city}
                onChange={(event) => onChange("city", event.target.value)}
              />
              <input
                className="input w-full"
                placeholder="Landcode (z. B. DE)"
                value={values.country_code}
                maxLength={2}
                onChange={(event) => onChange("country_code", event.target.value.toUpperCase())}
              />
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-2 text-sm text-[var(--ink)]">
                <input
                  type="checkbox"
                  checked={values.is_primary}
                  onChange={(event) => onChange("is_primary", event.target.checked)}
                />
                Primärstandort
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-[var(--ink)]">
                <input
                  type="checkbox"
                  checked={values.is_active}
                  onChange={(event) => onChange("is_active", event.target.checked)}
                />
                Standort ist aktiv
              </label>
            </div>
          </form>
        </div>

        <footer className="p-6 border-t border-[var(--line)] bg-[var(--panel-soft)]/50 flex justify-end gap-3 rounded-b-[var(--radius-lg)]">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Abbrechen
          </button>
          <button
            type="submit"
            form={`customer-location-form-${mode}`}
            className="btn btn-primary"
            disabled={isSubmitting}
            data-testid={isCreate ? "location-create-submit" : "location-edit-submit"}
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? "Wird gespeichert..." : isCreate ? "Standort speichern" : "Änderungen speichern"}
          </button>
        </footer>
      </div>
    </div>
  );
}
