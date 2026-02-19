import type { ShipmentCarrier } from "../../services/shippingApi";
import { ShippingCreatePanel, type ShippingCreatePanelProps } from "./components/ShippingCreatePanel";
import { ShippingFiltersBar } from "./components/ShippingFiltersBar";
import { ShippingShipmentDetails, type ShippingShipmentDetailsProps } from "./components/ShippingShipmentDetails";
import { ShippingShipmentsList, type ShippingShipmentsListProps } from "./components/ShippingShipmentsList";

type ShippingViewProps = {
  statusFilter: string;
  carrierFilter: "" | ShipmentCarrier;
  onStatusFilterChange: (value: string) => void;
  onCarrierFilterChange: (value: "" | ShipmentCarrier) => void;
  createPanelProps: ShippingCreatePanelProps;
  shipmentsListProps: ShippingShipmentsListProps;
  detailsProps: ShippingShipmentDetailsProps;
};

export function ShippingView({
  statusFilter,
  carrierFilter,
  onStatusFilterChange,
  onCarrierFilterChange,
  createPanelProps,
  shipmentsListProps,
  detailsProps,
}: ShippingViewProps) {
  return (
    <section className="page flex flex-col gap-6" data-testid="shipping-page">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="page-title">Versand</h2>
          <p className="section-subtitle mt-1">Versandaufträge anlegen, Label erzeugen und Tracking überwachen.</p>
        </div>
      </header>

      <ShippingFiltersBar
        statusFilter={statusFilter}
        carrierFilter={carrierFilter}
        onStatusFilterChange={onStatusFilterChange}
        onCarrierFilterChange={onCarrierFilterChange}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <ShippingCreatePanel {...createPanelProps} />

        <div className="lg:col-span-8 space-y-6">
          <ShippingShipmentsList {...shipmentsListProps} />
          <ShippingShipmentDetails {...detailsProps} />
        </div>
      </div>
    </section>
  );
}
