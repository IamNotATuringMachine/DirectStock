import { type FormEvent, useEffect } from "react";
import { Building2, Save, X } from "lucide-react";

export type CustomerCreateFormValues = {
  customer_number: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  billing_address: string;
  shipping_address: string;
  payment_terms: string;
  delivery_terms: string;
  credit_limit: string;
  is_active: boolean;
};

type CustomerCreateModalProps = {
  isOpen: boolean;
  values: CustomerCreateFormValues;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: <K extends keyof CustomerCreateFormValues>(field: K, value: CustomerCreateFormValues[K]) => void;
};

export function CustomerCreateModal({
  isOpen,
  values,
  isSubmitting,
  onClose,
  onSubmit,
  onChange,
}: CustomerCreateModalProps) {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        className="bg-[var(--panel)] rounded-[var(--radius-lg)] shadow-2xl w-full max-w-2xl border border-[var(--line)] flex flex-col max-h-[90vh] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-create-title"
        aria-describedby="customer-create-description"
        data-testid="customer-create-modal"
      >
        <header className="p-6 border-b border-[var(--line)] flex justify-between items-center bg-[var(--panel-soft)]/50">
          <div>
            <h3 id="customer-create-title" className="section-title flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Neuer Kunde
            </h3>
            <p id="customer-create-description" className="text-sm text-[var(--muted)]">
              Erstellen Sie einen Kunden mit erweiterten Stammdaten.
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
          <form id="customer-create-form" className="space-y-4" onSubmit={onSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                className="input w-full"
                placeholder="Kundennummer*"
                value={values.customer_number}
                onChange={(event) => onChange("customer_number", event.target.value)}
                required
                autoFocus
              />
              <input
                className="input w-full"
                placeholder="Firmenname*"
                value={values.company_name}
                onChange={(event) => onChange("company_name", event.target.value)}
                required
              />
              <input
                className="input w-full"
                placeholder="Kontaktname"
                value={values.contact_name}
                onChange={(event) => onChange("contact_name", event.target.value)}
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
                placeholder="Telefon"
                value={values.phone}
                onChange={(event) => onChange("phone", event.target.value)}
              />
              <input
                className="input w-full"
                placeholder="Kreditlimit"
                value={values.credit_limit}
                onChange={(event) => onChange("credit_limit", event.target.value)}
              />
              <input
                className="input w-full"
                placeholder="Zahlungsbedingungen"
                value={values.payment_terms}
                onChange={(event) => onChange("payment_terms", event.target.value)}
              />
              <input
                className="input w-full"
                placeholder="Lieferbedingungen"
                value={values.delivery_terms}
                onChange={(event) => onChange("delivery_terms", event.target.value)}
              />
            </div>

            <textarea
              className="input w-full min-h-[84px]"
              placeholder="Rechnungsadresse"
              value={values.billing_address}
              onChange={(event) => onChange("billing_address", event.target.value)}
            />
            <textarea
              className="input w-full min-h-[84px]"
              placeholder="Lieferadresse"
              value={values.shipping_address}
              onChange={(event) => onChange("shipping_address", event.target.value)}
            />

            <label className="inline-flex items-center gap-2 text-sm text-[var(--ink)]">
              <input
                type="checkbox"
                checked={values.is_active}
                onChange={(event) => onChange("is_active", event.target.checked)}
              />
              Kunde ist aktiv
            </label>
          </form>
        </div>

        <footer className="p-6 border-t border-[var(--line)] bg-[var(--panel-soft)]/50 flex justify-end gap-3 rounded-b-[var(--radius-lg)]">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Abbrechen
          </button>
          <button
            type="submit"
            form="customer-create-form"
            className="btn btn-primary"
            disabled={isSubmitting}
            data-testid="customer-create-submit"
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? "Wird gespeichert..." : "Kunde speichern"}
          </button>
        </footer>
      </div>
    </div>
  );
}
