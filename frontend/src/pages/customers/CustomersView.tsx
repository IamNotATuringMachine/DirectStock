import type { FormEvent } from "react";

import type { Customer, CustomerContact, CustomerLocation } from "../../types";
import { ContactsPanel } from "./components/ContactsPanel";
import { CustomerCreateModal, type CustomerCreateFormValues } from "./components/CustomerCreateModal";
import { CustomerLocationModal, type CustomerLocationFormValues } from "./components/CustomerLocationModal";
import { CustomersListPanel } from "./components/CustomersListPanel";
import { LocationDetailsPanel } from "./components/LocationDetailsPanel";
import { LocationsListPanel } from "./components/LocationsListPanel";

type CustomersViewProps = {
  errorMessage: string | null;
  customerItems: Customer[];
  selectedCustomerId: number | null;
  selectedCustomerName: string | null;
  selectedLocationId: number | null;
  selectedLocation: CustomerLocation | null;
  locations: CustomerLocation[];
  contacts: CustomerContact[];
  isCustomerCreateModalOpen: boolean;
  isLocationCreateModalOpen: boolean;
  isLocationEditModalOpen: boolean;
  isCreatingCustomer: boolean;
  isCreatingLocation: boolean;
  isUpdatingLocation: boolean;
  customerForm: CustomerCreateFormValues;
  locationCreateForm: CustomerLocationFormValues;
  locationEditForm: CustomerLocationFormValues;
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
  onSelectCustomer: (customerId: number) => void;
  onSelectLocation: (locationId: number) => void;
  onDeleteCustomer: () => void;
  onDeleteLocation: (locationId: number) => void;
  onDeleteContact: (contactId: number) => void;
  onOpenCustomerCreateModal: () => void;
  onCloseCustomerCreateModal: () => void;
  onOpenLocationCreateModal: () => void;
  onCloseLocationCreateModal: () => void;
  onOpenLocationEditModal: () => void;
  onCloseLocationEditModal: () => void;
  onCustomerFormChange: <K extends keyof CustomerCreateFormValues>(field: K, value: CustomerCreateFormValues[K]) => void;
  onLocationCreateFormChange: <K extends keyof CustomerLocationFormValues>(
    field: K,
    value: CustomerLocationFormValues[K]
  ) => void;
  onLocationEditFormChange: <K extends keyof CustomerLocationFormValues>(
    field: K,
    value: CustomerLocationFormValues[K]
  ) => void;
  onCreateCustomer: (event: FormEvent<HTMLFormElement>) => void;
  onCreateLocation: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateLocation: (event: FormEvent<HTMLFormElement>) => void;
  onCreateContact: (event: FormEvent<HTMLFormElement>) => void;
};

export function CustomersView({
  errorMessage,
  customerItems,
  selectedCustomerId,
  selectedCustomerName,
  selectedLocationId,
  selectedLocation,
  locations,
  contacts,
  isCustomerCreateModalOpen,
  isLocationCreateModalOpen,
  isLocationEditModalOpen,
  isCreatingCustomer,
  isCreatingLocation,
  isUpdatingLocation,
  customerForm,
  locationCreateForm,
  locationEditForm,
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
  onSelectCustomer,
  onSelectLocation,
  onDeleteCustomer,
  onDeleteLocation,
  onDeleteContact,
  onOpenCustomerCreateModal,
  onCloseCustomerCreateModal,
  onOpenLocationCreateModal,
  onCloseLocationCreateModal,
  onOpenLocationEditModal,
  onCloseLocationEditModal,
  onCustomerFormChange,
  onLocationCreateFormChange,
  onLocationEditFormChange,
  onCreateCustomer,
  onCreateLocation,
  onUpdateLocation,
  onCreateContact,
}: CustomersViewProps) {
  const hasSelectedCustomer = selectedCustomerId !== null;
  const hasSelectedLocation = selectedLocationId !== null;

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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <CustomersListPanel
          customerItems={customerItems}
          selectedCustomerId={selectedCustomerId}
          onSelectCustomer={onSelectCustomer}
          onOpenCreateModal={onOpenCustomerCreateModal}
          onDeleteCustomer={onDeleteCustomer}
        />

        <LocationsListPanel
          hasSelectedCustomer={hasSelectedCustomer}
          selectedCustomerName={selectedCustomerName}
          locations={locations}
          selectedLocationId={selectedLocationId}
          onSelectLocation={onSelectLocation}
          onOpenCreateModal={onOpenLocationCreateModal}
          onDeleteLocation={onDeleteLocation}
        />

        <div className="space-y-6">
          <LocationDetailsPanel
            hasSelectedCustomer={hasSelectedCustomer}
            selectedLocation={selectedLocation}
            onOpenEditModal={onOpenLocationEditModal}
          />

          <ContactsPanel
            hasSelectedLocation={hasSelectedLocation}
            selectedLocationName={selectedLocation?.name ?? null}
            contacts={contacts}
            contactJobTitle={contactJobTitle}
            onContactJobTitleChange={onContactJobTitleChange}
            contactSalutation={contactSalutation}
            onContactSalutationChange={onContactSalutationChange}
            contactFirstName={contactFirstName}
            onContactFirstNameChange={onContactFirstNameChange}
            contactLastName={contactLastName}
            onContactLastNameChange={onContactLastNameChange}
            contactPhone={contactPhone}
            onContactPhoneChange={onContactPhoneChange}
            contactEmail={contactEmail}
            onContactEmailChange={onContactEmailChange}
            onCreateContact={onCreateContact}
            onDeleteContact={onDeleteContact}
          />
        </div>
      </div>

      <CustomerCreateModal
        isOpen={isCustomerCreateModalOpen}
        values={customerForm}
        isSubmitting={isCreatingCustomer}
        onClose={onCloseCustomerCreateModal}
        onSubmit={onCreateCustomer}
        onChange={onCustomerFormChange}
      />

      <CustomerLocationModal
        isOpen={isLocationCreateModalOpen}
        mode="create"
        values={locationCreateForm}
        isSubmitting={isCreatingLocation}
        onClose={onCloseLocationCreateModal}
        onSubmit={onCreateLocation}
        onChange={onLocationCreateFormChange}
      />

      <CustomerLocationModal
        isOpen={isLocationEditModalOpen}
        mode="edit"
        values={locationEditForm}
        isSubmitting={isUpdatingLocation}
        onClose={onCloseLocationEditModal}
        onSubmit={onUpdateLocation}
        onChange={onLocationEditFormChange}
      />
    </section>
  );
}
