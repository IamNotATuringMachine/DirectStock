import type { FormEvent } from "react";

import type { ShipmentCarrier } from "../../../services/shippingApi";
import type { Customer, CustomerLocation } from "../../../types";
import type { DhlExpressFormState } from "../model";

export type ShippingCreatePanelProps = {
  carrier: ShipmentCarrier;
  onCarrierChange: (carrier: ShipmentCarrier) => void;
  customerId: string;
  onCustomerChange: (value: string) => void;
  customerLocationId: string;
  onCustomerLocationChange: (value: string) => void;
  customers: Customer[];
  customerLocations: CustomerLocation[];
  recipientName: string;
  onRecipientNameChange: (value: string) => void;
  shippingAddress: string;
  onShippingAddressChange: (value: string) => void;
  dhlExpress: DhlExpressFormState;
  onDhlExpressChange: (field: keyof DhlExpressFormState, value: string) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  onCreateShipment: (event: FormEvent) => void;
  createPending: boolean;
};

export function ShippingCreatePanel({
  carrier,
  onCarrierChange,
  customerId,
  onCustomerChange,
  customerLocationId,
  onCustomerLocationChange,
  customers,
  customerLocations,
  recipientName,
  onRecipientNameChange,
  shippingAddress,
  onShippingAddressChange,
  dhlExpress,
  onDhlExpressChange,
  notes,
  onNotesChange,
  onCreateShipment,
  createPending,
}: ShippingCreatePanelProps) {
  return (
    <div className="lg:col-span-4 bg-[var(--panel)] rounded-[var(--radius-lg)] border border-[var(--line)] p-6 shadow-sm">
      <h3 className="section-title mb-4">Sendung anlegen</h3>

      <form className="space-y-4" onSubmit={onCreateShipment} data-testid="shipping-create-form">
        <div className="space-y-2">
          <label className="form-label-standard">Versanddienstleister</label>
          <select
            className="input w-full"
            value={carrier}
            onChange={(event) => onCarrierChange(event.target.value as ShipmentCarrier)}
            data-testid="shipping-carrier-select"
          >
            <option value="dhl">DHL</option>
            <option value="dhl_express">DHL Express</option>
            <option value="dpd">DPD</option>
            <option value="ups">UPS</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="form-label-standard">Kunde (optional)</label>
          <select className="input w-full" value={customerId} onChange={(event) => onCustomerChange(event.target.value)}>
            <option value="">Kein Kunde</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.customer_number} - {customer.company_name}
              </option>
            ))}
          </select>
        </div>

        {customerId ? (
          <div className="space-y-2">
            <label className="form-label-standard">Standort (optional)</label>
            <select
              className="input w-full"
              value={customerLocationId}
              onChange={(event) => onCustomerLocationChange(event.target.value)}
            >
              <option value="">Kein Standort</option>
              {customerLocations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.location_code} - {location.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {carrier !== "dhl_express" ? (
          <>
            <div className="space-y-2">
              <label className="form-label-standard">Empfänger</label>
              <input
                className="input w-full"
                value={recipientName}
                onChange={(event) => onRecipientNameChange(event.target.value)}
                placeholder="Max Mustermann"
                data-testid="shipping-recipient-input"
              />
            </div>

            <div className="space-y-2">
              <label className="form-label-standard">Lieferadresse</label>
              <textarea
                className="input w-full min-h-[80px] py-2 resize-y"
                value={shippingAddress}
                onChange={(event) => onShippingAddressChange(event.target.value)}
                placeholder="Musterstraße 1, 12345 Musterstadt"
                data-testid="shipping-address-input"
              />
            </div>
          </>
        ) : (
          <div className="space-y-3 rounded-[var(--radius-sm)] border border-[var(--line)] p-3">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">DHL Express Daten</p>

            <div className="space-y-2">
              <label className="form-label-standard">Firma</label>
              <input
                className="input w-full"
                value={dhlExpress.recipient_company_name}
                onChange={(event) => onDhlExpressChange("recipient_company_name", event.target.value)}
                placeholder="Muster GmbH"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-2">
                <label className="form-label-standard">Kontaktname</label>
                <input
                  className="input w-full"
                  value={dhlExpress.recipient_contact_name}
                  onChange={(event) => onDhlExpressChange("recipient_contact_name", event.target.value)}
                  placeholder="Max Mustermann"
                />
              </div>
              <div className="space-y-2">
                <label className="form-label-standard">Telefon</label>
                <input
                  className="input w-full"
                  value={dhlExpress.recipient_phone}
                  onChange={(event) => onDhlExpressChange("recipient_phone", event.target.value)}
                  placeholder="+49..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="form-label-standard">E-Mail (optional)</label>
              <input
                className="input w-full"
                value={dhlExpress.recipient_email}
                onChange={(event) => onDhlExpressChange("recipient_email", event.target.value)}
                placeholder="logistik@example.com"
              />
            </div>

            <div className="space-y-2">
              <label className="form-label-standard">Adresszeile 1</label>
              <input
                className="input w-full"
                value={dhlExpress.recipient_address_line1}
                onChange={(event) => onDhlExpressChange("recipient_address_line1", event.target.value)}
                placeholder="Musterstrasse 1"
              />
            </div>

            <div className="space-y-2">
              <label className="form-label-standard">Adresszeile 2 (optional)</label>
              <input
                className="input w-full"
                value={dhlExpress.recipient_address_line2}
                onChange={(event) => onDhlExpressChange("recipient_address_line2", event.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="space-y-2">
                <label className="form-label-standard">PLZ</label>
                <input
                  className="input w-full"
                  value={dhlExpress.recipient_postal_code}
                  onChange={(event) => onDhlExpressChange("recipient_postal_code", event.target.value)}
                  placeholder="56068"
                />
              </div>
              <div className="space-y-2">
                <label className="form-label-standard">Stadt</label>
                <input
                  className="input w-full"
                  value={dhlExpress.recipient_city}
                  onChange={(event) => onDhlExpressChange("recipient_city", event.target.value)}
                  placeholder="Koblenz"
                />
              </div>
              <div className="space-y-2">
                <label className="form-label-standard">Land (ISO2)</label>
                <input
                  className="input w-full uppercase"
                  value={dhlExpress.recipient_country_code}
                  onChange={(event) => onDhlExpressChange("recipient_country_code", event.target.value)}
                  placeholder="DE"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-2">
                <label className="form-label-standard">Bundesland/State (optional)</label>
                <input
                  className="input w-full"
                  value={dhlExpress.recipient_state_code}
                  onChange={(event) => onDhlExpressChange("recipient_state_code", event.target.value)}
                  placeholder="RP"
                />
              </div>
              <div className="space-y-2">
                <label className="form-label-standard">Gewicht (kg)</label>
                <input
                  className="input w-full"
                  value={dhlExpress.package_weight_kg}
                  onChange={(event) => onDhlExpressChange("package_weight_kg", event.target.value)}
                  placeholder="1.0"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="space-y-2">
                <label className="form-label-standard">Laenge (cm, optional)</label>
                <input
                  className="input w-full"
                  value={dhlExpress.package_length_cm}
                  onChange={(event) => onDhlExpressChange("package_length_cm", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="form-label-standard">Breite (cm, optional)</label>
                <input
                  className="input w-full"
                  value={dhlExpress.package_width_cm}
                  onChange={(event) => onDhlExpressChange("package_width_cm", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="form-label-standard">Hoehe (cm, optional)</label>
                <input
                  className="input w-full"
                  value={dhlExpress.package_height_cm}
                  onChange={(event) => onDhlExpressChange("package_height_cm", event.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="form-label-standard">Notiz</label>
          <input
            className="input w-full"
            value={notes}
            onChange={(event) => onNotesChange(event.target.value)}
            placeholder="Inhalt, Referenz, etc."
            data-testid="shipping-notes-input"
          />
        </div>

        <button
          type="submit"
          disabled={createPending}
          className="btn btn-primary w-full justify-center mt-2"
          data-testid="shipping-create-btn"
        >
          {createPending ? "Wird angelegt..." : "Sendung anlegen"}
        </button>
      </form>
    </div>
  );
}
