import type { FormEvent } from "react";
import { PhoneCall, UserRound } from "lucide-react";

import type { CustomerContact } from "../../../types";

type ContactsPanelProps = {
  hasSelectedLocation: boolean;
  selectedLocationName: string | null;
  contacts: CustomerContact[];
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
  onCreateContact: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteContact: (contactId: number) => void;
};

export function ContactsPanel({
  hasSelectedLocation,
  selectedLocationName,
  contacts,
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
  onCreateContact,
  onDeleteContact,
}: ContactsPanelProps) {
  return (
    <article className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] p-5 shadow-sm space-y-4">
      <h3 className="section-title flex items-center gap-2">
        <UserRound className="w-4 h-4" />
        Ansprechpartner
      </h3>

      <p className="text-sm text-[var(--muted)]">
        {hasSelectedLocation
          ? `Gefiltert auf Standort: ${selectedLocationName ?? "Ausgewählter Standort"}`
          : "Bitte Standort auswählen, um Ansprechpartner zu sehen oder anzulegen."}
      </p>

      <form className="space-y-2" onSubmit={onCreateContact}>
        <input
          className="input w-full"
          placeholder="Titel / Funktion (z. B. Kassenleitung)"
          value={contactJobTitle}
          onChange={(event) => onContactJobTitleChange(event.target.value)}
          disabled={!hasSelectedLocation}
        />
        <input
          className="input w-full"
          placeholder="Anrede (z. B. Frau)"
          value={contactSalutation}
          onChange={(event) => onContactSalutationChange(event.target.value)}
          disabled={!hasSelectedLocation}
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            className="input w-full"
            placeholder="Vorname"
            value={contactFirstName}
            onChange={(event) => onContactFirstNameChange(event.target.value)}
            disabled={!hasSelectedLocation}
          />
          <input
            className="input w-full"
            placeholder="Nachname"
            value={contactLastName}
            onChange={(event) => onContactLastNameChange(event.target.value)}
            disabled={!hasSelectedLocation}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            className="input w-full"
            placeholder="Telefon"
            value={contactPhone}
            onChange={(event) => onContactPhoneChange(event.target.value)}
            disabled={!hasSelectedLocation}
          />
          <input
            className="input w-full"
            placeholder="E-Mail"
            value={contactEmail}
            onChange={(event) => onContactEmailChange(event.target.value)}
            disabled={!hasSelectedLocation}
          />
        </div>
        <button className="btn btn-primary w-full justify-center" type="submit" disabled={!hasSelectedLocation}>
          <PhoneCall className="w-4 h-4" />
          Ansprechpartner anlegen
        </button>
      </form>

      <div className="border border-[var(--line)] rounded-[var(--radius-sm)] divide-y divide-[var(--line)] max-h-[320px] overflow-auto">
        {!hasSelectedLocation ? (
          <p className="px-3 py-6 text-sm text-[var(--muted)]">Keine Anzeige ohne Standortauswahl.</p>
        ) : contacts.length === 0 ? (
          <p className="px-3 py-6 text-sm text-[var(--muted)]">Keine Ansprechpartner für diesen Standort vorhanden.</p>
        ) : (
          contacts.map((contact) => (
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
          ))
        )}
      </div>
    </article>
  );
}
