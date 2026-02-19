import WorkflowScanInput from "../../../components/scanner/WorkflowScanInput";

type ManualCondition = "" | "new" | "defective" | "needs_repair";

export function GoodsReceiptManualItemForm({ vm }: { vm: any }) {
  return (
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
                  #{poItem.id} - bestellt {poItem.ordered_quantity} {poItem.unit} / erhalten {poItem.received_quantity}
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
                    onClick={() => vm.setScannedSerials((prev: string[]) => prev.filter((entry) => entry !== serial))}
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
            onChange={(event) => vm.setManualCondition(event.target.value as ManualCondition)}
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
  );
}
