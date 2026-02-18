import { Check, ChevronDown, Hash, Info, Layers, Loader2, Package, Save, Tag } from "lucide-react";
import type { ProductStatus } from "../../../types";

import { ProductGroupSelect } from "./ProductGroupSelect";
import { ProductMasterTab } from "./ProductMasterTab";

const productStatusOptions: Array<{ value: ProductStatus; label: string }> = [
  { value: "active", label: "Aktiv" },
  { value: "blocked", label: "Gesperrt" },
  { value: "deprecated", label: "Veraltet" },
  { value: "archived", label: "Archiviert" },
];

export function ProductMasterSection({ vm }: { vm: any }) {
  const {
    activeTab,
    handleSubmit,
    productForm,
    setProductForm,
    isEditMode,
    warehousesQuery,
    defaultBinId,
    setDefaultBinId,
    defaultBinWarehouseId,
    setDefaultBinWarehouseId,
    defaultBinZoneId,
    setDefaultBinZoneId,
    defaultBinZonesQuery,
    defaultBinBinsQuery,
    pending,
    isAdmin,
  } = vm;

  if (activeTab !== "master") {
    return null;
  }

  return (
    <ProductMasterTab>
      <div className="card p-8 border border-[var(--line)] bg-[var(--panel)] shadow-sm rounded-xl">
        <form onSubmit={(event) => void handleSubmit(event)} className="form-grid space-y-8 max-w-4xl">
          {/* Primary Info */}
          <div className="split-grid grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <h3 className="text-sm font-bold text-[var(--muted)] uppercase tracking-wider flex items-center gap-2">
                <Info size={14} /> Grundinformationen
              </h3>

              <div className="space-y-5">
                <label className="space-y-1.5 block">
                  <span className="text-sm font-medium text-[var(--ink)]">
                    Artikelnummer <span className="text-[var(--danger)]">*</span>
                  </span>
                  <div className="relative group">
                    <Hash
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] group-focus-within:text-[var(--accent)] transition-colors"
                    />
                    <input
                      className="input !pl-10 w-full transition-all focus:ring-2 ring-[var(--accent)]/20"
                      value={productForm.productNumber}
                      onChange={(event) =>
                        setProductForm((prev: any) => ({
                          ...prev,
                          productNumber: event.target.value,
                        }))
                      }
                      required
                      disabled={isEditMode}
                      data-testid="product-form-number"
                      placeholder="z.B. AR-10001"
                    />
                  </div>
                </label>

                <label className="space-y-1.5 block">
                  <span className="text-sm font-medium text-[var(--ink)]">
                    Bezeichnung <span className="text-[var(--danger)]">*</span>
                  </span>
                  <div className="relative group">
                    <Tag
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] group-focus-within:text-[var(--accent)] transition-colors"
                    />
                    <input
                      className="input !pl-10 w-full transition-all focus:ring-2 ring-[var(--accent)]/20"
                      value={productForm.name}
                      onChange={(event) =>
                        setProductForm((prev: any) => ({
                          ...prev,
                          name: event.target.value,
                        }))
                      }
                      required
                      data-testid="product-form-name"
                      placeholder="Produktbezeichnung"
                    />
                  </div>
                </label>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-sm font-bold text-[var(--muted)] uppercase tracking-wider flex items-center gap-2">
                <Layers size={14} /> Kategorisierung
              </h3>

              <div className="space-y-5">
                <div className="space-y-1.5 block">
                  <span className="text-sm font-medium text-[var(--ink)]">Produktgruppe</span>
                  <div className="relative group">
                    <Layers
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] group-focus-within:text-[var(--accent)] transition-colors"
                    />
                    <ProductGroupSelect
                      value={productForm.groupId}
                      onChange={(newValue) =>
                        setProductForm((prev: any) => ({
                          ...prev,
                          groupId: newValue,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <label className="space-y-1.5 block">
                    <span className="text-sm font-medium text-[var(--ink)]">
                      Einheit <span className="text-[var(--danger)]">*</span>
                    </span>
                    <div className="relative group">
                      <Package
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] group-focus-within:text-[var(--accent)] transition-colors"
                      />
                      <input
                        className="input !pl-10 w-full transition-all focus:ring-2 ring-[var(--accent)]/20"
                        value={productForm.unit}
                        onChange={(event) =>
                          setProductForm((prev: any) => ({
                            ...prev,
                            unit: event.target.value,
                          }))
                        }
                        required
                        data-testid="product-form-unit"
                        placeholder="Stück"
                      />
                    </div>
                  </label>

                  <label className="space-y-1.5 block">
                    <span className="text-sm font-medium text-[var(--ink)]">Status</span>
                    <div className="relative group">
                      <Info
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] group-focus-within:text-[var(--accent)] transition-colors"
                      />
                      <select
                        className="input !pl-10 w-full appearance-none transition-all focus:ring-2 ring-[var(--accent)]/20"
                        value={productForm.status}
                        onChange={(event) =>
                          setProductForm((prev: any) => ({
                            ...prev,
                            status: event.target.value as ProductStatus,
                          }))
                        }
                        data-testid="product-form-status"
                      >
                        {productStatusOptions.map((status: any) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={16}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none"
                      />
                    </div>
                  </label>
                </div>

                <div className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--panel-soft)] p-3 group">
                  <div className="relative flex items-center">
                    <input
                      id="product-form-item-tracking-checkbox"
                      type="checkbox"
                      className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-[var(--line)] checked:border-[var(--accent)] checked:bg-[var(--accent)] transition-all"
                      checked={productForm.requiresItemTracking}
                      onChange={(event) =>
                        setProductForm((prev: any) => ({
                          ...prev,
                          requiresItemTracking: event.target.checked,
                        }))
                      }
                      data-testid="product-form-requires-item-tracking"
                    />
                    <Check
                      size={14}
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100 pointer-events-none"
                    />
                  </div>
                  <label
                    htmlFor="product-form-item-tracking-checkbox"
                    className="cursor-pointer text-sm text-[var(--ink)] transition-colors group-hover:text-[var(--accent)]"
                  >
                    Einzelteilverfolgung (Seriennummernpflicht)
                  </label>
                </div>

                <div className="space-y-2 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--panel-soft)] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--ink)]">Standard-Lagerplatz</span>
                    {defaultBinId ? (
                      <button
                        type="button"
                        className="text-xs text-[var(--destructive)] hover:underline"
                        onClick={() => {
                          setDefaultBinId(null);
                          setDefaultBinWarehouseId(null);
                          setDefaultBinZoneId(null);
                        }}
                        data-testid="product-form-remove-default-bin"
                      >
                        Entfernen
                      </button>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      className="input w-full text-xs"
                      value={defaultBinWarehouseId ?? ""}
                      onChange={(event) => {
                        setDefaultBinWarehouseId(event.target.value ? Number(event.target.value) : null);
                        setDefaultBinZoneId(null);
                        setDefaultBinId(null);
                      }}
                      data-testid="product-form-default-bin-warehouse"
                    >
                      <option value="">Lager...</option>
                      {(warehousesQuery.data ?? []).map((w: any) => (
                        <option key={w.id} value={w.id}>
                          {w.code}
                        </option>
                      ))}
                    </select>
                    <select
                      className="input w-full text-xs"
                      value={defaultBinZoneId ?? ""}
                      onChange={(event) => {
                        setDefaultBinZoneId(event.target.value ? Number(event.target.value) : null);
                        setDefaultBinId(null);
                      }}
                      disabled={!defaultBinWarehouseId}
                      data-testid="product-form-default-bin-zone"
                    >
                      <option value="">Zone...</option>
                      {(defaultBinZonesQuery.data ?? []).map((z: any) => (
                        <option key={z.id} value={z.id}>
                          {z.code}
                        </option>
                      ))}
                    </select>
                    <select
                      className="input w-full text-xs"
                      value={defaultBinId ?? ""}
                      onChange={(event) => setDefaultBinId(event.target.value ? Number(event.target.value) : null)}
                      disabled={!defaultBinZoneId}
                      data-testid="product-form-default-bin-select"
                    >
                      <option value="">Platz...</option>
                      {(defaultBinBinsQuery.data ?? []).map((b: any) => (
                        <option key={b.id} value={b.id}>
                          {b.code}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 pb-2">
            <div className="h-px bg-[var(--line)] w-full"></div>
          </div>

          <label className="space-y-1.5 block">
            <span className="text-sm font-medium text-[var(--ink)]">Beschreibung</span>
            <textarea
              className="input min-h-[120px] w-full transition-all focus:ring-2 ring-[var(--accent)]/20 resize-y"
              value={productForm.description}
              onChange={(event) =>
                setProductForm((prev: any) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
              data-testid="product-form-description"
              placeholder="Detaillierte Produktbeschreibung..."
            />
          </label>

          <div className="pt-6 flex justify-end">
            <button
              className="btn btn-primary w-full md:w-auto min-w-[180px] shadow-lg shadow-[var(--accent)]/20"
              type="submit"
              disabled={pending || !isAdmin}
              data-testid="product-form-submit"
            >
              {pending ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              {isEditMode ? "Änderungen speichern" : "Artikel anlegen und weiter"}
            </button>
          </div>
        </form>
      </div>
    </ProductMasterTab>
  );
}
