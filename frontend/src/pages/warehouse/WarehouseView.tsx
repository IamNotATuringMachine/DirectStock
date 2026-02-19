import type { WarehouseWarehousesPanelProps } from "./components/WarehouseWarehousesPanel";
import { WarehouseWarehousesPanel } from "./components/WarehouseWarehousesPanel";
import type { WarehouseZonesPanelProps } from "./components/WarehouseZonesPanel";
import { WarehouseZonesPanel } from "./components/WarehouseZonesPanel";
import type { WarehouseBinsPanelProps } from "./components/WarehouseBinsPanel";
import { WarehouseBinsPanel } from "./components/WarehouseBinsPanel";

type WarehouseViewProps = {
  warehousesPanelProps: WarehouseWarehousesPanelProps;
  zonesPanelProps: WarehouseZonesPanelProps;
  binsPanelProps: WarehouseBinsPanelProps;
};

export function WarehouseView({
  warehousesPanelProps,
  zonesPanelProps,
  binsPanelProps,
}: WarehouseViewProps) {
  return (
    <div className="page space-y-6" data-testid="warehouse-page">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="page-title">Lagerstruktur</h2>
          <p className="section-subtitle">Verwaltung von Lagern, Zonen und Lagerplätzen.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <WarehouseWarehousesPanel {...warehousesPanelProps} />
        <WarehouseZonesPanel {...zonesPanelProps} />
        <WarehouseBinsPanel {...binsPanelProps} />
      </div>
    </div>
  );
}
