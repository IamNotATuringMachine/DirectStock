import { Building2, Plus, Trash2 } from "lucide-react";

import type { Customer } from "../../../types";

type CustomersListPanelProps = {
  customerItems: Customer[];
  selectedCustomerId: number | null;
  onSelectCustomer: (customerId: number) => void;
  onOpenCreateModal: () => void;
  onDeleteCustomer: () => void;
};

export function CustomersListPanel({
  customerItems,
  selectedCustomerId,
  onSelectCustomer,
  onOpenCreateModal,
  onDeleteCustomer,
}: CustomersListPanelProps) {
  const hasSelectedCustomer = selectedCustomerId !== null;

  return (
    <article className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] p-5 shadow-sm space-y-4">
      <header className="flex items-center justify-between gap-3">
        <h3 className="section-title flex items-center gap-2">
          <Building2 className="w-4 h-4" />
          Kunden
        </h3>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onOpenCreateModal}
          data-testid="customers-open-create-modal"
        >
          <Plus className="w-4 h-4" />
          Neuer Kunde
        </button>
      </header>

      <div className="border border-[var(--line)] rounded-[var(--radius-sm)] divide-y divide-[var(--line)] max-h-[420px] overflow-auto">
        {customerItems.length === 0 ? (
          <p className="px-3 py-6 text-sm text-[var(--muted)]">Noch keine Kunden vorhanden.</p>
        ) : (
          customerItems.map((customer) => (
            <button
              key={customer.id}
              className={`w-full px-3 py-2 text-left hover:bg-[var(--panel-soft)] ${
                selectedCustomerId === customer.id ? "bg-[var(--panel-strong)]" : ""
              }`}
              onClick={() => onSelectCustomer(customer.id)}
              data-testid={`customers-item-${customer.id}`}
            >
              <p className="font-medium text-sm">{customer.company_name}</p>
              <p className="text-xs text-[var(--muted)]">{customer.customer_number}</p>
            </button>
          ))
        )}
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
  );
}
