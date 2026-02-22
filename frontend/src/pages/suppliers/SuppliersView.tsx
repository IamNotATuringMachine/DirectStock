import type { FormEvent } from "react";
import { Building2, Mail, Phone, Plus, Save, Search, Trash2 } from "lucide-react";

import type { Supplier } from "../../types";

type SuppliersViewProps = {
  errorMessage: string | null;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  supplierItems: Supplier[];
  selectedSupplierId: number | null;
  onSelectSupplier: (supplierId: number) => void;
  createSupplierNumber: string;
  onCreateSupplierNumberChange: (value: string) => void;
  createCompanyName: string;
  onCreateCompanyNameChange: (value: string) => void;
  createContactName: string;
  onCreateContactNameChange: (value: string) => void;
  createEmail: string;
  onCreateEmailChange: (value: string) => void;
  createPhone: string;
  onCreatePhoneChange: (value: string) => void;
  createIsActive: boolean;
  onCreateIsActiveChange: (value: boolean) => void;
  onCreateSupplier: (event: FormEvent<HTMLFormElement>) => void;
  createPending: boolean;
  selectedSupplierNumber: string | null;
  selectedSupplierName: string | null;
  editCompanyName: string;
  onEditCompanyNameChange: (value: string) => void;
  editContactName: string;
  onEditContactNameChange: (value: string) => void;
  editEmail: string;
  onEditEmailChange: (value: string) => void;
  editPhone: string;
  onEditPhoneChange: (value: string) => void;
  editIsActive: boolean;
  onEditIsActiveChange: (value: boolean) => void;
  onSaveSupplier: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteSupplier: () => void;
  savePending: boolean;
  deletePending: boolean;
};

export function SuppliersView({
  errorMessage,
  searchQuery,
  onSearchQueryChange,
  supplierItems,
  selectedSupplierId,
  onSelectSupplier,
  createSupplierNumber,
  onCreateSupplierNumberChange,
  createCompanyName,
  onCreateCompanyNameChange,
  createContactName,
  onCreateContactNameChange,
  createEmail,
  onCreateEmailChange,
  createPhone,
  onCreatePhoneChange,
  createIsActive,
  onCreateIsActiveChange,
  onCreateSupplier,
  createPending,
  selectedSupplierNumber,
  selectedSupplierName,
  editCompanyName,
  onEditCompanyNameChange,
  editContactName,
  onEditContactNameChange,
  editEmail,
  onEditEmailChange,
  editPhone,
  onEditPhoneChange,
  editIsActive,
  onEditIsActiveChange,
  onSaveSupplier,
  onDeleteSupplier,
  savePending,
  deletePending,
}: SuppliersViewProps) {
  const hasSelectedSupplier = selectedSupplierId !== null;
  const createActiveCheckboxId = "suppliers-create-active";
  const editActiveCheckboxId = "suppliers-edit-active";

  return (
    <section className="page flex flex-col gap-6" data-testid="suppliers-page">
      <header className="flex flex-col gap-2">
        <h2 className="page-title">Lieferanten</h2>
        <p className="section-subtitle">Lieferantenstamm für Einkauf und Bestellprozesse verwalten.</p>
        {errorMessage ? (
          <p className="text-sm text-red-600" data-testid="suppliers-page-error">
            {errorMessage}
          </p>
        ) : null}
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <article className="xl:col-span-1 bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] p-5 shadow-sm space-y-4">
          <h3 className="section-title flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Lieferantenstamm
          </h3>

          <form className="space-y-2" onSubmit={onCreateSupplier}>
            <input
              className="input w-full"
              placeholder="Lieferantennummer (z. B. SUP-1000)"
              value={createSupplierNumber}
              onChange={(event) => onCreateSupplierNumberChange(event.target.value)}
            />
            <input
              className="input w-full"
              placeholder="Firmenname"
              value={createCompanyName}
              onChange={(event) => onCreateCompanyNameChange(event.target.value)}
            />
            <input
              className="input w-full"
              placeholder="Ansprechpartner"
              value={createContactName}
              onChange={(event) => onCreateContactNameChange(event.target.value)}
            />
            <input
              className="input w-full"
              placeholder="E-Mail (mehrere mit Komma/Semikolon)"
              value={createEmail}
              onChange={(event) => onCreateEmailChange(event.target.value)}
            />
            <input
              className="input w-full"
              placeholder="Telefon"
              value={createPhone}
              onChange={(event) => onCreatePhoneChange(event.target.value)}
            />
            <label className="flex items-center gap-2 text-sm text-[var(--muted)]" htmlFor={createActiveCheckboxId}>
              <input
                id={createActiveCheckboxId}
                type="checkbox"
                checked={createIsActive}
                onChange={(event) => onCreateIsActiveChange(event.target.checked)}
              />
              Lieferant ist aktiv
            </label>
            <button className="btn btn-primary w-full justify-center" type="submit" disabled={createPending}>
              <Plus className="w-4 h-4" />
              Lieferant anlegen
            </button>
          </form>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input
              className="input w-full pl-9"
              placeholder="Lieferanten suchen"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
            />
          </div>

          <div
            className="border border-[var(--line)] rounded-[var(--radius-sm)] divide-y divide-[var(--line)] max-h-[420px] overflow-auto"
            data-testid="suppliers-list"
          >
            {supplierItems.length === 0 ? (
              <p className="px-3 py-4 text-sm text-[var(--muted)]">Keine Lieferanten gefunden.</p>
            ) : null}
            {supplierItems.map((supplier) => (
              <button
                key={supplier.id}
                className={`w-full px-3 py-2 text-left hover:bg-[var(--panel-soft)] ${selectedSupplierId === supplier.id ? "bg-[var(--panel-strong)]" : ""}`}
                onClick={() => onSelectSupplier(supplier.id)}
              >
                <p className="font-medium text-sm">{supplier.company_name}</p>
                <p className="text-xs text-[var(--muted)]">{supplier.supplier_number}</p>
                <p className="text-xs mt-1">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 ${
                      supplier.is_active
                        ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                        : "bg-slate-100 text-slate-600 border border-slate-300"
                    }`}
                  >
                    {supplier.is_active ? "Aktiv" : "Inaktiv"}
                  </span>
                </p>
              </button>
            ))}
          </div>
        </article>

        <article className="xl:col-span-2 bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] p-5 shadow-sm space-y-4">
          <h3 className="section-title flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Lieferantendetails
          </h3>
          {hasSelectedSupplier ? (
            <p className="text-sm text-[var(--muted)]">
              Bearbeitung: {selectedSupplierName} ({selectedSupplierNumber})
            </p>
          ) : (
            <p className="text-sm text-[var(--muted)]">Bitte zuerst einen Lieferanten aus der Liste auswählen.</p>
          )}

          <form className="space-y-3" onSubmit={onSaveSupplier}>
            <input className="input w-full" value={selectedSupplierNumber ?? ""} disabled placeholder="Lieferantennummer" />
            <input
              className="input w-full"
              placeholder="Firmenname"
              value={editCompanyName}
              onChange={(event) => onEditCompanyNameChange(event.target.value)}
              disabled={!hasSelectedSupplier}
            />
            <input
              className="input w-full"
              placeholder="Ansprechpartner"
              value={editContactName}
              onChange={(event) => onEditContactNameChange(event.target.value)}
              disabled={!hasSelectedSupplier}
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-xs text-[var(--muted)]">E-Mail</span>
                <input
                  className="input w-full"
                  placeholder="z. B. a@firma.de; b@firma.de"
                  value={editEmail}
                  onChange={(event) => onEditEmailChange(event.target.value)}
                  disabled={!hasSelectedSupplier}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-[var(--muted)]">Telefon</span>
                <input
                  className="input w-full"
                  value={editPhone}
                  onChange={(event) => onEditPhoneChange(event.target.value)}
                  disabled={!hasSelectedSupplier}
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm text-[var(--muted)]" htmlFor={editActiveCheckboxId}>
              <input
                id={editActiveCheckboxId}
                type="checkbox"
                checked={editIsActive}
                onChange={(event) => onEditIsActiveChange(event.target.checked)}
                disabled={!hasSelectedSupplier}
              />
              Lieferant ist aktiv
            </label>

            <div className="flex flex-wrap gap-3">
              <button className="btn btn-primary" type="submit" disabled={!hasSelectedSupplier || savePending}>
                <Save className="w-4 h-4" />
                Änderungen speichern
              </button>
              <button
                className="btn text-red-600 border-red-300 hover:bg-red-50"
                type="button"
                onClick={onDeleteSupplier}
                disabled={!hasSelectedSupplier || deletePending}
              >
                <Trash2 className="w-4 h-4" />
                Lieferant löschen
              </button>
              {editPhone ? (
                <span className="inline-flex items-center gap-1 text-sm text-[var(--muted)] ml-auto">
                  <Phone className="w-4 h-4" />
                  {editPhone}
                </span>
              ) : null}
            </div>
          </form>
        </article>
      </div>
    </section>
  );
}
