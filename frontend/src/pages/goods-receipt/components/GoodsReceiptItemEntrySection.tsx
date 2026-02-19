import { ScanFlowPanel } from "./ScanFlowPanel";
import { GoodsReceiptFlowPanel } from "./GoodsReceiptFlowPanel";
import { GoodsReceiptManualItemForm } from "./GoodsReceiptManualItemForm";
import { GoodsReceiptReceiptActions } from "./GoodsReceiptReceiptActions";

export function GoodsReceiptItemEntrySection({ vm }: { vm: any }) {
  return (
    <ScanFlowPanel>
      <div className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm flex flex-col h-auto min-h-[500px] lg:h-[calc(100vh-200px)] overflow-hidden">
        <div className="p-4 border-b border-[var(--line)] bg-[var(--panel-soft)]">
          <h3 className="section-title">2. Scanner-Workflow</h3>
        </div>

        <div className="p-6 flex-1 flex flex-col relative overflow-y-auto">
          <GoodsReceiptFlowPanel vm={vm} />
          <GoodsReceiptManualItemForm vm={vm} />
          <GoodsReceiptReceiptActions vm={vm} />
        </div>
      </div>
    </ScanFlowPanel>
  );
}
