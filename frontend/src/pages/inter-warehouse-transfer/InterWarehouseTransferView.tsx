import type { Warehouse } from "../../types";
import { InterWarehouseTransferDetailsPanel, type InterWarehouseTransferDetailsPanelProps } from "./components/InterWarehouseTransferDetailsPanel";
import { InterWarehouseTransferSidebar, type InterWarehouseTransferSidebarProps } from "./components/InterWarehouseTransferSidebar";

type InterWarehouseTransferViewProps = {
  dispatchedTransferCount: number;
  warehouseById: Map<number, Warehouse>;
  sidebarProps: InterWarehouseTransferSidebarProps;
  detailsProps: InterWarehouseTransferDetailsPanelProps;
};

export function InterWarehouseTransferView({
  dispatchedTransferCount,
  warehouseById,
  sidebarProps,
  detailsProps,
}: InterWarehouseTransferViewProps) {
  return (
    <section className="page flex flex-col gap-6" data-testid="inter-warehouse-transfer-page">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="page-title">Zwischenlager-Transfer</h2>
          <p className="section-subtitle mt-1">Standortübergreifende Umlagerungen mit Transit-Status steuern.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] px-4 py-2 flex flex-col items-center min-w-[120px] shadow-sm">
            <span className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Transit</span>
            <span className="text-xl font-bold text-[var(--ink)]">{dispatchedTransferCount}</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <InterWarehouseTransferSidebar {...sidebarProps} warehouseById={warehouseById} />

        <div className="flex flex-col gap-6 lg:col-span-2">
          <InterWarehouseTransferDetailsPanel {...detailsProps} />
        </div>
      </div>
    </section>
  );
}
