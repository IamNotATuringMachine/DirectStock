import type { FormEvent } from "react";
import { ScanLine, CheckCircle, Truck } from "lucide-react";

import ScanFeedback from "../../components/scanner/ScanFeedback";
import WorkflowScanInput from "../../components/scanner/WorkflowScanInput";
import type { BinLocation, Customer, CustomerLocation, GoodsIssue, GoodsIssueItem, Product, Warehouse } from "../../types";
import { GoodsIssueDocumentPanel } from "./components/GoodsIssueDocumentPanel";
import { GoodsIssueItemsPanel } from "./components/GoodsIssueItemsPanel";
import { flowSteps, type IssueFlowStep } from "./model";

type GoodsIssueViewProps = {
  customerId: string;
  setCustomerId: (value: string) => void;
  customerLocationId: string;
  setCustomerLocationId: (value: string) => void;
  customerReference: string;
  setCustomerReference: (value: string) => void;
  customers: Customer[];
  customerLocations: CustomerLocation[];
  onCreateIssue: (event: FormEvent) => void;
  createIssuePending: boolean;
  issues: GoodsIssue[];
  selectedIssueId: number | null;
  onSelectIssue: (id: number) => void;
  selectedIssue: GoodsIssue | null;
  flowStep: IssueFlowStep;
  setFlowStep: (step: IssueFlowStep) => void;
  flowProgress: number;
  flowLoading: boolean;
  onFlowSourceBinScan: (value: string) => void | Promise<void>;
  onFlowProductScan: (value: string) => void | Promise<void>;
  flowQuantity: string;
  setFlowQuantity: (value: string) => void;
  availableStock: number;
  remainingAfterIssue: number;
  onConfirmFlowItem: () => void;
  createItemPending: boolean;
  flowSourceBin: BinLocation | null;
  flowProduct: Product | null;
  flowFeedbackStatus: "idle" | "success" | "error";
  flowFeedbackMessage: string | null;
  onCompleteIssue: () => void;
  completePending: boolean;
  onCancelIssue: () => void;
  cancelPending: boolean;
  issueItems: GoodsIssueItem[];
  onAddItem: (event: FormEvent) => void;
  selectedProductId: string;
  setSelectedProductId: (value: string) => void;
  products: Product[];
  selectedWarehouseId: number | null;
  setSelectedWarehouseId: (value: number) => void;
  setSelectedZoneId: (value: number | null) => void;
  setSelectedBinId: (value: string) => void;
  warehouses: Warehouse[];
  selectedBinId: string;
  bins: BinLocation[];
  requestedQuantity: string;
  setRequestedQuantity: (value: string) => void;
};

export function GoodsIssueView({
  customerId,
  setCustomerId,
  customerLocationId,
  setCustomerLocationId,
  customerReference,
  setCustomerReference,
  customers,
  customerLocations,
  onCreateIssue,
  createIssuePending,
  issues,
  selectedIssueId,
  onSelectIssue,
  selectedIssue,
  flowStep,
  setFlowStep,
  flowProgress,
  flowLoading,
  onFlowSourceBinScan,
  onFlowProductScan,
  flowQuantity,
  setFlowQuantity,
  availableStock,
  remainingAfterIssue,
  onConfirmFlowItem,
  createItemPending,
  flowSourceBin,
  flowProduct,
  flowFeedbackStatus,
  flowFeedbackMessage,
  onCompleteIssue,
  completePending,
  onCancelIssue,
  cancelPending,
  issueItems,
  onAddItem,
  selectedProductId,
  setSelectedProductId,
  products,
  selectedWarehouseId,
  setSelectedWarehouseId,
  setSelectedZoneId,
  setSelectedBinId,
  warehouses,
  selectedBinId,
  bins,
  requestedQuantity,
  setRequestedQuantity,
}: GoodsIssueViewProps) {
  const flowStepIndex = flowSteps.findIndex((step) => step.id === flowStep);

  return (
    <section className="page flex flex-col gap-6" data-testid="goods-issue-page">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="page-title">Warenausgang</h2>
          <p className="section-subtitle mt-1 max-w-2xl">
            Beleg anlegen, Entnahme positionieren und Warenausgang durchführen.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <GoodsIssueDocumentPanel
          customerId={customerId}
          setCustomerId={setCustomerId}
          customerLocationId={customerLocationId}
          setCustomerLocationId={setCustomerLocationId}
          customerReference={customerReference}
          setCustomerReference={setCustomerReference}
          customers={customers}
          customerLocations={customerLocations}
          onCreateIssue={onCreateIssue}
          createIssuePending={createIssuePending}
          issues={issues}
          selectedIssueId={selectedIssueId}
          onSelectIssue={onSelectIssue}
        />

        <div className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm flex flex-col h-auto min-h-[500px] lg:h-[calc(100vh-200px)] overflow-hidden">
          <div className="p-4 border-b border-[var(--line)] bg-[var(--panel-soft)]">
            <h3 className="section-title flex items-center gap-2">
              <ScanLine className="w-4 h-4 text-[var(--muted)]" />
              2. Scanner-Workflow
            </h3>
          </div>

          <div className="p-6 flex-1 flex flex-col relative overflow-y-auto">
            {!selectedIssue ? (
              <div className="flex flex-col items-center justify-center text-[var(--muted)] flex-1 text-center opacity-60">
                <Truck className="w-12 h-12 mb-3 opacity-20" />
                <p>Bitte zuerst einen Warenausgang (links) auswählen oder anlegen.</p>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <div className="flex justify-between text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">
                    <span>Fortschritt</span>
                    <span>{Math.round(flowProgress)}%</span>
                  </div>
                  <div className="h-2 w-full bg-[var(--line)] rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--accent)] transition-all duration-300 ease-out" style={{ width: `${flowProgress}%` }} />
                  </div>

                  <div className="flex justify-between mt-3">
                    {flowSteps.map((step, index) => (
                      <span
                        key={step.id}
                        className={`text-xs px-2 py-1 rounded transition-colors ${index <= flowStepIndex ? "text-[var(--ink)] font-medium bg-[var(--panel-strong)]" : "text-[var(--muted)]"}`}
                      >
                        {step.label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex-1 flex flex-col justify-center min-h-[200px]">
                  {flowStep === "source_bin_scan" && (
                    <WorkflowScanInput
                      enabled
                      isLoading={flowLoading}
                      label="Quell-Lagerplatz scannen"
                      placeholder="Lagerplatz-Code..."
                      onScan={(value) => onFlowSourceBinScan(value)}
                      testIdPrefix="goods-issue-flow-source-scan"
                    />
                  )}

                  {flowStep === "product_scan" && (
                    <WorkflowScanInput
                      enabled
                      isLoading={flowLoading}
                      label="Artikel scannen"
                      placeholder="EAN / Code..."
                      onScan={(value) => onFlowProductScan(value)}
                      testIdPrefix="goods-issue-flow-product-scan"
                    />
                  )}

                  {flowStep === "quantity" && (
                    <div className="space-y-4 animate-in fade-in zoom-in duration-300">
                      <div className="bg-[var(--panel-soft)] p-4 rounded-[var(--radius-md)] border border-[var(--line)]">
                        <p className="text-sm text-[var(--muted)] mb-1">Verfügbarer Bestand</p>
                        <p className="text-2xl font-mono font-bold text-[var(--ink)]">{availableStock.toFixed(3)}</p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-[var(--muted)]">Entnahmemenge</label>
                        <input
                          className="input w-full text-lg p-3"
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={flowQuantity}
                          onChange={(event) => setFlowQuantity(event.target.value)}
                          autoFocus
                        />
                      </div>

                      {remainingAfterIssue <= 2 && remainingAfterIssue >= 0 && (
                        <div className="p-3 bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded-[var(--radius-sm)] text-sm flex items-start gap-2">
                          <span className="mt-0.5">⚠️</span>
                          <span>Achtung: Niedriger Restbestand nach Entnahme ({remainingAfterIssue.toFixed(3)}).</span>
                        </div>
                      )}

                      <button className="btn btn-primary w-full justify-center py-3" onClick={() => setFlowStep("confirm")}>
                        Weiter zur Bestätigung
                      </button>
                    </div>
                  )}

                  {flowStep === "confirm" && (
                    <div className="space-y-4 animate-in fade-in zoom-in duration-300">
                      <div className="bg-[var(--panel-soft)] p-4 rounded-[var(--radius-md)] border border-[var(--line)] space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-[var(--muted)]">Quelle:</span>
                          <span className="font-medium text-[var(--ink)]">{flowSourceBin?.code}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-[var(--muted)]">Produkt:</span>
                          <span className="font-medium text-[var(--ink)] text-right max-w-[60%] truncate">{flowProduct?.product_number}</span>
                        </div>
                        <div className="flex justify-between border-t border-[var(--line)] pt-2">
                          <span className="text-sm text-[var(--muted)]">Menge:</span>
                          <span className="font-bold text-[var(--accent)] text-lg">{flowQuantity}</span>
                        </div>
                        <div className="flex justify-between text-xs text-[var(--muted)]">
                          <span>Rest:</span>
                          <span>{remainingAfterIssue.toFixed(3)}</span>
                        </div>
                      </div>

                      <button className="btn btn-primary w-full justify-center py-3" onClick={onConfirmFlowItem} disabled={createItemPending}>
                        Position buchen
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-6">
                  <ScanFeedback status={flowFeedbackStatus} message={flowFeedbackMessage} />
                </div>

                <div className="mt-8 border-t border-[var(--line)] pt-6">
                  <h4 className="text-sm font-semibold text-[var(--muted)] mb-3 uppercase tracking-wider">Erweitert</h4>
                  <div className="grid grid-cols-1 gap-2">
                    <button className="btn w-full justify-center" disabled={!selectedIssueId || selectedIssue.status !== "draft" || completePending} onClick={onCompleteIssue}>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      WA abschließen
                    </button>
                    <button className="btn btn-ghost w-full justify-center text-red-500 hover:text-red-600 hover:bg-red-50" disabled={!selectedIssueId || selectedIssue.status !== "draft" || cancelPending} onClick={onCancelIssue}>
                      WA stornieren
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <GoodsIssueItemsPanel
          issueItems={issueItems}
          onAddItem={onAddItem}
          selectedProductId={selectedProductId}
          setSelectedProductId={setSelectedProductId}
          products={products}
          selectedWarehouseId={selectedWarehouseId}
          setSelectedWarehouseId={setSelectedWarehouseId}
          setSelectedZoneId={setSelectedZoneId}
          setSelectedBinId={setSelectedBinId}
          warehouses={warehouses}
          selectedBinId={selectedBinId}
          bins={bins}
          requestedQuantity={requestedQuantity}
          setRequestedQuantity={setRequestedQuantity}
          selectedIssueId={selectedIssueId}
          selectedIssue={selectedIssue}
          createItemPending={createItemPending}
        />
      </div>
    </section>
  );
}
