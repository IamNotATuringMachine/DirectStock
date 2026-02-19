import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { CustomersView } from "./customers/CustomersView";

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

  const onCreateCustomer = async (event: FormEvent<HTMLFormElement>) => {
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

  const onCreateLocation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCustomerId || !locationCode.trim() || !locationName.trim()) {
      return;
    }
    await createLocationMutation.mutateAsync({ customerId: selectedCustomerId });
  };

  const onCreateContact = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCustomerId || !contactFirstName.trim() || !contactLastName.trim()) {
      return;
    }
    await createContactMutation.mutateAsync({ customerId: selectedCustomerId });
  };

  return (
    <CustomersView
      errorMessage={errorMessage}
      customerItems={customerItems}
      selectedCustomerId={selectedCustomerId}
      selectedCustomerName={selectedCustomer?.company_name ?? null}
      customerNumber={customerNumber}
      onCustomerNumberChange={setCustomerNumber}
      customerCompanyName={customerCompanyName}
      onCustomerCompanyNameChange={setCustomerCompanyName}
      onSelectCustomer={setSelectedCustomerId}
      onCreateCustomer={(event) => void onCreateCustomer(event)}
      onDeleteCustomer={() => {
        if (!selectedCustomerId) {
          return;
        }
        void deleteCustomerMutation.mutateAsync(selectedCustomerId);
      }}
      locationCode={locationCode}
      onLocationCodeChange={setLocationCode}
      locationName={locationName}
      onLocationNameChange={setLocationName}
      locationPhone={locationPhone}
      onLocationPhoneChange={setLocationPhone}
      locationStreet={locationStreet}
      onLocationStreetChange={setLocationStreet}
      locationHouseNumber={locationHouseNumber}
      onLocationHouseNumberChange={setLocationHouseNumber}
      locationPostalCode={locationPostalCode}
      onLocationPostalCodeChange={setLocationPostalCode}
      locationCity={locationCity}
      onLocationCityChange={setLocationCity}
      locations={locationsQuery.data ?? []}
      onCreateLocation={(event) => void onCreateLocation(event)}
      onDeleteLocation={(locationId) => {
        if (!selectedCustomerId) {
          return;
        }
        void deleteLocationMutation.mutateAsync({ customerId: selectedCustomerId, locationId });
      }}
      contactLocationId={contactLocationId}
      onContactLocationIdChange={setContactLocationId}
      contactJobTitle={contactJobTitle}
      onContactJobTitleChange={setContactJobTitle}
      contactSalutation={contactSalutation}
      onContactSalutationChange={setContactSalutation}
      contactFirstName={contactFirstName}
      onContactFirstNameChange={setContactFirstName}
      contactLastName={contactLastName}
      onContactLastNameChange={setContactLastName}
      contactPhone={contactPhone}
      onContactPhoneChange={setContactPhone}
      contactEmail={contactEmail}
      onContactEmailChange={setContactEmail}
      contacts={contactsQuery.data ?? []}
      onCreateContact={(event) => void onCreateContact(event)}
      onDeleteContact={(contactId) => {
        if (!selectedCustomerId) {
          return;
        }
        void deleteContactMutation.mutateAsync({ customerId: selectedCustomerId, contactId });
      }}
    />
  );
}
