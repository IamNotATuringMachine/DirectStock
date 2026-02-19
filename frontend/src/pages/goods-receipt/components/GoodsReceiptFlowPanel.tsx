import ScanFeedback from "../../../components/scanner/ScanFeedback";
import WorkflowScanInput from "../../../components/scanner/WorkflowScanInput";

type FlowCondition = "new" | "defective" | "needs_repair";

function FlowProgress({ vm }: { vm: any }) {
  return (
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
  );
}

function QuantityStep({ vm }: { vm: any }) {
  return (
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
            {(["new", "defective", "needs_repair"] as FlowCondition[]).map((condition) => (
              <button
                key={condition}
                type="button"
                className={`btn py-2 text-xs ${vm.flowCondition === condition ? "btn-primary" : "btn-ghost border border-[var(--line)]"}`}
                onClick={() => vm.setFlowCondition(condition)}
                data-testid={`goods-receipt-flow-condition-${condition}`}
              >
                {condition === "new" ? "Neuware" : condition === "defective" ? "Defekt" : "Reparaturbedarf"}
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
      <button className="btn btn-primary w-full justify-center py-3" onClick={() => vm.setFlowStep("bin_scan")}>
        Weiter zu Lagerplatz-Scan
      </button>
    </div>
  );
}

function selectBinSuggestion(vm: any, suggestion: any) {
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
}

function BinScanStep({ vm }: { vm: any }) {
  return (
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
                onClick={() => selectBinSuggestion(vm, suggestion)}
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
                <span className="text-xs text-[var(--muted)] shrink-0">{suggestion.current_quantity} Stk.</span>
              </button>
            ))}
          </div>
          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-[var(--line)]"></span>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[var(--panel)] px-2 text-[var(--muted)] font-medium">oder manuell scannen</span>
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
  );
}

function ConfirmStep({ vm }: { vm: any }) {
  return (
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
  );
}

export function GoodsReceiptFlowPanel({ vm }: { vm: any }) {
  return (
    <>
      <FlowProgress vm={vm} />

      <div className="flex-1 flex flex-col justify-center min-h-[200px]">
        {vm.flowStep === "product_scan" ? (
          <WorkflowScanInput
            enabled
            isLoading={vm.flowLoading}
            label="Artikel scannen (QR/EAN)"
            placeholder="Artikelcode scannen"
            onScan={(value) => vm.onFlowProductScan(value)}
            testIdPrefix="goods-receipt-flow-product-scan"
          />
        ) : null}

        {vm.flowStep === "quantity" ? <QuantityStep vm={vm} /> : null}
        {vm.flowStep === "bin_scan" ? <BinScanStep vm={vm} /> : null}
        {vm.flowStep === "confirm" ? <ConfirmStep vm={vm} /> : null}
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
    </>
  );
}
