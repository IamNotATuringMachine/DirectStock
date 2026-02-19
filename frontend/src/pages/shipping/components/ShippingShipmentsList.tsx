import type { Shipment } from "../../../types";
import { carrierLabel, shipmentStatusBadgeClass } from "../model";

export type ShippingShipmentsListProps = {
  shipments: Shipment[];
  selectedShipmentId: number | null;
  onSelectShipment: (shipmentId: number) => void;
};

export function ShippingShipmentsList({ shipments, selectedShipmentId, onSelectShipment }: ShippingShipmentsListProps) {
  return (
    <div className="bg-[var(--panel)] rounded-[var(--radius-lg)] border border-[var(--line)] shadow-sm overflow-hidden flex flex-col max-h-[400px]">
      <div className="px-6 py-4 border-b border-[var(--line)] bg-[var(--panel-soft)]">
        <h3 className="section-title">Aktuelle Sendungen</h3>
      </div>

      <div className="overflow-y-auto" data-testid="shipping-list">
        {shipments.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)] italic text-sm">Keine Sendungen gefunden.</div>
        ) : (
          <div className="divide-y divide-[var(--line)]">
            {shipments.map((shipment) => {
              const isSelected = selectedShipmentId === shipment.id;
              return (
                <button
                  key={shipment.id}
                  className={`w-full text-left px-6 py-3 hover:bg-[var(--panel-soft)] transition-colors flex items-center justify-between group ${isSelected ? "bg-[var(--panel-strong)] border-l-4 border-l-[var(--accent)] pl-[calc(1.5rem-4px)]" : "border-l-4 border-l-transparent"}`}
                  onClick={() => onSelectShipment(shipment.id)}
                  data-testid={`shipping-item-${shipment.id}`}
                >
                  <div className="min-w-0 flex-1 pr-4">
                    <p className="text-sm font-medium truncate text-[var(--ink)]">{shipment.shipment_number}</p>
                    <p className="text-xs text-[var(--muted)] mt-0.5 uppercase tracking-wide">{carrierLabel(shipment.carrier)}</p>
                  </div>
                  <div className="shrink-0">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${shipmentStatusBadgeClass(shipment.status)}`}>
                      {shipment.status}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
