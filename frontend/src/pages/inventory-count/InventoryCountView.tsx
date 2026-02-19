import { InventoryCountItemsTable, type InventoryCountItemsTableProps } from "./components/InventoryCountItemsTable";
import { InventoryCountActionsPanel, type InventoryCountActionsPanelProps } from "./components/InventoryCountActionsPanel";
import { InventoryCountQuickCapturePanel, type InventoryCountQuickCapturePanelProps } from "./components/InventoryCountQuickCapturePanel";
import { InventoryCountSessionsPanel, type InventoryCountSessionsPanelProps } from "./components/InventoryCountSessionsPanel";

type InventoryCountViewProps = {
  sessionsPanelProps: InventoryCountSessionsPanelProps;
  actionsPanelProps: InventoryCountActionsPanelProps;
  quickCapturePanelProps: InventoryCountQuickCapturePanelProps;
  itemsTableProps: InventoryCountItemsTableProps;
};

export function InventoryCountView({
  sessionsPanelProps,
  actionsPanelProps,
  quickCapturePanelProps,
  itemsTableProps,
}: InventoryCountViewProps) {
  return (
    <section className="page" data-testid="inventory-count-page">
      <div className="space-y-8 max-w-[1600px] mx-auto">
        <header className="panel-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="page-title">Inventur</h2>
            <p className="section-subtitle mt-1">Stichtag- und permanente Inventur mit Nachzähl-Logik.</p>
          </div>
        </header>

        <div className="warehouse-grid grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          <InventoryCountSessionsPanel {...sessionsPanelProps} />
          <InventoryCountActionsPanel {...actionsPanelProps} />
          <InventoryCountQuickCapturePanel {...quickCapturePanelProps} />
        </div>

        <InventoryCountItemsTable {...itemsTableProps} />
      </div>
    </section>
  );
}
