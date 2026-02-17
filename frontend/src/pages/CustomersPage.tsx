import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, MapPin, PhoneCall, Plus, Trash2, UserRound } from "lucide-react";
import { AxiosError } from "axios";

import {
  createCustomer,
  createCustomerContact,
  createCustomerLocation,
  deleteCustomer,
  deleteCustomerContact,
  deleteCustomerLocation,
  fetchCustomerContacts,
  fetchCustomerLocations,
  fetchCustomers,
} from "../services/customersApi";

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [customerNumber, setCustomerNumber] = useState("");
  const [customerCompanyName, setCustomerCompanyName] = useState("");

  const [locationCode, setLocationCode] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationPhone, setLocationPhone] = useState("");
  const [locationStreet, setLocationStreet] = useState("");
  const [locationHouseNumber, setLocationHouseNumber] = useState("");
  const [locationPostalCode, setLocationPostalCode] = useState("");
  const [locationCity, setLocationCity] = useState("");

  const [contactLocationId, setContactLocationId] = useState<string>("");
  const [contactJobTitle, setContactJobTitle] = useState("");
  const [contactSalutation, setContactSalutation] = useState("");
  const [contactFirstName, setContactFirstName] = useState("");
  const [contactLastName, setContactLastName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  const customersQuery = useQuery({
    queryKey: ["customers", "master-data-page"],
    queryFn: () => fetchCustomers({ page: 1, pageSize: 200 }),
  });

  const locationsQuery = useQuery({
    queryKey: ["customer-locations", selectedCustomerId],
    queryFn: () => fetchCustomerLocations(selectedCustomerId as number),
    enabled: selectedCustomerId !== null,
  });

  const contactsQuery = useQuery({
    queryKey: ["customer-contacts", selectedCustomerId],
    queryFn: () => fetchCustomerContacts(selectedCustomerId as number),
    enabled: selectedCustomerId !== null,
  });

  const customerItems = customersQuery.data?.items ?? [];

  useEffect(() => {
    if (selectedCustomerId === null) {
      return;
    }
    const selectedCustomerStillExists = customerItems.some((item) => item.id === selectedCustomerId);
    if (!selectedCustomerStillExists) {
      setSelectedCustomerId(null);
      setContactLocationId("");
    }
  }, [customerItems, selectedCustomerId]);

  const toErrorMessage = (error: unknown): string => {
    if (error instanceof AxiosError) {
      const detail = error.response?.data?.detail;
      if (typeof detail === "string" && detail.trim().length > 0) {
        return detail;
      }
    }
    return "Vorgang konnte nicht ausgeführt werden. Bitte erneut versuchen.";
  };

  const createCustomerMutation = useMutation({
    mutationFn: createCustomer,
    onMutate: () => setErrorMessage(null),
    onSuccess: async (customer) => {
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      setSelectedCustomerId(customer.id);
      setCustomerNumber("");
      setCustomerCompanyName("");
    },
    onError: (error) => {
      setErrorMessage(toErrorMessage(error));
    },
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: deleteCustomer,
    onMutate: () => setErrorMessage(null),
    onSuccess: async (_, customerId) => {
      setSelectedCustomerId((current) => (current === customerId ? null : current));
      setContactLocationId("");
      queryClient.removeQueries({ queryKey: ["customer-locations", customerId] });
      queryClient.removeQueries({ queryKey: ["customer-contacts", customerId] });
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (error) => {
      setErrorMessage(toErrorMessage(error));
    },
  });

  const createLocationMutation = useMutation({
    mutationFn: ({ customerId }: { customerId: number }) =>
      createCustomerLocation(customerId, {
        location_code: locationCode.trim(),
        name: locationName.trim(),
        phone: locationPhone.trim() || undefined,
        street: locationStreet.trim() || undefined,
        house_number: locationHouseNumber.trim() || undefined,
        postal_code: locationPostalCode.trim() || undefined,
        city: locationCity.trim() || undefined,
      }),
    onMutate: () => setErrorMessage(null),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["customer-locations", variables.customerId] });
      setLocationCode("");
      setLocationName("");
      setLocationPhone("");
      setLocationStreet("");
      setLocationHouseNumber("");
      setLocationPostalCode("");
      setLocationCity("");
    },
    onError: (error) => {
      setErrorMessage(toErrorMessage(error));
    },
  });

  const deleteLocationMutation = useMutation({
    mutationFn: ({ customerId, locationId }: { customerId: number; locationId: number }) =>
      deleteCustomerLocation(customerId, locationId),
    onMutate: () => setErrorMessage(null),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["customer-locations", variables.customerId] }),
        queryClient.invalidateQueries({ queryKey: ["customer-contacts", variables.customerId] }),
      ]);
    },
    onError: (error) => {
      setErrorMessage(toErrorMessage(error));
    },
  });

  const createContactMutation = useMutation({
    mutationFn: ({ customerId }: { customerId: number }) =>
      createCustomerContact(customerId, {
        customer_location_id: contactLocationId ? Number(contactLocationId) : null,
        job_title: contactJobTitle.trim() || undefined,
        salutation: contactSalutation.trim() || undefined,
        first_name: contactFirstName.trim(),
        last_name: contactLastName.trim(),
        phone: contactPhone.trim() || undefined,
        email: contactEmail.trim() || undefined,
      }),
    onMutate: () => setErrorMessage(null),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["customer-contacts", variables.customerId] });
      setContactLocationId("");
      setContactJobTitle("");
      setContactSalutation("");
      setContactFirstName("");
      setContactLastName("");
      setContactPhone("");
      setContactEmail("");
    },
    onError: (error) => {
      setErrorMessage(toErrorMessage(error));
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: ({ customerId, contactId }: { customerId: number; contactId: number }) =>
      deleteCustomerContact(customerId, contactId),
    onMutate: () => setErrorMessage(null),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["customer-contacts", variables.customerId] });
    },
    onError: (error) => {
      setErrorMessage(toErrorMessage(error));
    },
  });

  const selectedCustomer = useMemo(
    () => customerItems.find((item) => item.id === selectedCustomerId) ?? null,
    [customerItems, selectedCustomerId]
  );

  const onCreateCustomer = async (event: FormEvent) => {
    event.preventDefault();
    if (!customerNumber.trim() || !customerCompanyName.trim()) {
      return;
    }
    await createCustomerMutation.mutateAsync({
      customer_number: customerNumber.trim(),
      company_name: customerCompanyName.trim(),
      is_active: true,
    });
  };

  const onCreateLocation = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedCustomerId || !locationCode.trim() || !locationName.trim()) {
      return;
    }
    await createLocationMutation.mutateAsync({ customerId: selectedCustomerId });
  };

  const onCreateContact = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedCustomerId || !contactFirstName.trim() || !contactLastName.trim()) {
      return;
    }
    await createContactMutation.mutateAsync({ customerId: selectedCustomerId });
  };

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
          <form className="space-y-2" onSubmit={(event) => void onCreateCustomer(event)}>
            <input
              className="input w-full"
              placeholder="Kundennummer (z. B. CUS-1000)"
              value={customerNumber}
              onChange={(event) => setCustomerNumber(event.target.value)}
            />
            <input
              className="input w-full"
              placeholder="Firmenname"
              value={customerCompanyName}
              onChange={(event) => setCustomerCompanyName(event.target.value)}
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
                onClick={() => setSelectedCustomerId(customer.id)}
              >
                <p className="font-medium text-sm">{customer.company_name}</p>
                <p className="text-xs text-[var(--muted)]">{customer.customer_number}</p>
              </button>
            ))}
          </div>

          {selectedCustomerId ? (
            <button
              className="btn w-full justify-center text-red-600 border-red-300 hover:bg-red-50"
              type="button"
              onClick={() => void deleteCustomerMutation.mutateAsync(selectedCustomerId)}
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
            {selectedCustomer ? `Ausgewählter Kunde: ${selectedCustomer.company_name}` : "Bitte zuerst einen Kunden auswählen."}
          </p>
          <form className="space-y-2" onSubmit={(event) => void onCreateLocation(event)}>
            <input
              className="input w-full"
              placeholder="Standortcode"
              value={locationCode}
              onChange={(event) => setLocationCode(event.target.value)}
              disabled={!selectedCustomerId}
            />
            <input
              className="input w-full"
              placeholder="Standortname"
              value={locationName}
              onChange={(event) => setLocationName(event.target.value)}
              disabled={!selectedCustomerId}
            />
            <input
              className="input w-full"
              placeholder="Telefon"
              value={locationPhone}
              onChange={(event) => setLocationPhone(event.target.value)}
              disabled={!selectedCustomerId}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className="input w-full"
                placeholder="Straße"
                value={locationStreet}
                onChange={(event) => setLocationStreet(event.target.value)}
                disabled={!selectedCustomerId}
              />
              <input
                className="input w-full"
                placeholder="Hausnr."
                value={locationHouseNumber}
                onChange={(event) => setLocationHouseNumber(event.target.value)}
                disabled={!selectedCustomerId}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                className="input w-full"
                placeholder="PLZ"
                value={locationPostalCode}
                onChange={(event) => setLocationPostalCode(event.target.value)}
                disabled={!selectedCustomerId}
              />
              <input
                className="input w-full"
                placeholder="Ort"
                value={locationCity}
                onChange={(event) => setLocationCity(event.target.value)}
                disabled={!selectedCustomerId}
              />
            </div>
            <button className="btn btn-primary w-full justify-center" type="submit" disabled={!selectedCustomerId}>
              <Plus className="w-4 h-4" />
              Standort anlegen
            </button>
          </form>

          <div className="border border-[var(--line)] rounded-[var(--radius-sm)] divide-y divide-[var(--line)] max-h-[360px] overflow-auto">
            {(locationsQuery.data ?? []).map((location) => (
              <div key={location.id} className="px-3 py-2">
                <p className="font-medium text-sm">{location.name}</p>
                <p className="text-xs text-[var(--muted)]">{location.location_code}</p>
                <button
                  type="button"
                  className="text-xs mt-1 text-red-600"
                  onClick={() =>
                    selectedCustomerId
                      ? void deleteLocationMutation.mutateAsync({ customerId: selectedCustomerId, locationId: location.id })
                      : undefined
                  }
                >
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
          <form className="space-y-2" onSubmit={(event) => void onCreateContact(event)}>
            <select
              className="input w-full"
              value={contactLocationId}
              onChange={(event) => setContactLocationId(event.target.value)}
              disabled={!selectedCustomerId}
            >
              <option value="">Ohne Standort-Zuordnung</option>
              {(locationsQuery.data ?? []).map((location) => (
                <option key={location.id} value={location.id}>
                  {location.location_code} - {location.name}
                </option>
              ))}
            </select>
            <input
              className="input w-full"
              placeholder="Titel / Funktion (z. B. Kassenleitung)"
              value={contactJobTitle}
              onChange={(event) => setContactJobTitle(event.target.value)}
              disabled={!selectedCustomerId}
            />
            <input
              className="input w-full"
              placeholder="Anrede (z. B. Frau)"
              value={contactSalutation}
              onChange={(event) => setContactSalutation(event.target.value)}
              disabled={!selectedCustomerId}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className="input w-full"
                placeholder="Vorname"
                value={contactFirstName}
                onChange={(event) => setContactFirstName(event.target.value)}
                disabled={!selectedCustomerId}
              />
              <input
                className="input w-full"
                placeholder="Nachname"
                value={contactLastName}
                onChange={(event) => setContactLastName(event.target.value)}
                disabled={!selectedCustomerId}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                className="input w-full"
                placeholder="Telefon"
                value={contactPhone}
                onChange={(event) => setContactPhone(event.target.value)}
                disabled={!selectedCustomerId}
              />
              <input
                className="input w-full"
                placeholder="E-Mail"
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
                disabled={!selectedCustomerId}
              />
            </div>
            <button className="btn btn-primary w-full justify-center" type="submit" disabled={!selectedCustomerId}>
              <PhoneCall className="w-4 h-4" />
              Ansprechpartner anlegen
            </button>
          </form>

          <div className="border border-[var(--line)] rounded-[var(--radius-sm)] divide-y divide-[var(--line)] max-h-[360px] overflow-auto">
            {(contactsQuery.data ?? []).map((contact) => (
              <div key={contact.id} className="px-3 py-2">
                <p className="font-medium text-sm">
                  {contact.salutation ? `${contact.salutation} ` : ""}
                  {contact.first_name} {contact.last_name}
                </p>
                <p className="text-xs text-[var(--muted)]">{contact.job_title || "Ohne Titel/Funktion"}</p>
                <button
                  type="button"
                  className="text-xs mt-1 text-red-600"
                  onClick={() =>
                    selectedCustomerId
                      ? void deleteContactMutation.mutateAsync({ customerId: selectedCustomerId, contactId: contact.id })
                      : undefined
                  }
                >
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
