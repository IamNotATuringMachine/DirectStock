import type { ShipmentCarrier } from "../../../services/shippingApi";

export type ShippingFiltersBarProps = {
  statusFilter: string;
  carrierFilter: "" | ShipmentCarrier;
  onStatusFilterChange: (value: string) => void;
  onCarrierFilterChange: (value: "" | ShipmentCarrier) => void;
};

export function ShippingFiltersBar({
  statusFilter,
  carrierFilter,
  onStatusFilterChange,
  onCarrierFilterChange,
}: ShippingFiltersBarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 bg-[var(--panel)] p-4 rounded-[var(--radius-lg)] border border-[var(--line)] shadow-sm">
      <div className="w-full sm:w-48 space-y-1">
        <label className="form-label-standard">Status Filter</label>
        <select
          className="input w-full"
          value={statusFilter}
          onChange={(event) => onStatusFilterChange(event.target.value)}
          data-testid="shipping-status-filter"
        >
          <option value="">Alle Status</option>
          <option value="draft">Draft</option>
          <option value="label_created">Label erstellt</option>
          <option value="in_transit">In Transit</option>
          <option value="delivered">Zugestellt</option>
          <option value="cancelled">Storniert</option>
        </select>
      </div>

      <div className="w-full sm:w-48 space-y-1">
        <label className="form-label-standard">Carrier Filter</label>
        <select
          className="input w-full"
          value={carrierFilter}
          onChange={(event) => onCarrierFilterChange(event.target.value as "" | ShipmentCarrier)}
          data-testid="shipping-carrier-filter"
        >
          <option value="">Alle Carrier</option>
          <option value="dhl">DHL</option>
          <option value="dhl_express">DHL Express</option>
          <option value="dpd">DPD</option>
          <option value="ups">UPS</option>
        </select>
      </div>
    </div>
  );
}
