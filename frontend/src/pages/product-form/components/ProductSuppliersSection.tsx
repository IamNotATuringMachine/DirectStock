import { Check, Clock, DollarSign, Hash, Info, Loader2, Plus, ShoppingCart, Star, Trash2, Truck } from "lucide-react";

import { ProductSuppliersTab } from "./ProductSuppliersTab";

export function ProductSuppliersSection({ vm }: { vm: any }) {
  const {
    activeTab,
    isEditMode,
    onCreateSupplierRelation,
    selectedSupplierId,
    setSelectedSupplierId,
    suppliersQuery,
    supplierProductNumber,
    setSupplierProductNumber,
    supplierPrice,
    setSupplierPrice,
    supplierLeadTimeDays,
    setSupplierLeadTimeDays,
    supplierMinOrderQuantity,
    setSupplierMinOrderQuantity,
    supplierPreferred,
    setSupplierPreferred,
    pending,
    isAdmin,
    createProductSupplierMutation,
    productSuppliersQuery,
    supplierNameById,
    updateProductSupplierMutation,
    deleteProductSupplierMutation,
    renderCreateWizardFooter,
  } = vm;

  if (activeTab !== "suppliers") {
    return null;
  }

  return (
    <ProductSuppliersTab>
      <div className="space-y-8" data-testid="product-form-suppliers-tab">
        {!isEditMode && (
          <div className="flex items-center gap-4 p-5 rounded-xl bg-amber-50 text-black border border-amber-200 shadow-sm">
            <Info size={24} className="shrink-0 text-amber-600" />
            <div>
              <h4 className="font-semibold">Artikel noch nicht erstellt</h4>
              <p className="text-sm text-black mt-1">
                Bitte speichern Sie den Artikel zuerst, um Lieferanten zuordnen zu können.
              </p>
            </div>
          </div>
        )}

        {isEditMode && (
          <>
            <section className="card p-6 border border-[var(--line)] bg-[var(--panel)] shadow-sm rounded-xl">
              <h3 className="text-lg font-semibold text-[var(--ink)] mb-6 flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-[var(--accent)]/10 text-[var(--accent)]">
                  <Plus size={18} />
                </div>
                Neuen Lieferanten zuordnen
              </h3>
              <form
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
                onSubmit={(event) => void onCreateSupplierRelation(event)}
                data-testid="product-supplier-form"
              >
                <label className="md:col-span-2 lg:col-span-4 space-y-1.5">
                  <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide">
                    Lieferant auswählen <span className="text-[var(--danger)]">*</span>
                  </span>
                  <select
                    className="input w-full h-11"
                    value={selectedSupplierId}
                    onChange={(event) => setSelectedSupplierId(event.target.value)}
                    data-testid="product-supplier-select"
                    required
                  >
                    <option value="">-- Bitte wählen --</option>
                    {(suppliersQuery.data?.items ?? []).map((supplier: any) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.supplier_number} - {supplier.company_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide">
                    Lieferanten Art.-Nr.
                  </span>
                  <div className="relative">
                    <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                    <input
                      className="input w-full !pl-10 text-sm h-11"
                      value={supplierProductNumber}
                      onChange={(event) => setSupplierProductNumber(event.target.value)}
                      data-testid="product-supplier-product-number"
                      placeholder="Optional"
                    />
                  </div>
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide">Einkaufspreis</span>
                  <div className="relative">
                    <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                    <input
                      className="input w-full !pl-10 text-sm h-11"
                      type="number"
                      min="0"
                      step="0.01"
                      value={supplierPrice}
                      onChange={(event) => setSupplierPrice(event.target.value)}
                      data-testid="product-supplier-price"
                      placeholder="0.00"
                    />
                  </div>
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide">
                    Lieferzeit (Tage)
                  </span>
                  <div className="relative">
                    <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                    <input
                      className="input w-full !pl-10 text-sm h-11"
                      type="number"
                      min="0"
                      step="1"
                      value={supplierLeadTimeDays}
                      onChange={(event) => setSupplierLeadTimeDays(event.target.value)}
                      data-testid="product-supplier-lead-time"
                      placeholder="0"
                    />
                  </div>
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide">
                    Mindestbestellmenge
                  </span>
                  <div className="relative">
                    <ShoppingCart size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                    <input
                      className="input w-full !pl-10 text-sm h-11"
                      type="number"
                      min="0"
                      step="0.001"
                      value={supplierMinOrderQuantity}
                      onChange={(event) => setSupplierMinOrderQuantity(event.target.value)}
                      data-testid="product-supplier-min-order"
                      placeholder="0"
                    />
                  </div>
                </label>

                <div className="md:col-span-2 lg:col-span-4 flex items-center justify-between pt-4 border-t border-[var(--line)]">
                  <div className="flex items-center gap-3 min-w-0 group">
                    <div className="relative flex items-center">
                      <input
                        id="product-supplier-preferred-checkbox"
                        type="checkbox"
                        className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-[var(--line)] checked:border-[var(--accent)] checked:bg-[var(--accent)] transition-all"
                        checked={supplierPreferred}
                        onChange={(event) => setSupplierPreferred(event.target.checked)}
                        data-testid="product-supplier-preferred"
                      />
                      <Check
                        size={14}
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100 pointer-events-none"
                      />
                    </div>
                    <label
                      htmlFor="product-supplier-preferred-checkbox"
                      className="cursor-pointer text-sm font-medium text-[var(--ink)] transition-colors group-hover:text-[var(--accent)]"
                    >
                      Als bevorzugter Lieferant markieren
                    </label>
                  </div>

                  <button
                    className="btn btn-primary min-w-[140px]"
                    type="submit"
                    disabled={pending || !isAdmin}
                    data-testid="product-supplier-add-btn"
                  >
                    {createProductSupplierMutation.isPending ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Plus size={16} />
                    )}
                    Hinzufügen
                  </button>
                </div>
              </form>
            </section>

            <div className="space-y-4">
              <h3 className="font-bold text-[var(--muted)] uppercase tracking-wider text-sm px-1">
                Zugeordnete Lieferanten
              </h3>
              <div className="grid grid-cols-1 gap-4">
                {(productSuppliersQuery.data ?? []).map((relation: any) => (
                  <div
                    key={relation.id}
                    className={`group flex flex-col md:flex-row md:items-center justify-between gap-6 p-5 rounded-xl border transition-all duration-200 ${
                      relation.is_preferred
                        ? "border-[var(--accent)] bg-green-50/40 shadow-sm"
                        : "border-[var(--line)] bg-[var(--panel)] hover:border-[var(--line-strong)] hover:shadow-sm"
                    }`}
                    data-testid={`product-supplier-relation-${relation.id}`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-[var(--ink)] text-lg">
                          {supplierNameById.get(relation.supplier_id) ?? `Lieferant #${relation.supplier_id}`}
                        </span>
                        {relation.is_preferred && (
                          <span className="inline-flex items-center gap-1.5 text-[10px] uppercase font-bold text-[var(--accent-strong)] bg-green-100 px-2 py-0.5 rounded-full border border-green-200">
                            <Star size={10} fill="currentColor" /> Preferred
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--muted)]">
                        <span className="flex items-center gap-1.5">
                          <Hash size={14} /> Art.-Nr:{" "}
                          <span className="font-medium text-[var(--ink)]">
                            {relation.supplier_product_number || "-"}
                          </span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <DollarSign size={14} /> Preis:{" "}
                          <span className="font-medium text-[var(--ink)]">{relation.price ?? "-"}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock size={14} /> Lead Time:{" "}
                          <span className="font-medium text-[var(--ink)]">{relation.lead_time_days ?? "-"} Tage</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <ShoppingCart size={14} /> MOQ:{" "}
                          <span className="font-medium text-[var(--ink)]">{relation.min_order_quantity ?? "-"}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          Preferred:{" "}
                          <span className="font-medium text-[var(--ink)]">{relation.is_preferred ? "ja" : "nein"}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-4 md:pt-0 border-t md:border-0 border-[var(--line)]/50">
                      <button
                        className={`btn btn-sm ${relation.is_preferred ? "text-[var(--muted)] hover:bg-[var(--line)]" : "text-[var(--accent)] bg-green-50 hover:bg-green-100 border-green-200"}`}
                        type="button"
                        onClick={() =>
                          void updateProductSupplierMutation.mutateAsync({
                            relation,
                            payload: {
                              is_preferred: !relation.is_preferred,
                            },
                          })
                        }
                        disabled={pending || !isAdmin}
                        data-testid={`product-supplier-toggle-preferred-${relation.id}`}
                        title={relation.is_preferred ? "Markierung entfernen" : "Als bevorzugt markieren"}
                      >
                        <Star size={16} fill={relation.is_preferred ? "none" : "currentColor"} />
                        {relation.is_preferred ? "Unmark" : "Preferred"}
                      </button>
                      <button
                        className="btn btn-sm text-red-600 hover:bg-red-50 border-transparent hover:border-red-200"
                        type="button"
                        onClick={() => void deleteProductSupplierMutation.mutateAsync(relation.id)}
                        disabled={pending || !isAdmin}
                        data-testid={`product-supplier-delete-${relation.id}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {!productSuppliersQuery.isLoading && (productSuppliersQuery.data?.length ?? 0) === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-[var(--muted)] bg-[var(--panel-soft)] rounded-xl border border-dashed border-[var(--line)]">
                  <Truck size={48} className="opacity-20 mb-3" />
                  <p className="font-medium">Noch keine Lieferanten zugeordnet.</p>
                  <p className="text-sm">Verwenden Sie das Formular oben, um Lieferanten hinzuzufügen.</p>
                </div>
              )}
            </div>
            {renderCreateWizardFooter("suppliers")}
          </>
        )}
      </div>
    </ProductSuppliersTab>
  );
}
