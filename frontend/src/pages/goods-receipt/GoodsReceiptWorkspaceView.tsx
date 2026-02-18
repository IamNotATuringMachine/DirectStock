import { AdHocProductModal } from "./components/AdHocProductModal";
import { GoodsReceiptHeaderSection } from "./components/GoodsReceiptHeaderSection";
import { GoodsReceiptItemEntrySection } from "./components/GoodsReceiptItemEntrySection";
import { GoodsReceiptItemsListSection } from "./components/GoodsReceiptItemsListSection";
import { GoodsReceiptReceiptListSection } from "./components/GoodsReceiptReceiptListSection";

export function GoodsReceiptWorkspaceView({ vm }: { vm: any }) {
  return (
    <section className="page flex flex-col gap-6" data-testid="goods-receipt-page">
      <GoodsReceiptHeaderSection />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <GoodsReceiptReceiptListSection vm={vm} />
        <GoodsReceiptItemEntrySection vm={vm} />
        <GoodsReceiptItemsListSection vm={vm} />
      </div>

      {vm.showAdHocModal ? (
        <AdHocProductModal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-xl rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--panel)] p-5">
              <h3 className="section-title mb-4">Ad-hoc Artikelanlage</h3>
              <form className="flex flex-col gap-3" onSubmit={(event) => void vm.onCreateAdHocProduct(event)}>
                <input
                  className="input w-full"
                  value={vm.adHocProductNumber}
                  onChange={(event) => vm.setAdHocProductNumber(event.target.value)}
                  placeholder="Artikelnummer"
                  data-testid="goods-receipt-adhoc-product-number"
                  required
                />
                <input
                  className="input w-full"
                  value={vm.adHocProductName}
                  onChange={(event) => vm.setAdHocProductName(event.target.value)}
                  placeholder="Bezeichnung"
                  data-testid="goods-receipt-adhoc-product-name"
                  required
                />
                <select
                  className="input w-full"
                  value={vm.adHocProductGroupId}
                  onChange={(event) => vm.setAdHocProductGroupId(event.target.value)}
                  data-testid="goods-receipt-adhoc-product-group"
                  disabled={vm.adHocCreateProductGroup}
                >
                  <option value="">Keine Produktgruppe</option>
                  {(vm.productGroupsQuery.data ?? []).map((group: any) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={vm.adHocCreateProductGroup}
                    onChange={(event) => vm.setAdHocCreateProductGroup(event.target.checked)}
                    data-testid="goods-receipt-adhoc-product-create-group"
                  />
                  Neue Produktgruppe anlegen
                </label>
                {vm.adHocCreateProductGroup ? (
                  <input
                    className="input w-full"
                    value={vm.adHocProductGroupName}
                    onChange={(event) => vm.setAdHocProductGroupName(event.target.value)}
                    placeholder="Name der neuen Produktgruppe"
                    data-testid="goods-receipt-adhoc-product-group-name"
                    required
                  />
                ) : null}
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={vm.adHocRequiresTracking}
                    onChange={(event) => vm.setAdHocRequiresTracking(event.target.checked)}
                    data-testid="goods-receipt-adhoc-product-tracking"
                  />
                  Einzelteilverfolgung (Seriennummernpflicht)
                </label>
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => vm.resetAdHocModal()}
                    data-testid="goods-receipt-adhoc-cancel-btn"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={vm.adHocProductMutation.isPending}
                    data-testid="goods-receipt-adhoc-save-btn"
                  >
                    Speichern
                  </button>
                </div>
              </form>
            </div>
          </div>
        </AdHocProductModal>
      ) : null}
    </section>
  );
}
