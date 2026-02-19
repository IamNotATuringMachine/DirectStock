import type { FormEvent } from "react";
import { Plus, ChevronRight, CheckCircle, ArrowRight, Save, Box } from "lucide-react";

import ScanFeedback from "../../components/scanner/ScanFeedback";
import WorkflowScanInput from "../../components/scanner/WorkflowScanInput";
import type { BinLocation, Product, StockTransfer, StockTransferItem } from "../../types";
import { StockTransferDocumentPanel } from "./components/StockTransferDocumentPanel";
import { StockTransferItemsPanel } from "./components/StockTransferItemsPanel";
import type { TransferFlowStep } from "./hooks/useStockTransferFlow";

type StockTransferViewProps = {
  notes: string;
  setNotes: (value: string) => void;
  selectedTransferId: number | null;
  selectedTransfer: StockTransfer | null;
  transfers: StockTransfer[];
  transferItems: StockTransferItem[];
  onSelectTransfer: (id: number) => void;
  onCreateTransfer: (event: FormEvent) => void;
  createTransferPending: boolean;
  onComplete: () => void;
  completePending: boolean;
  onCancel: () => void;
  cancelPending: boolean;
  flowStep: TransferFlowStep;
  onSetFlowStep: (step: TransferFlowStep) => void;
  flowProgress: number;
  flowLoading: boolean;
  flowSourceBin: BinLocation | null;
  flowTargetBin: BinLocation | null;
  flowProduct: Product | null;
  flowQuantity: string;
  setFlowQuantity: (value: string) => void;
  availableStock: number;
  flowFeedbackStatus: "idle" | "success" | "error";
  flowFeedbackMessage: string | null;
  onFlowSourceBinScan: (value: string) => void | Promise<void>;
  onFlowProductScan: (value: string) => void | Promise<void>;
  onFlowTargetBinScan: (value: string) => void | Promise<void>;
  onConfirmFlowItem: () => void;
  resetFlow: () => void;
  onAddItem: (event: FormEvent) => void;
  products: Product[];
  bins: BinLocation[];
  selectedProductId: string;
  setSelectedProductId: (value: string) => void;
  fromBinId: string;
  setFromBinId: (value: string) => void;
  toBinId: string;
  setToBinId: (value: string) => void;
  quantity: string;
  setQuantity: (value: string) => void;
  createItemPending: boolean;
};

export function StockTransferView({
  notes,
  setNotes,
  selectedTransferId,
  selectedTransfer,
  transfers,
  transferItems,
  onSelectTransfer,
  onCreateTransfer,
  createTransferPending,
  onComplete,
  completePending,
  onCancel,
  cancelPending,
  flowStep,
  onSetFlowStep,
  flowProgress,
  flowLoading,
  flowSourceBin,
  flowTargetBin,
  flowProduct,
  flowQuantity,
  setFlowQuantity,
  availableStock,
  flowFeedbackStatus,
  flowFeedbackMessage,
  onFlowSourceBinScan,
  onFlowProductScan,
  onFlowTargetBinScan,
  onConfirmFlowItem,
  resetFlow,
  onAddItem,
  products,
  bins,
  selectedProductId,
  setSelectedProductId,
  fromBinId,
  setFromBinId,
  toBinId,
  setToBinId,
  quantity,
  setQuantity,
  createItemPending,
}: StockTransferViewProps) {
  return (
    <section className="page flex flex-col gap-6" data-testid="stock-transfer-page">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="page-title">Umlagerung</h2>
          <p className="section-subtitle mt-1">Transferbeleg anlegen und Warenbewegungen erfassen.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <StockTransferDocumentPanel
          notes={notes}
          setNotes={setNotes}
          transfers={transfers}
          selectedTransferId={selectedTransferId}
          selectedTransfer={selectedTransfer}
          onSelectTransfer={onSelectTransfer}
          onCreateTransfer={onCreateTransfer}
          createTransferPending={createTransferPending}
          onComplete={onComplete}
          completePending={completePending}
          onCancel={onCancel}
          cancelPending={cancelPending}
        />

        <section className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b border-[var(--line)] bg-[var(--panel-soft)]">
            <h3 className="section-title flex items-center gap-2">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[var(--accent)] text-white text-xs font-bold">2</div>
              Scanner Workflow
              {selectedTransferId && (
                <span className="ml-auto text-xs font-mono bg-[var(--bg)] px-2 py-1 rounded border border-[var(--line)] text-[var(--muted)]">
                  #{selectedTransferId}
                </span>
              )}
            </h3>
          </div>

          <div className="p-4 space-y-6 flex-1 overflow-y-auto">
            {!selectedTransferId ? (
              <div className="flex flex-col items-center justify-center p-8 text-center h-48 border-2 border-dashed border-[var(--line)] rounded-[var(--radius-md)] bg-[var(--bg)]">
                <Box className="w-10 h-10 text-[var(--muted)] opacity-40 mb-3" />
                <p className="text-[var(--muted)] font-medium">Kein Beleg ausgewählt</p>
                <p className="text-xs text-[var(--muted)] mt-1 opacity-70">Wählen Sie links einen Beleg aus.</p>
              </div>
            ) : selectedTransfer?.status !== "draft" ? (
              <div className="flex flex-col items-center justify-center p-8 text-center h-48 border-2 border-dashed border-[var(--line)] rounded-[var(--radius-md)] bg-[var(--bg)]">
                <CheckCircle className="w-10 h-10 text-emerald-500 mb-3" />
                <p className="text-[var(--ink)] font-medium">Transfer abgeschlossen</p>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <div className="h-1.5 w-full bg-[var(--line)] rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--accent)] transition-all duration-300 ease-out" style={{ width: `${flowProgress}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-[var(--muted)] font-medium uppercase tracking-wider">
                    <span>Start</span>
                    <span>Bestätigung</span>
                  </div>
                </div>

                <div className="bg-[var(--panel-soft)] rounded-[var(--radius-md)] p-4 min-h-[220px] flex flex-col justify-center border border-[var(--line)]">
                  {flowStep === "source_bin_scan" && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                      <WorkflowScanInput enabled isLoading={flowLoading} label="1. Quelle scannen" placeholder="Lagerplatz-Code..." onScan={onFlowSourceBinScan} testIdPrefix="stock-transfer-source-scan" />
                      <p className="text-xs text-[var(--muted)] text-center">Scannen Sie den Lagerplatz zur Entnahme.</p>
                    </div>
                  )}

                  {flowStep === "product_scan" && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                      <WorkflowScanInput enabled isLoading={flowLoading} label="2. Artikel scannen" placeholder="EAN / Nummer..." onScan={onFlowProductScan} testIdPrefix="stock-transfer-product-scan" />
                      <div className="p-3 bg-[var(--panel)] rounded border border-[var(--line)] text-sm shadow-sm">
                        <span className="block text-xs text-[var(--muted)] mb-1 uppercase tracking-wider">Aktuelle Quelle</span>
                        <span className="font-mono font-medium text-[var(--ink)] flex items-center gap-2">
                          <Box className="w-3.5 h-3.5 text-[var(--accent)]" />
                          {flowSourceBin?.code}
                        </span>
                      </div>
                    </div>
                  )}

                  {flowStep === "quantity" && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                      <div>
                        <label className="block text-sm font-medium text-[var(--ink)] mb-2">3. Menge eingeben</label>
                        <div className="flex gap-2">
                          <input
                            className="input text-lg font-mono flex-1 text-center font-bold"
                            type="number"
                            min="0.001"
                            step="0.001"
                            value={flowQuantity}
                            onChange={(event) => setFlowQuantity(event.target.value)}
                            autoFocus
                          />
                          <button className="btn btn-primary px-6" onClick={() => onSetFlowStep("target_bin_scan")}>
                            <ArrowRight className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs px-1">
                        <span className="text-[var(--muted)]">Verfügbar: <strong className="text-[var(--ink)]">{availableStock.toFixed(3)}</strong></span>
                        <span className="text-[var(--muted)]">Einheit: Stk</span>
                      </div>
                    </div>
                  )}

                  {flowStep === "target_bin_scan" && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                      <WorkflowScanInput enabled isLoading={flowLoading} label="4. Ziel scannen" placeholder="Lagerplatz-Code..." onScan={onFlowTargetBinScan} testIdPrefix="stock-transfer-target-scan" />
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="p-2 border border-[var(--line)] rounded bg-[var(--panel)]">
                          <span className="text-[var(--muted)] block uppercase tracking-wider text-[10px] mb-0.5">Menge</span>
                          <strong className="font-mono text-sm text-[var(--ink)]">{flowQuantity}</strong>
                        </div>
                        <div className="p-2 border border-[var(--line)] rounded bg-[var(--panel)]">
                          <span className="text-[var(--muted)] block uppercase tracking-wider text-[10px] mb-0.5">Artikel</span>
                          <strong className="font-mono text-sm text-[var(--ink)] truncate block">{flowProduct?.product_number}</strong>
                        </div>
                      </div>
                    </div>
                  )}

                  {flowStep === "confirm" && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                      <div className="space-y-2 bg-[var(--bg)] p-3 rounded border border-[var(--line)] text-sm">
                        <div className="flex justify-between py-1 border-b border-[var(--line)]">
                          <span className="text-[var(--muted)]">Von</span>
                          <span className="font-mono font-medium">{flowSourceBin?.code}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-[var(--line)]">
                          <span className="text-[var(--muted)]">Nach</span>
                          <span className="font-mono font-medium text-[var(--accent)]">{flowTargetBin?.code}</span>
                        </div>
                        <div className="flex justify-between py-1 pt-2">
                          <span className="font-medium">Menge</span>
                          <span className="font-mono font-bold text-lg">{flowQuantity}</span>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button className="btn flex-1 justify-center" onClick={resetFlow}>Abbrechen</button>
                        <button
                          className="btn btn-primary flex-1 justify-center shadow-lg shadow-emerald-500/20"
                          onClick={onConfirmFlowItem}
                          disabled={createItemPending}
                        >
                          <Save className="w-4 h-4" /> Buchen
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <ScanFeedback status={flowFeedbackStatus} message={flowFeedbackMessage} />

                <details className="group">
                  <summary className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[var(--muted)] uppercase tracking-wider p-2 hover:bg-[var(--panel-soft)] rounded select-none transition-colors">
                    <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" />
                    Manuelle Erfassung
                  </summary>
                  <form className="mt-3 space-y-3 p-3 bg-[var(--bg)] border border-[var(--line)] rounded-[var(--radius-sm)] animate-in slide-in-from-top-2" onSubmit={onAddItem}>
                    <div className="space-y-1">
                      <label className="text-xs text-[var(--muted)]">Artikel</label>
                      <select className="input w-full text-sm py-1.5 h-9" value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)} required>
                        <option value="">Wählen...</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>{product.product_number} {product.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-xs text-[var(--muted)]">Von</label>
                        <select className="input w-full text-sm py-1.5 h-9" value={fromBinId} onChange={(event) => setFromBinId(event.target.value)}>
                          {bins.map((bin) => <option key={bin.id} value={bin.id}>{bin.code}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-[var(--muted)]">Nach</label>
                        <select className="input w-full text-sm py-1.5 h-9" value={toBinId} onChange={(event) => setToBinId(event.target.value)}>
                          {bins.map((bin) => <option key={bin.id} value={bin.id}>{bin.code}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-[var(--muted)] block mb-1">Menge</label>
                      <div className="flex gap-2">
                        <input className="input flex-1 text-sm py-1.5 h-9" type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} required />
                        <button className="btn btn-primary px-3 h-9" type="submit" disabled={createItemPending}><Plus className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </form>
                </details>
              </>
            )}
          </div>
        </section>

        <StockTransferItemsPanel transferItems={transferItems} />
      </div>
    </section>
  );
}
