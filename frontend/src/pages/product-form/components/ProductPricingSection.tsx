import { Info, Loader2, Save } from "lucide-react";

import { formatPriceAmount } from "../model";
import { ProductPricingTab } from "./ProductPricingTab";

export function ProductPricingSection({ vm }: { vm: any }) {
  const {
    activeTab,
    canReadPricing,
    isEditMode,
    onCreateBasePrice,
    basePriceNet,
    setBasePriceNet,
    basePriceVatRate,
    setBasePriceVatRate,
    basePriceGrossPreview,
    basePriceError,
    canWritePricing,
    createProductBasePriceMutation,
    productBasePricesQuery,
    activeBasePriceId,
    renderCreateWizardFooter,
  } = vm;

  if (activeTab !== "pricing" || !canReadPricing) {
    return null;
  }

  return (
    <ProductPricingTab>
      <div className="space-y-6" data-testid="product-form-pricing-panel">
        {!isEditMode && (
          <div className="flex items-center gap-4 p-5 rounded-xl bg-amber-50 text-black border border-amber-200 shadow-sm">
            <Info size={24} className="shrink-0 text-amber-600" />
            <div>
              <h4 className="font-semibold">Artikel noch nicht erstellt</h4>
              <p className="text-sm text-black mt-1">
                Bitte speichern Sie den Artikel zuerst, um Basispreise zu hinterlegen.
              </p>
            </div>
          </div>
        )}

        {isEditMode && (
          <>
            <section className="card p-6 border border-[var(--line)] bg-[var(--panel)] shadow-sm rounded-xl">
              <h3 className="text-lg font-semibold text-[var(--ink)] mb-5">Basispreis (für alle Kunden)</h3>
              <form className="space-y-4" onSubmit={(event) => void onCreateBasePrice(event)}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <label className="space-y-1.5">
                    <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide">Nettopreis</span>
                    <input
                      className="input w-full"
                      type="number"
                      min="0"
                      step="0.01"
                      value={basePriceNet}
                      onChange={(event) => setBasePriceNet(event.target.value)}
                      data-testid="product-pricing-net-input"
                      placeholder="0.00"
                      disabled={!canWritePricing}
                      required
                    />
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide">USt</span>
                    <select
                      className="input w-full"
                      value={basePriceVatRate}
                      onChange={(event) => setBasePriceVatRate(event.target.value)}
                      data-testid="product-pricing-vat-select"
                      disabled={!canWritePricing}
                    >
                      <option value="0">0%</option>
                      <option value="7">7%</option>
                      <option value="19">19%</option>
                    </select>
                  </label>

                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide">
                      Brutto (Vorschau)
                    </span>
                    <div
                      className="input w-full bg-[var(--panel-soft)] flex items-center"
                      data-testid="product-pricing-gross-preview"
                    >
                      {basePriceGrossPreview ? `${basePriceGrossPreview} EUR` : "-"}
                    </div>
                  </div>
                </div>

                {basePriceError ? <p className="text-sm text-red-600">{basePriceError}</p> : null}

                {!canWritePricing ? (
                  <p className="text-sm text-[var(--muted)]">Keine Berechtigung zum Schreiben von Preisen.</p>
                ) : null}

                <div className="flex justify-end">
                  <button
                    className="btn btn-primary min-w-[180px]"
                    type="submit"
                    disabled={createProductBasePriceMutation.isPending || !canWritePricing}
                    data-testid="product-pricing-save-btn"
                  >
                    {createProductBasePriceMutation.isPending ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Save size={16} />
                    )}
                    Preis speichern
                  </button>
                </div>
              </form>
            </section>

            <section
              className="card p-6 border border-[var(--line)] bg-[var(--panel)] shadow-sm rounded-xl"
              data-testid="product-pricing-history"
            >
              <h3 className="text-lg font-semibold text-[var(--ink)] mb-4">Preis-Historie</h3>

              {productBasePricesQuery.isLoading ? (
                <p className="text-sm text-[var(--muted)]">Preise werden geladen...</p>
              ) : (productBasePricesQuery.data?.length ?? 0) === 0 ? (
                <p className="text-sm text-[var(--muted)]">Noch kein Basispreis vorhanden.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[var(--muted)] border-b border-[var(--line)]">
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4">Netto</th>
                        <th className="py-2 pr-4">USt</th>
                        <th className="py-2 pr-4">Brutto</th>
                        <th className="py-2 pr-4">Gültig ab</th>
                        <th className="py-2 pr-4">Gültig bis</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(productBasePricesQuery.data ?? []).map((price: any) => (
                        <tr key={price.id} className="border-b border-[var(--line)]/50">
                          <td className="py-2 pr-4">
                            {activeBasePriceId === price.id ? (
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-green-100 text-green-800 border border-green-200">
                                Aktuell
                              </span>
                            ) : (
                              <span className="text-[var(--muted)] text-xs">Historisch</span>
                            )}
                          </td>
                          <td className="py-2 pr-4">
                            {formatPriceAmount(price.net_price)} {price.currency}
                          </td>
                          <td className="py-2 pr-4">{price.vat_rate}%</td>
                          <td className="py-2 pr-4">
                            {formatPriceAmount(price.gross_price)} {price.currency}
                          </td>
                          <td className="py-2 pr-4">
                            {price.valid_from ? new Date(price.valid_from).toLocaleString() : "-"}
                          </td>
                          <td className="py-2 pr-4">
                            {price.valid_to ? new Date(price.valid_to).toLocaleString() : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            {renderCreateWizardFooter("pricing")}
          </>
        )}
      </div>
    </ProductPricingTab>
  );
}
