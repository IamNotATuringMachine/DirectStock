import { Info, Save, Trash2, Warehouse } from "lucide-react";

import { emptyWarehouseSettingForm } from "../model";
import { ProductWarehouseTab } from "./ProductWarehouseTab";

export function ProductWarehouseSection({ vm }: { vm: any }) {
  const {
    activeTab,
    isEditMode,
    warehousesQuery,
    warehouseFormById,
    setWarehouseFormById,
    onClearWarehouseSetting,
    onSaveWarehouseSetting,
    pending,
    isAdmin,
    renderCreateWizardFooter,
  } = vm;

  if (activeTab !== "warehouse") {
    return null;
  }

  return (
    <ProductWarehouseTab>
      <div className="space-y-8" data-testid="product-form-warehouse-tab">
        {!isEditMode && (
          <div className="flex items-center gap-4 p-5 rounded-xl bg-amber-50 text-black border border-amber-200 shadow-sm">
            <Info size={24} className="shrink-0 text-amber-600" />
            <div>
              <h4 className="font-semibold">Artikel noch nicht erstellt</h4>
              <p className="text-sm text-black mt-1">
                Bitte speichern Sie den Artikel zuerst, um spezifische Lagerdaten verwalten zu können.
              </p>
            </div>
          </div>
        )}

        {isEditMode && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {(warehousesQuery.data ?? []).map((warehouse: any) => {
                const form = warehouseFormById[warehouse.id] ?? emptyWarehouseSettingForm();

                return (
                  <div
                    key={warehouse.id}
                    className="card border border-[var(--line)] bg-[var(--panel)] shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden"
                    data-testid={`product-warehouse-setting-${warehouse.id}`}
                  >
                    <div className="bg-[var(--panel-soft)] border-b border-[var(--line)] px-6 py-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[var(--panel)] border border-[var(--line)] flex items-center justify-center text-[var(--accent)] shadow-sm">
                          <Warehouse size={20} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-[var(--ink)] text-lg leading-tight">{warehouse.name}</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-mono bg-[var(--line)] px-1.5 py-0.5 rounded text-[var(--muted)]">
                              {warehouse.code}
                            </span>
                            <span className="text-xs text-[var(--muted)]">Lager #{warehouse.id}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
                        {/* Row 1 - Main Info */}
                        <label className="space-y-1.5">
                          <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide">
                            EAN Code
                          </span>
                          <div className="relative">
                            <input
                              className="input w-full text-sm h-10"
                              value={form.ean}
                              onChange={(event) =>
                                setWarehouseFormById((prev: any) => ({
                                  ...prev,
                                  [warehouse.id]: {
                                    ...form,
                                    ean: event.target.value,
                                  },
                                }))
                              }
                              placeholder="-"
                            />
                          </div>
                        </label>
                        <label className="space-y-1.5">
                          <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide">
                            Lead Time (Tage)
                          </span>
                          <input
                            className="input w-full text-sm h-10"
                            type="number"
                            min="0"
                            step="1"
                            value={form.leadTimeDays}
                            onChange={(event) =>
                              setWarehouseFormById((prev: any) => ({
                                ...prev,
                                [warehouse.id]: {
                                  ...form,
                                  leadTimeDays: event.target.value,
                                },
                              }))
                            }
                            placeholder="0"
                          />
                        </label>
                        <div className="hidden md:block" />

                        {/* Row 2 - Stock Levels */}
                        <div className="md:col-span-3 border-t border-[var(--line)] my-2"></div>

                        <label className="space-y-1.5">
                          <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-red-500"></div> Mindestbestand
                          </span>
                          <input
                            className="input w-full text-sm h-10"
                            type="number"
                            min="0"
                            step="0.001"
                            value={form.minStock}
                            onChange={(event) =>
                              setWarehouseFormById((prev: any) => ({
                                ...prev,
                                [warehouse.id]: {
                                  ...form,
                                  minStock: event.target.value,
                                },
                              }))
                            }
                            placeholder="0.000"
                          />
                        </label>
                        <label className="space-y-1.5">
                          <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-amber-500"></div> Meldebestand
                          </span>
                          <input
                            className="input w-full text-sm h-10"
                            type="number"
                            min="0"
                            step="0.001"
                            value={form.reorderPoint}
                            onChange={(event) =>
                              setWarehouseFormById((prev: any) => ({
                                ...prev,
                                [warehouse.id]: {
                                  ...form,
                                  reorderPoint: event.target.value,
                                },
                              }))
                            }
                            placeholder="0.000"
                          />
                        </label>
                        <label className="space-y-1.5">
                          <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div> Sicherheitsbestand
                          </span>
                          <input
                            className="input w-full text-sm h-10"
                            type="number"
                            min="0"
                            step="0.001"
                            value={form.safetyStock}
                            onChange={(event) =>
                              setWarehouseFormById((prev: any) => ({
                                ...prev,
                                [warehouse.id]: {
                                  ...form,
                                  safetyStock: event.target.value,
                                },
                              }))
                            }
                            placeholder="0.000"
                          />
                        </label>

                        <label className="space-y-1.5">
                          <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide">
                            Maximalbestand
                          </span>
                          <input
                            className="input w-full text-sm h-10"
                            type="number"
                            min="0"
                            step="0.001"
                            value={form.maxStock}
                            onChange={(event) =>
                              setWarehouseFormById((prev: any) => ({
                                ...prev,
                                [warehouse.id]: {
                                  ...form,
                                  maxStock: event.target.value,
                                },
                              }))
                            }
                            placeholder="0.000"
                          />
                        </label>
                      </div>

                      <div className="flex justify-end gap-3 pt-4 border-t border-[var(--line)]">
                        <button
                          className="btn btn-sm text-sm text-[var(--danger)] hover:bg-red-50 hover:border-red-200"
                          type="button"
                          onClick={() => void onClearWarehouseSetting(warehouse.id)}
                          disabled={pending || !isAdmin}
                          data-testid={`product-warehouse-clear-${warehouse.id}`}
                        >
                          <Trash2 size={14} />
                          Zurücksetzen
                        </button>
                        <button
                          className="btn btn-sm text-sm btn-primary shadow-sm"
                          type="button"
                          onClick={() => void onSaveWarehouseSetting(warehouse.id)}
                          disabled={pending || !isAdmin}
                          data-testid={`product-warehouse-save-${warehouse.id}`}
                        >
                          <Save size={14} />
                          Speichern
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {renderCreateWizardFooter("warehouse")}
          </div>
        )}
      </div>
    </ProductWarehouseTab>
  );
}
