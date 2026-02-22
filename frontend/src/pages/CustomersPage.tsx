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
  updateCustomerLocation,
} from "../services/customersApi";
import type { CustomerLocation } from "../types";
import { CustomersView } from "./customers/CustomersView";
import type { CustomerCreateFormValues } from "./customers/components/CustomerCreateModal";
import type { CustomerLocationFormValues } from "./customers/components/CustomerLocationModal";

const EMPTY_CUSTOMER_FORM: CustomerCreateFormValues = {
  customer_number: "",
  company_name: "",
  contact_name: "",
  email: "",
  phone: "",
  billing_address: "",
  shipping_address: "",
  payment_terms: "",
  delivery_terms: "",
  credit_limit: "",
  is_active: true,
};

const EMPTY_LOCATION_FORM: CustomerLocationFormValues = {
  location_code: "",
  name: "",
  phone: "",
  email: "",
  street: "",
  house_number: "",
  address_line2: "",
  postal_code: "",
  city: "",
  country_code: "DE",
  is_primary: false,
  is_active: true,
};

function toLocationFormValues(location: CustomerLocation): CustomerLocationFormValues {
  return {
    location_code: location.location_code,
    name: location.name,
    phone: location.phone ?? "",
    email: location.email ?? "",
    street: location.street ?? "",
    house_number: location.house_number ?? "",
    address_line2: location.address_line2 ?? "",
    postal_code: location.postal_code ?? "",
    city: location.city ?? "",
    country_code: location.country_code,
    is_primary: location.is_primary,
    is_active: location.is_active,
  };
}

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isCustomerCreateModalOpen, setIsCustomerCreateModalOpen] = useState(false);
  const [isLocationCreateModalOpen, setIsLocationCreateModalOpen] = useState(false);
  const [isLocationEditModalOpen, setIsLocationEditModalOpen] = useState(false);

  const [customerForm, setCustomerForm] = useState<CustomerCreateFormValues>(EMPTY_CUSTOMER_FORM);
  const [locationCreateForm, setLocationCreateForm] = useState<CustomerLocationFormValues>(EMPTY_LOCATION_FORM);
  const [locationEditForm, setLocationEditForm] = useState<CustomerLocationFormValues>(EMPTY_LOCATION_FORM);

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
    queryKey: ["customer-contacts", selectedCustomerId, selectedLocationId],
    queryFn: () =>
      fetchCustomerContacts(selectedCustomerId as number, {
        locationId: selectedLocationId as number,
      }),
    enabled: selectedCustomerId !== null && selectedLocationId !== null,
  });

  const customerItems = customersQuery.data?.items ?? [];
  const locations = locationsQuery.data ?? [];

  useEffect(() => {
    if (selectedCustomerId === null) {
      return;
    }
    const selectedCustomerStillExists = customerItems.some((item) => item.id === selectedCustomerId);
    if (!selectedCustomerStillExists) {
      setSelectedCustomerId(null);
      setSelectedLocationId(null);
    }
  }, [customerItems, selectedCustomerId]);

  useEffect(() => {
    setSelectedLocationId(null);
  }, [selectedCustomerId]);

  useEffect(() => {
    if (selectedCustomerId === null) {
      return;
    }

    if (locationsQuery.isFetching) {
      return;
    }

    if (locations.length === 0) {
      if (selectedLocationId !== null) {
        setSelectedLocationId(null);
      }
      return;
    }

    if (selectedLocationId !== null && locations.some((location) => location.id === selectedLocationId)) {
      return;
    }

    setSelectedLocationId(locations[0].id);
  }, [locations, locationsQuery.isFetching, selectedCustomerId, selectedLocationId]);

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
      setSelectedLocationId(null);
      setCustomerForm(EMPTY_CUSTOMER_FORM);
      setIsCustomerCreateModalOpen(false);
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
      setSelectedLocationId(null);
      queryClient.removeQueries({ queryKey: ["customer-locations", customerId] });
      queryClient.removeQueries({ queryKey: ["customer-contacts", customerId] });
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (error) => {
      setErrorMessage(toErrorMessage(error));
    },
  });

  const createLocationMutation = useMutation({
    mutationFn: ({ customerId, payload }: { customerId: number; payload: Parameters<typeof createCustomerLocation>[1] }) =>
      createCustomerLocation(customerId, payload),
    onMutate: () => setErrorMessage(null),
    onSuccess: async (location, variables) => {
      setSelectedLocationId(location.id);
      setLocationCreateForm(EMPTY_LOCATION_FORM);
      setIsLocationCreateModalOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["customer-locations", variables.customerId] }),
        queryClient.invalidateQueries({ queryKey: ["customer-contacts", variables.customerId] }),
      ]);
    },
    onError: (error) => {
      setErrorMessage(toErrorMessage(error));
    },
  });

  const updateLocationMutation = useMutation({
    mutationFn: ({
      customerId,
      locationId,
      payload,
    }: {
      customerId: number;
      locationId: number;
      payload: Parameters<typeof updateCustomerLocation>[2];
    }) => updateCustomerLocation(customerId, locationId, payload),
    onMutate: () => setErrorMessage(null),
    onSuccess: async (location, variables) => {
      setSelectedLocationId(location.id);
      setIsLocationEditModalOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["customer-locations", variables.customerId] }),
        queryClient.invalidateQueries({ queryKey: ["customer-contacts", variables.customerId] }),
      ]);
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
      setSelectedLocationId((current) => (current === variables.locationId ? null : current));
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
    mutationFn: ({ customerId, locationId }: { customerId: number; locationId: number }) =>
      createCustomerContact(customerId, {
        customer_location_id: locationId,
        job_title: contactJobTitle.trim() || undefined,
        salutation: contactSalutation.trim() || undefined,
        first_name: contactFirstName.trim(),
        last_name: contactLastName.trim(),
        phone: contactPhone.trim() || undefined,
        email: contactEmail.trim() || undefined,
      }),
    onMutate: () => setErrorMessage(null),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ["customer-contacts", variables.customerId, variables.locationId],
      });
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
    onSuccess: async () => {
      if (selectedCustomerId === null || selectedLocationId === null) {
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: ["customer-contacts", selectedCustomerId, selectedLocationId],
      });
    },
    onError: (error) => {
      setErrorMessage(toErrorMessage(error));
    },
  });

  const selectedCustomer = useMemo(
    () => customerItems.find((item) => item.id === selectedCustomerId) ?? null,
    [customerItems, selectedCustomerId]
  );

  const selectedLocation = useMemo(
    () => locations.find((item) => item.id === selectedLocationId) ?? null,
    [locations, selectedLocationId]
  );

  const contactItems = selectedLocationId === null ? [] : contactsQuery.data ?? [];

  const onCustomerFormChange = <K extends keyof CustomerCreateFormValues>(
    field: K,
    value: CustomerCreateFormValues[K]
  ) => {
    setCustomerForm((current) => ({ ...current, [field]: value }));
  };

  const onLocationCreateFormChange = <K extends keyof CustomerLocationFormValues>(
    field: K,
    value: CustomerLocationFormValues[K]
  ) => {
    setLocationCreateForm((current) => ({ ...current, [field]: value }));
  };

  const onLocationEditFormChange = <K extends keyof CustomerLocationFormValues>(
    field: K,
    value: CustomerLocationFormValues[K]
  ) => {
    setLocationEditForm((current) => ({ ...current, [field]: value }));
  };

  const onCreateCustomer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!customerForm.customer_number.trim() || !customerForm.company_name.trim()) {
      return;
    }

    await createCustomerMutation.mutateAsync({
      customer_number: customerForm.customer_number.trim(),
      company_name: customerForm.company_name.trim(),
      contact_name: customerForm.contact_name.trim() || undefined,
      email: customerForm.email.trim() || undefined,
      phone: customerForm.phone.trim() || undefined,
      billing_address: customerForm.billing_address.trim() || undefined,
      shipping_address: customerForm.shipping_address.trim() || undefined,
      payment_terms: customerForm.payment_terms.trim() || undefined,
      delivery_terms: customerForm.delivery_terms.trim() || undefined,
      credit_limit: customerForm.credit_limit.trim() || undefined,
      is_active: customerForm.is_active,
    });
  };

  const buildLocationPayload = (form: CustomerLocationFormValues) => ({
    location_code: form.location_code.trim(),
    name: form.name.trim(),
    phone: form.phone.trim() || undefined,
    email: form.email.trim() || undefined,
    street: form.street.trim() || undefined,
    house_number: form.house_number.trim() || undefined,
    address_line2: form.address_line2.trim() || undefined,
    postal_code: form.postal_code.trim() || undefined,
    city: form.city.trim() || undefined,
    country_code: form.country_code.trim().toUpperCase() || "DE",
    is_primary: form.is_primary,
    is_active: form.is_active,
  });

  const onCreateLocation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCustomerId || !locationCreateForm.location_code.trim() || !locationCreateForm.name.trim()) {
      return;
    }

    await createLocationMutation.mutateAsync({
      customerId: selectedCustomerId,
      payload: buildLocationPayload(locationCreateForm),
    });
  };

  const onUpdateLocation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCustomerId || !selectedLocationId || !locationEditForm.location_code.trim() || !locationEditForm.name.trim()) {
      return;
    }

    await updateLocationMutation.mutateAsync({
      customerId: selectedCustomerId,
      locationId: selectedLocationId,
      payload: buildLocationPayload(locationEditForm),
    });
  };

  const onCreateContact = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCustomerId || !selectedLocationId || !contactFirstName.trim() || !contactLastName.trim()) {
      return;
    }

    await createContactMutation.mutateAsync({
      customerId: selectedCustomerId,
      locationId: selectedLocationId,
    });
  };

  return (
    <CustomersView
      errorMessage={errorMessage}
      customerItems={customerItems}
      selectedCustomerId={selectedCustomerId}
      selectedCustomerName={selectedCustomer?.company_name ?? null}
      selectedLocationId={selectedLocationId}
      selectedLocation={selectedLocation}
      locations={locations}
      contacts={contactItems}
      isCustomerCreateModalOpen={isCustomerCreateModalOpen}
      isLocationCreateModalOpen={isLocationCreateModalOpen}
      isLocationEditModalOpen={isLocationEditModalOpen}
      isCreatingCustomer={createCustomerMutation.isPending}
      isCreatingLocation={createLocationMutation.isPending}
      isUpdatingLocation={updateLocationMutation.isPending}
      customerForm={customerForm}
      locationCreateForm={locationCreateForm}
      locationEditForm={locationEditForm}
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
      onSelectCustomer={setSelectedCustomerId}
      onSelectLocation={setSelectedLocationId}
      onDeleteCustomer={() => {
        if (!selectedCustomerId) {
          return;
        }
        void deleteCustomerMutation.mutateAsync(selectedCustomerId);
      }}
      onDeleteLocation={(locationId) => {
        if (!selectedCustomerId) {
          return;
        }
        void deleteLocationMutation.mutateAsync({ customerId: selectedCustomerId, locationId });
      }}
      onDeleteContact={(contactId) => {
        if (!selectedCustomerId) {
          return;
        }
        void deleteContactMutation.mutateAsync({ customerId: selectedCustomerId, contactId });
      }}
      onOpenCustomerCreateModal={() => {
        setCustomerForm(EMPTY_CUSTOMER_FORM);
        setIsCustomerCreateModalOpen(true);
      }}
      onCloseCustomerCreateModal={() => {
        setIsCustomerCreateModalOpen(false);
      }}
      onOpenLocationCreateModal={() => {
        if (!selectedCustomerId) {
          return;
        }
        setLocationCreateForm(EMPTY_LOCATION_FORM);
        setIsLocationCreateModalOpen(true);
      }}
      onCloseLocationCreateModal={() => {
        setIsLocationCreateModalOpen(false);
      }}
      onOpenLocationEditModal={() => {
        if (!selectedLocation) {
          return;
        }
        setLocationEditForm(toLocationFormValues(selectedLocation));
        setIsLocationEditModalOpen(true);
      }}
      onCloseLocationEditModal={() => {
        setIsLocationEditModalOpen(false);
      }}
      onCustomerFormChange={onCustomerFormChange}
      onLocationCreateFormChange={onLocationCreateFormChange}
      onLocationEditFormChange={onLocationEditFormChange}
      onCreateCustomer={(event) => void onCreateCustomer(event)}
      onCreateLocation={(event) => void onCreateLocation(event)}
      onUpdateLocation={(event) => void onUpdateLocation(event)}
      onCreateContact={(event) => void onCreateContact(event)}
    />
  );
}
