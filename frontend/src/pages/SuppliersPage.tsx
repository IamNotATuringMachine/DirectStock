import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";

import { createSupplier, deleteSupplier, fetchSuppliers, updateSupplier } from "../services/suppliersApi";
import { SuppliersView } from "./suppliers/SuppliersView";

export default function SuppliersPage() {
  const queryClient = useQueryClient();

  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [createSupplierNumber, setCreateSupplierNumber] = useState("");
  const [createCompanyName, setCreateCompanyName] = useState("");
  const [createContactName, setCreateContactName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createIsActive, setCreateIsActive] = useState(true);

  const [editCompanyName, setEditCompanyName] = useState("");
  const [editContactName, setEditContactName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  const suppliersQuery = useQuery({
    queryKey: ["suppliers", "master-data-page"],
    queryFn: () => fetchSuppliers({ page: 1, pageSize: 200 }),
  });

  const supplierItems = suppliersQuery.data?.items ?? [];

  useEffect(() => {
    if (selectedSupplierId === null) {
      return;
    }
    const selectedStillExists = supplierItems.some((item) => item.id === selectedSupplierId);
    if (!selectedStillExists) {
      setSelectedSupplierId(null);
    }
  }, [selectedSupplierId, supplierItems]);

  const filteredSupplierItems = useMemo(() => {
    if (!searchQuery.trim()) {
      return supplierItems;
    }
    const term = searchQuery.trim().toLowerCase();
    return supplierItems.filter(
      (supplier) =>
        supplier.supplier_number.toLowerCase().includes(term) ||
        supplier.company_name.toLowerCase().includes(term) ||
        (supplier.contact_name ?? "").toLowerCase().includes(term) ||
        (supplier.email ?? "").toLowerCase().includes(term)
    );
  }, [searchQuery, supplierItems]);

  const selectedSupplier = useMemo(
    () => supplierItems.find((supplier) => supplier.id === selectedSupplierId) ?? null,
    [selectedSupplierId, supplierItems]
  );

  useEffect(() => {
    if (!selectedSupplier) {
      setEditCompanyName("");
      setEditContactName("");
      setEditEmail("");
      setEditPhone("");
      setEditIsActive(true);
      return;
    }
    setEditCompanyName(selectedSupplier.company_name);
    setEditContactName(selectedSupplier.contact_name ?? "");
    setEditEmail(selectedSupplier.email ?? "");
    setEditPhone(selectedSupplier.phone ?? "");
    setEditIsActive(selectedSupplier.is_active);
  }, [selectedSupplier]);

  const toErrorMessage = (error: unknown): string => {
    if (error instanceof AxiosError) {
      const detail = error.response?.data?.detail;
      if (typeof detail === "string" && detail.trim().length > 0) {
        return detail;
      }
    }
    return "Vorgang konnte nicht ausgeführt werden. Bitte erneut versuchen.";
  };

  const createSupplierMutation = useMutation({
    mutationFn: createSupplier,
    onMutate: () => setErrorMessage(null),
    onSuccess: async (createdSupplier) => {
      await queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setSelectedSupplierId(createdSupplier.id);
      setCreateSupplierNumber("");
      setCreateCompanyName("");
      setCreateContactName("");
      setCreateEmail("");
      setCreatePhone("");
      setCreateIsActive(true);
    },
    onError: (error) => {
      setErrorMessage(toErrorMessage(error));
    },
  });

  const updateSupplierMutation = useMutation({
    mutationFn: ({ supplierId }: { supplierId: number }) =>
      updateSupplier(supplierId, {
        company_name: editCompanyName.trim(),
        contact_name: editContactName.trim() || null,
        email: editEmail.trim() || null,
        phone: editPhone.trim() || null,
        is_active: editIsActive,
      }),
    onMutate: () => setErrorMessage(null),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (error) => {
      setErrorMessage(toErrorMessage(error));
    },
  });

  const deleteSupplierMutation = useMutation({
    mutationFn: deleteSupplier,
    onMutate: () => setErrorMessage(null),
    onSuccess: async (_, supplierId) => {
      setSelectedSupplierId((current) => (current === supplierId ? null : current));
      await queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (error) => {
      setErrorMessage(toErrorMessage(error));
    },
  });

  const onCreateSupplier = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!createSupplierNumber.trim() || !createCompanyName.trim()) {
      return;
    }
    await createSupplierMutation.mutateAsync({
      supplier_number: createSupplierNumber.trim(),
      company_name: createCompanyName.trim(),
      contact_name: createContactName.trim() || null,
      email: createEmail.trim() || null,
      phone: createPhone.trim() || null,
      is_active: createIsActive,
    });
  };

  const onSaveSupplier = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedSupplierId || !editCompanyName.trim()) {
      return;
    }
    await updateSupplierMutation.mutateAsync({ supplierId: selectedSupplierId });
  };

  const onDeleteSupplier = () => {
    if (!selectedSupplierId) {
      return;
    }
    void deleteSupplierMutation.mutateAsync(selectedSupplierId);
  };

  return (
    <SuppliersView
      errorMessage={errorMessage}
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      supplierItems={filteredSupplierItems}
      selectedSupplierId={selectedSupplierId}
      onSelectSupplier={setSelectedSupplierId}
      createSupplierNumber={createSupplierNumber}
      onCreateSupplierNumberChange={setCreateSupplierNumber}
      createCompanyName={createCompanyName}
      onCreateCompanyNameChange={setCreateCompanyName}
      createContactName={createContactName}
      onCreateContactNameChange={setCreateContactName}
      createEmail={createEmail}
      onCreateEmailChange={setCreateEmail}
      createPhone={createPhone}
      onCreatePhoneChange={setCreatePhone}
      createIsActive={createIsActive}
      onCreateIsActiveChange={setCreateIsActive}
      onCreateSupplier={(event) => void onCreateSupplier(event)}
      createPending={createSupplierMutation.isPending}
      selectedSupplierNumber={selectedSupplier?.supplier_number ?? null}
      selectedSupplierName={selectedSupplier?.company_name ?? null}
      editCompanyName={editCompanyName}
      onEditCompanyNameChange={setEditCompanyName}
      editContactName={editContactName}
      onEditContactNameChange={setEditContactName}
      editEmail={editEmail}
      onEditEmailChange={setEditEmail}
      editPhone={editPhone}
      onEditPhoneChange={setEditPhone}
      editIsActive={editIsActive}
      onEditIsActiveChange={setEditIsActive}
      onSaveSupplier={(event) => void onSaveSupplier(event)}
      onDeleteSupplier={onDeleteSupplier}
      savePending={updateSupplierMutation.isPending}
      deletePending={deleteSupplierMutation.isPending}
    />
  );
}
