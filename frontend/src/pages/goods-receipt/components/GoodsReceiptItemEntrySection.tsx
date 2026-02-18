import ScanFeedback from "../../../components/scanner/ScanFeedback";
import WorkflowScanInput from "../../../components/scanner/WorkflowScanInput";
import { ScanFlowPanel } from "./ScanFlowPanel";

export function GoodsReceiptItemEntrySection({ vm }: { vm: any }) {
  return (
    <ScanFlowPanel>
      <div className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm flex flex-col h-auto min-h-[500px] lg:h-[calc(100vh-200px)] overflow-hidden">
        <div className="p-4 border-b border-[var(--line)] bg-[var(--panel-soft)]">
          <h3 className="section-title">2. Scanner-Workflow</h3>
        </div>

        <div className="p-6 flex-1 flex flex-col relative overflow-y-auto">
          <div className="mb-6">
            <div className="flex justify-between text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">
              <span>Fortschritt</span>
              <span>{Math.round(vm.flowProgress)}%</span>
            </div>
            <div className="h-2 w-full bg-[var(--line)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--accent)] transition-all duration-300 ease-out"
                style={{ width: `${vm.flowProgress}%` }}
              />
            </div>
            <div className="flex justify-between mt-3">
              {vm.flowSteps.map((step: any, index: number) => (
                <span
                  key={step.id}
                  className={`text-xs px-2 py-1 rounded transition-colors ${index <= vm.flowStepIndex ? "text-[var(--ink)] font-medium bg-[var(--panel-strong)]" : "text-[var(--muted)]"}`}
                >
                  {step.label}
                </span>
              ))}
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center min-h-[200px]">
            {vm.flowStep === "product_scan" && (
              <WorkflowScanInput
                enabled
                isLoading={vm.flowLoading}
                label="Artikel scannen (QR/EAN)"
                placeholder="Artikelcode scannen"
                onScan={(value) => vm.onFlowProductScan(value)}
                testIdPrefix="goods-receipt-flow-product-scan"
              />
            )}

            {vm.flowStep === "quantity" && (
              <div className="space-y-4 animate-in fade-in zoom-in duration-300">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--muted)]">Menge erfassen</label>
                  <input
                    className="input w-full text-lg p-3"
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={vm.flowQuantity}
                    onChange={(event) => vm.setFlowQuantity(event.target.value)}
                    data-testid="goods-receipt-flow-quantity-input"
                    autoFocus
                  />
                </div>
                {vm.conditionRequiredForCurrentReceipt ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--muted)]">Zustand</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["new", "defective", "needs_repair"] as const).map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={`btn py-2 text-xs ${vm.flowCondition === c ? "btn-primary" : "btn-ghost border border-[var(--line)]"}`}
                          onClick={() => vm.setFlowCondition(c)}
                          data-testid={`goods-receipt-flow-condition-${c}`}
                        >
                          {c === "new" ? "Neuware" : c === "defective" ? "Defekt" : "Reparaturbedarf"}
                        </button>
                      ))}
                    </div>
                    {vm.flowCondition !== "new" ? (
                      <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                        Artikel wird direkt ins RepairCenter gebucht
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <button
                  className="btn btn-primary w-full justify-center py-3"
                  onClick={() => vm.setFlowStep("bin_scan")}
                >
                  Weiter zu Lagerplatz-Scan
                </button>
              </div>
            )}

            {vm.flowStep === "bin_scan" && (
              <div className="space-y-4 animate-in fade-in zoom-in duration-300">
                {(vm.binSuggestionsQuery.data?.length ?? 0) > 0 ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--muted)]">Vorgeschlagene Lagerplätze</label>
                    <div className="space-y-1.5">
                      {(vm.binSuggestionsQuery.data ?? []).map((suggestion: any) => (
                        <button
                          key={suggestion.bin_id}
                          type="button"
                          className="w-full text-left p-2.5 rounded border border-[var(--line)] hover:border-[var(--accent)] hover:bg-[var(--panel-soft)] transition-colors flex items-center justify-between gap-2"
                          onClick={() => {
                            const selectedBin = {
                              id: suggestion.bin_id,
                              zone_id: suggestion.zone_id,
                              code: suggestion.bin_code,
                              bin_type: "storage",
                              max_weight: null,
                              max_volume: null,
                              qr_code_data: null,
                              is_active: true,
                              is_occupied: false,
                              occupied_quantity: suggestion.current_quantity,
                              created_at: "",
                              updated_at: "",
                            };
                            vm.setFlowBin(selectedBin);
                            vm.setSelectedBinId(String(suggestion.bin_id));
                            vm.setFlowStep("confirm");
                            vm.setFlowFeedback("success", `Lagerplatz ausgewählt: ${suggestion.bin_code}`);
                          }}
                          data-testid={`goods-receipt-bin-suggestion-${suggestion.bin_id}`}
                        >
                          <div>
                            <div className="font-medium text-sm text-[var(--ink)]">
                              {suggestion.bin_code}
                              {suggestion.priority === "default" ? (
                                <span className="ml-2 inline-block px-1.5 py-0.5 text-xs rounded bg-emerald-100 text-emerald-800">
                                  Standard
                                </span>
                              ) : null}
                            </div>
                            <div className="text-xs text-[var(--muted)]">
                              {suggestion.warehouse_code} / {suggestion.zone_code}
                            </div>
                          </div>
                          <span className="text-xs text-[var(--muted)] shrink-0">
                            {suggestion.current_quantity} Stk.
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="relative my-2">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-[var(--line)]"></span>
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-[var(--panel)] px-2 text-[var(--muted)] font-medium">
                          oder manuell scannen
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null}
                <WorkflowScanInput
                  enabled
                  isLoading={vm.flowLoading}
                  label="Lagerplatz scannen"
                  placeholder="Lagerplatzcode scannen"
                  onScan={(value) => vm.onFlowBinScan(value)}
                  testIdPrefix="goods-receipt-flow-bin-scan"
                />
              </div>
            )}

            {vm.flowStep === "confirm" && (
              <div className="space-y-4 animate-in fade-in zoom-in duration-300">
                <div className="bg-[var(--panel-soft)] p-4 rounded-[var(--radius-md)] border border-[var(--line)] space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-[var(--muted)]">Produkt:</span>
                    <span className="font-medium text-[var(--ink)] text-right max-w-[60%] truncate">
                      {vm.flowProduct?.product_number}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-[var(--muted)]">Menge:</span>
                    <span className="font-bold text-[var(--accent)] text-lg">{vm.flowQuantity}</span>
                  </div>
                  <div className="flex justify-between border-t border-[var(--line)] pt-2">
                    <span className="text-sm text-[var(--muted)]">Zielplatz:</span>
                    <span className="font-medium text-[var(--ink)]">{vm.flowBin?.code}</span>
                  </div>
                  {vm.conditionRequiredForCurrentReceipt && vm.flowCondition !== "new" ? (
                    <div
                      className={`flex justify-between border-t border-[var(--line)] pt-2 ${vm.flowCondition === "defective" ? "text-red-700" : "text-amber-700"}`}
                    >
                      <span className="text-sm">Zustand:</span>
                      <span className="font-medium text-sm">
                        {vm.flowCondition === "defective" ? "Defekt" : "Reparaturbedarf"}
                      </span>
                    </div>
                  ) : null}
                </div>

                <button
                  className="btn btn-primary w-full justify-center py-3"
                  onClick={() => void vm.onConfirmFlowItem()}
                  disabled={vm.createItemMutation.isPending}
                >
                  Position bestätigen
                </button>
              </div>
            )}
          </div>

          <div className="mt-6">
            <ScanFeedback status={vm.flowFeedbackStatus} message={vm.flowFeedbackMessage} />
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-[var(--line)]"></span>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[var(--panel)] px-2 text-[var(--muted)] font-medium">Oder manuell</span>
            </div>
          </div>

          <form
            className="flex flex-col gap-4 bg-[var(--panel-soft)] p-4 rounded-[var(--radius-md)] border border-[var(--line)]"
            onSubmit={(event) => void vm.onAddItem(event)}
            data-testid="goods-receipt-item-form"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                className="input w-full md:col-span-2"
                value={vm.productSearch}
                onChange={(event) => vm.setProductSearch(event.target.value)}
                placeholder="Artikel suchen (Nummer, Name, Beschreibung)"
                data-testid="goods-receipt-product-search-input"
              />
              <select
                className="input w-full md:col-span-2"
                value={vm.selectedProductId}
                onChange={(event) => vm.setSelectedProductId(event.target.value)}
                required
                data-testid="goods-receipt-product-select"
              >
                <option value="">Artikel wählen</option>
                {vm.filteredProducts.map((product: any) => (
                  <option key={product.id} value={product.id}>
                    {product.product_number} - {product.name}
                  </option>
                ))}
              </select>

              {vm.selectedReceipt?.purchase_order_id ? (
                <select
                  className="input w-full md:col-span-2"
                  value={vm.selectedPurchaseOrderItemId}
                  onChange={(event) => vm.setSelectedPurchaseOrderItemId(event.target.value)}
                  required
                  data-testid="goods-receipt-po-item-select"
                >
                  <option value="">PO-Position wählen</option>
                  {(vm.purchaseOrderItemsQuery.data ?? [])
                    .filter((poItem: any) => poItem.product_id === Number(vm.selectedProductId))
                    .map((poItem: any) => (
                      <option key={poItem.id} value={poItem.id}>
                        #{poItem.id} - bestellt {poItem.ordered_quantity} {poItem.unit} / erhalten{" "}
                        {poItem.received_quantity}
                      </option>
                    ))}
                </select>
              ) : null}

              {vm.canQuickCreateProduct ? (
                <button
                  className="btn btn-ghost md:col-span-2 justify-start"
                  type="button"
                  onClick={() => vm.setShowAdHocModal(true)}
                  disabled={!vm.selectedReceiptId || vm.selectedReceipt?.status !== "draft"}
                  data-testid="goods-receipt-adhoc-product-btn"
                >
                  Artikel ad-hoc anlegen
                </button>
              ) : null}

              <select
                className="input w-full"
                value={vm.selectedWarehouseId ?? ""}
                onChange={(event) => {
                  vm.setSelectedWarehouseId(Number(event.target.value));
                  vm.setSelectedZoneId(null);
                  vm.setSelectedBinId("");
                }}
                data-testid="goods-receipt-warehouse-select"
              >
                {(vm.warehousesQuery.data ?? []).map((warehouse: any) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.code}
                  </option>
                ))}
              </select>

              <select
                className="input w-full"
                value={vm.selectedZoneId ?? ""}
                onChange={(event) => {
                  vm.setSelectedZoneId(Number(event.target.value));
                  vm.setSelectedBinId("");
                }}
                data-testid="goods-receipt-zone-select"
              >
                <option value="">Zone...</option>
                {(vm.zonesQuery.data ?? []).map((zone: any) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.code}
                  </option>
                ))}
              </select>

              <select
                className="input w-full"
                value={vm.selectedBinId}
                onChange={(event) => vm.setSelectedBinId(event.target.value)}
                data-testid="goods-receipt-bin-select"
              >
                <option value="">Platz...</option>
                {(vm.binsQuery.data ?? []).map((bin: any) => (
                  <option key={bin.id} value={bin.id}>
                    {bin.code}
                  </option>
                ))}
              </select>

              {vm.canCreateBins && vm.selectedZoneId ? (
                <div className="md:col-span-2 grid grid-cols-[1fr_auto] gap-2">
                  <input
                    className="input w-full"
                    value={vm.newBinCode}
                    onChange={(event) => vm.setNewBinCode(event.target.value)}
                    placeholder="Neuen Überlauf-Platz anlegen (Code)"
                    data-testid="goods-receipt-new-bin-code-input"
                  />
                  <button
                    type="button"
                    className="btn btn-ghost border border-[var(--line)]"
                    disabled={vm.createBinMutation.isPending || !vm.newBinCode.trim()}
                    onClick={() =>
                      vm.selectedZoneId &&
                      void vm.createBinMutation.mutateAsync({ zoneId: vm.selectedZoneId, code: vm.newBinCode.trim() })
                    }
                    data-testid="goods-receipt-create-bin-btn"
                  >
                    Platz anlegen
                  </button>
                </div>
              ) : null}

              <input
                className="input w-full"
                type="number"
                min="0.001"
                step="0.001"
                value={vm.receivedQuantity}
                onChange={(event) => vm.setReceivedQuantity(event.target.value)}
                required
                data-testid="goods-receipt-quantity-input"
                placeholder="Menge"
              />

              {vm.selectedProduct?.requires_item_tracking ? (
                <div className="md:col-span-2 space-y-2">
                  <WorkflowScanInput
                    enabled
                    isLoading={false}
                    label={`Seriennummern einzeln scannen (${vm.scannedSerials.length}/${vm.receivedQuantity || "0"})`}
                    placeholder="Seriennummer scannen"
                    onScan={(value) => vm.addScannedSerial(value)}
                    testIdPrefix="goods-receipt-serial-scan"
                  />
                  {vm.scannedSerials.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 border border-[var(--line)] rounded p-2 bg-[var(--panel)]">
                      {vm.scannedSerials.map((serial: string) => (
                        <button
                          key={serial}
                          type="button"
                          className="text-xs px-2 py-1 rounded border border-[var(--line)] bg-[var(--panel-soft)]"
                          onClick={() =>
                            vm.setScannedSerials((prev: string[]) => prev.filter((entry) => entry !== serial))
                          }
                        >
                          {serial} ×
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <textarea
                    className="input w-full min-h-[90px]"
                    value={vm.serialNumbersInput}
                    onChange={(event) => vm.setSerialNumbersInput(event.target.value)}
                    required={vm.scannedSerials.length === 0}
                    data-testid="goods-receipt-serial-input"
                    placeholder="Oder Seriennummern einfügen (eine pro Zeile oder komma-separiert)"
                  />
                </div>
              ) : null}

              {vm.conditionRequiredForCurrentReceipt ? (
                <select
                  className="input w-full md:col-span-2"
                  value={vm.manualCondition}
                  onChange={(event) =>
                    vm.setManualCondition(event.target.value as "" | "new" | "defective" | "needs_repair")
                  }
                  required
                  data-testid="goods-receipt-manual-condition-select"
                >
                  <option value="">Zustand wählen...</option>
                  <option value="new">Neuware</option>
                  <option value="defective">Defekt</option>
                  <option value="needs_repair">Reparaturbedarf</option>
                </select>
              ) : null}
            </div>

            <button
              className="btn w-full justify-center"
              type="submit"
              disabled={
                !vm.selectedReceiptId ||
                (vm.selectedReceipt !== null && vm.selectedReceipt.status !== "draft") ||
                vm.createItemMutation.isPending
              }
              data-testid="goods-receipt-add-item-btn"
            >
              Position hinzufügen
            </button>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-4 border-t border-[var(--line)]">
            <button
              className="btn btn-ghost w-full justify-center text-[var(--destructive)] hover:bg-red-50"
              type="button"
              disabled={!vm.selectedReceiptId || vm.selectedReceipt?.status !== "draft" || vm.deleteMutation.isPending}
              onClick={() => {
                if (!vm.selectedReceiptId) {
                  return;
                }
                if (!window.confirm("Diesen Draft-Beleg wirklich loeschen?")) {
                  return;
                }
                void vm.deleteMutation.mutateAsync(vm.selectedReceiptId);
              }}
              data-testid="goods-receipt-delete-btn"
            >
              Loeschen
            </button>

            <button
              className="btn btn-ghost w-full justify-center text-[var(--destructive)] hover:bg-red-50"
              type="button"
              disabled={!vm.selectedReceiptId || vm.selectedReceipt?.status !== "draft" || vm.cancelMutation.isPending}
              onClick={() => vm.selectedReceiptId && void vm.cancelMutation.mutateAsync(vm.selectedReceiptId)}
              data-testid="goods-receipt-cancel-btn"
            >
              Stornieren
            </button>

            <button
              className="btn btn-primary w-full justify-center"
              type="button"
              disabled={
                !vm.selectedReceiptId || vm.selectedReceipt?.status !== "draft" || vm.completeMutation.isPending
              }
              onClick={() => vm.selectedReceiptId && void vm.completeMutation.mutateAsync(vm.selectedReceiptId)}
              data-testid="goods-receipt-complete-btn"
            >
              Abschließen
            </button>
          </div>
        </div>
      </div>
    </ScanFlowPanel>
  );
}
