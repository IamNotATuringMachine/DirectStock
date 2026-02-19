import type { FormEvent } from "react";
import { Building2, MapPin, PhoneCall, Plus, Trash2, UserRound } from "lucide-react";

import type { Customer, CustomerContact, CustomerLocation } from "../../types";

type CustomersViewProps = {
  errorMessage: string | null;
  customerItems: Customer[];
  selectedCustomerId: number | null;
  selectedCustomerName: string | null;
  customerNumber: string;
  onCustomerNumberChange: (value: string) => void;
  customerCompanyName: string;
  onCustomerCompanyNameChange: (value: string) => void;
  onSelectCustomer: (customerId: number) => void;
  onCreateCustomer: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteCustomer: () => void;
  locationCode: string;
  onLocationCodeChange: (value: string) => void;
  locationName: string;
  onLocationNameChange: (value: string) => void;
  locationPhone: string;
  onLocationPhoneChange: (value: string) => void;
  locationStreet: string;
  onLocationStreetChange: (value: string) => void;
  locationHouseNumber: string;
  onLocationHouseNumberChange: (value: string) => void;
  locationPostalCode: string;
  onLocationPostalCodeChange: (value: string) => void;
  locationCity: string;
  onLocationCityChange: (value: string) => void;
  locations: CustomerLocation[];
  onCreateLocation: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteLocation: (locationId: number) => void;
  contactLocationId: string;
  onContactLocationIdChange: (value: string) => void;
  contactJobTitle: string;
  onContactJobTitleChange: (value: string) => void;
  contactSalutation: string;
  onContactSalutationChange: (value: string) => void;
  contactFirstName: string;
  onContactFirstNameChange: (value: string) => void;
  contactLastName: string;
  onContactLastNameChange: (value: string) => void;
  contactPhone: string;
  onContactPhoneChange: (value: string) => void;
  contactEmail: string;
  onContactEmailChange: (value: string) => void;
  contacts: CustomerContact[];
  onCreateContact: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteContact: (contactId: number) => void;
};

export function CustomersView({
  errorMessage,
  customerItems,
  selectedCustomerId,
  selectedCustomerName,
  customerNumber,
  onCustomerNumberChange,
  customerCompanyName,
  onCustomerCompanyNameChange,
  onSelectCustomer,
  onCreateCustomer,
  onDeleteCustomer,
  locationCode,
  onLocationCodeChange,
  locationName,
  onLocationNameChange,
  locationPhone,
  onLocationPhoneChange,
  locationStreet,
  onLocationStreetChange,
  locationHouseNumber,
  onLocationHouseNumberChange,
  locationPostalCode,
  onLocationPostalCodeChange,
  locationCity,
  onLocationCityChange,
  locations,
  onCreateLocation,
  onDeleteLocation,
  contactLocationId,
  onContactLocationIdChange,
  contactJobTitle,
  onContactJobTitleChange,
  contactSalutation,
  onContactSalutationChange,
  contactFirstName,
  onContactFirstNameChange,
  contactLastName,
  onContactLastNameChange,
  contactPhone,
  onContactPhoneChange,
  contactEmail,
  onContactEmailChange,
  contacts,
  onCreateContact,
  onDeleteContact,
}: CustomersViewProps) {
  const hasSelectedCustomer = selectedCustomerId !== null;

  return (
    <section className="page flex flex-col gap-6" data-testid="customers-page">
      <header className="flex flex-col gap-2">
        <h2 className="page-title">Kunden</h2>
        <p className="section-subtitle">Kundenstamm mit Standorten und Ansprechpartnern verwalten.</p>
        {errorMessage ? (
          <p className="text-sm text-red-600" data-testid="customers-page-error">
            {errorMessage}
          </p>
        ) : null}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <article className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] p-5 shadow-sm space-y-4">
          <h3 className="section-title flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Kunden
          </h3>
          <form className="space-y-2" onSubmit={onCreateCustomer}>
            <input
              className="input w-full"
              placeholder="Kundennummer (z. B. CUS-1000)"
              value={customerNumber}
              onChange={(event) => onCustomerNumberChange(event.target.value)}
            />
            <input
              className="input w-full"
              placeholder="Firmenname"
              value={customerCompanyName}
              onChange={(event) => onCustomerCompanyNameChange(event.target.value)}
            />
            <button className="btn btn-primary w-full justify-center" type="submit">
              <Plus className="w-4 h-4" />
              Kunde anlegen
            </button>
          </form>

          <div className="border border-[var(--line)] rounded-[var(--radius-sm)] divide-y divide-[var(--line)] max-h-[420px] overflow-auto">
            {customerItems.map((customer) => (
              <button
                key={customer.id}
                className={`w-full px-3 py-2 text-left hover:bg-[var(--panel-soft)] ${selectedCustomerId === customer.id ? "bg-[var(--panel-strong)]" : ""}`}
                onClick={() => onSelectCustomer(customer.id)}
              >
                <p className="font-medium text-sm">{customer.company_name}</p>
                <p className="text-xs text-[var(--muted)]">{customer.customer_number}</p>
              </button>
            ))}
          </div>

          {hasSelectedCustomer ? (
            <button
              className="btn w-full justify-center text-red-600 border-red-300 hover:bg-red-50"
              type="button"
              onClick={onDeleteCustomer}
            >
              <Trash2 className="w-4 h-4" />
              Kunde löschen
            </button>
          ) : null}
        </article>

        <article className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] p-5 shadow-sm space-y-4">
          <h3 className="section-title flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Standorte
          </h3>
          <p className="text-sm text-[var(--muted)]">
            {selectedCustomerName ? `Ausgewählter Kunde: ${selectedCustomerName}` : "Bitte zuerst einen Kunden auswählen."}
          </p>
          <form className="space-y-2" onSubmit={onCreateLocation}>
            <input
              className="input w-full"
              placeholder="Standortcode"
              value={locationCode}
              onChange={(event) => onLocationCodeChange(event.target.value)}
              disabled={!hasSelectedCustomer}
            />
            <input
              className="input w-full"
              placeholder="Standortname"
              value={locationName}
              onChange={(event) => onLocationNameChange(event.target.value)}
              disabled={!hasSelectedCustomer}
            />
            <input
              className="input w-full"
              placeholder="Telefon"
              value={locationPhone}
              onChange={(event) => onLocationPhoneChange(event.target.value)}
              disabled={!hasSelectedCustomer}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className="input w-full"
                placeholder="Straße"
                value={locationStreet}
                onChange={(event) => onLocationStreetChange(event.target.value)}
                disabled={!hasSelectedCustomer}
              />
              <input
                className="input w-full"
                placeholder="Hausnr."
                value={locationHouseNumber}
                onChange={(event) => onLocationHouseNumberChange(event.target.value)}
                disabled={!hasSelectedCustomer}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                className="input w-full"
                placeholder="PLZ"
                value={locationPostalCode}
                onChange={(event) => onLocationPostalCodeChange(event.target.value)}
                disabled={!hasSelectedCustomer}
              />
              <input
                className="input w-full"
                placeholder="Ort"
                value={locationCity}
                onChange={(event) => onLocationCityChange(event.target.value)}
                disabled={!hasSelectedCustomer}
              />
            </div>
            <button className="btn btn-primary w-full justify-center" type="submit" disabled={!hasSelectedCustomer}>
              <Plus className="w-4 h-4" />
              Standort anlegen
            </button>
          </form>

          <div className="border border-[var(--line)] rounded-[var(--radius-sm)] divide-y divide-[var(--line)] max-h-[360px] overflow-auto">
            {locations.map((location) => (
              <div key={location.id} className="px-3 py-2">
                <p className="font-medium text-sm">{location.name}</p>
                <p className="text-xs text-[var(--muted)]">{location.location_code}</p>
                <button type="button" className="text-xs mt-1 text-red-600" onClick={() => onDeleteLocation(location.id)}>
                  Standort löschen
                </button>
              </div>
            ))}
          </div>
        </article>

        <article className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] p-5 shadow-sm space-y-4">
          <h3 className="section-title flex items-center gap-2">
            <UserRound className="w-4 h-4" />
            Ansprechpartner
          </h3>
          <form className="space-y-2" onSubmit={onCreateContact}>
            <select
              className="input w-full"
              value={contactLocationId}
              onChange={(event) => onContactLocationIdChange(event.target.value)}
              disabled={!hasSelectedCustomer}
            >
              <option value="">Ohne Standort-Zuordnung</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.location_code} - {location.name}
                </option>
              ))}
            </select>
            <input
              className="input w-full"
              placeholder="Titel / Funktion (z. B. Kassenleitung)"
              value={contactJobTitle}
              onChange={(event) => onContactJobTitleChange(event.target.value)}
              disabled={!hasSelectedCustomer}
            />
            <input
              className="input w-full"
              placeholder="Anrede (z. B. Frau)"
              value={contactSalutation}
              onChange={(event) => onContactSalutationChange(event.target.value)}
              disabled={!hasSelectedCustomer}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className="input w-full"
                placeholder="Vorname"
                value={contactFirstName}
                onChange={(event) => onContactFirstNameChange(event.target.value)}
                disabled={!hasSelectedCustomer}
              />
              <input
                className="input w-full"
                placeholder="Nachname"
                value={contactLastName}
                onChange={(event) => onContactLastNameChange(event.target.value)}
                disabled={!hasSelectedCustomer}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                className="input w-full"
                placeholder="Telefon"
                value={contactPhone}
                onChange={(event) => onContactPhoneChange(event.target.value)}
                disabled={!hasSelectedCustomer}
              />
              <input
                className="input w-full"
                placeholder="E-Mail"
                value={contactEmail}
                onChange={(event) => onContactEmailChange(event.target.value)}
                disabled={!hasSelectedCustomer}
              />
            </div>
            <button className="btn btn-primary w-full justify-center" type="submit" disabled={!hasSelectedCustomer}>
              <PhoneCall className="w-4 h-4" />
              Ansprechpartner anlegen
            </button>
          </form>

          <div className="border border-[var(--line)] rounded-[var(--radius-sm)] divide-y divide-[var(--line)] max-h-[360px] overflow-auto">
            {contacts.map((contact) => (
              <div key={contact.id} className="px-3 py-2">
                <p className="font-medium text-sm">
                  {contact.salutation ? `${contact.salutation} ` : ""}
                  {contact.first_name} {contact.last_name}
                </p>
                <p className="text-xs text-[var(--muted)]">{contact.job_title || "Ohne Titel/Funktion"}</p>
                <button type="button" className="text-xs mt-1 text-red-600" onClick={() => onDeleteContact(contact.id)}>
                  Ansprechpartner löschen
                </button>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
