import { ArrowRight, Box } from "lucide-react";

import type { StockTransferItem } from "../../../types";

type StockTransferItemsPanelProps = {
  transferItems: StockTransferItem[];
};

export function StockTransferItemsPanel({ transferItems }: StockTransferItemsPanelProps) {
  return (
    <section className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-[var(--line)] bg-[var(--panel-soft)]">
        <h3 className="section-title flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[var(--accent)] text-white text-xs font-bold">3</div>
          Positionen
          <span className="ml-auto text-xs font-mono bg-[var(--bg)] px-2 py-1 rounded border border-[var(--line)] text-[var(--muted)]">
            {transferItems.length}
          </span>
        </h3>
      </div>

      <div className="p-0 flex-1 overflow-y-auto bg-[var(--bg)] min-h-[300px]">
        {transferItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-[var(--muted)] p-8 opacity-60">
            <Box className="w-12 h-12 mb-3 stroke-1" />
            <p className="text-sm">Noch keine Positionen gebucht.</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--line)]">
            {transferItems.map((item) => (
              <div key={item.id} className="p-4 bg-[var(--panel)] hover:bg-[var(--panel-soft)] transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div className="font-medium text-sm text-[var(--ink)] flex items-center gap-2">
                    <Box className="w-4 h-4 text-[var(--accent)]" />
                    Produkt #{item.product_id}
                  </div>
                  <div className="font-mono font-bold text-lg text-[var(--ink)]">{item.quantity}</div>
                </div>
                <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
                  <div className="flex items-center gap-1 bg-[var(--bg)] px-2 py-1 rounded border border-[var(--line)]">
                    <span className="uppercase text-[10px] tracking-wider opacity-70">Von</span>
                    <span className="font-mono font-medium text-[var(--ink)]">{item.from_bin_id}</span>
                  </div>
                  <ArrowRight className="w-3 h-3 opacity-40" />
                  <div className="flex items-center gap-1 bg-[var(--bg)] px-2 py-1 rounded border border-[var(--line)]">
                    <span className="uppercase text-[10px] tracking-wider opacity-70">Nach</span>
                    <span className="font-mono font-medium text-[var(--ink)]">{item.to_bin_id}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
