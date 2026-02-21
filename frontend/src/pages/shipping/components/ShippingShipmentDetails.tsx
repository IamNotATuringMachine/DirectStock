import type { Shipment, ShipmentEvent } from "../../../types";
import { shipmentStatusBadgeClass } from "../model";

export type ShippingShipmentDetailsProps = {
  selectedShipment: Shipment | null;
  trackingEvents: ShipmentEvent[];
  trackingLoading: boolean;
  trackingRefreshing: boolean;
  onCreateLabel: (shipmentId: number) => void;
  onRefreshTracking: () => void;
  onDownloadLabel: () => void;
  onCancelShipment: (shipmentId: number) => void;
  labelPending: boolean;
  cancelPending: boolean;
};

export function ShippingShipmentDetails({
  selectedShipment,
  trackingEvents,
  trackingLoading,
  trackingRefreshing,
  onCreateLabel,
  onRefreshTracking,
  onDownloadLabel,
  onCancelShipment,
  labelPending,
  cancelPending,
}: ShippingShipmentDetailsProps) {
  if (!selectedShipment) {
    return null;
  }

  return (
    <div className="bg-[var(--panel)] rounded-[var(--radius-lg)] border border-[var(--line)] p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6 border-b border-[var(--line)] pb-6">
        <div className="space-y-1 min-w-0">
          <h2 className="text-lg font-semibold text-[var(--ink)] truncate">
            {selectedShipment.shipment_number}
          </h2>
          <p className="text-sm text-[var(--muted)] break-words">
            Tracking Nr:
            <span className="font-mono text-[var(--ink)] select-all ml-1">{selectedShipment.tracking_number ?? "-"}</span>
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${shipmentStatusBadgeClass(selectedShipment.status)}`} data-testid="shipping-selected-status">
              Status: {selectedShipment.status}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:justify-end">
          <button
            onClick={() => onCreateLabel(selectedShipment.id)}
            disabled={labelPending || selectedShipment.status === "cancelled"}
            className="btn btn-sm"
            data-testid="shipping-create-label-btn"
          >
            Label erzeugen
          </button>
          <button
            onClick={onRefreshTracking}
            disabled={!selectedShipment.tracking_number || trackingRefreshing}
            className="btn btn-sm"
            data-testid="shipping-refresh-tracking-btn"
          >
            Refresh Tracking
          </button>
          <button
            onClick={onDownloadLabel}
            disabled={!selectedShipment.label_document_id}
            className="btn btn-sm"
            data-testid="shipping-download-label-btn"
          >
            Download Label
          </button>
          <button
            onClick={() => onCancelShipment(selectedShipment.id)}
            disabled={cancelPending || selectedShipment.status === "cancelled"}
            className="btn btn-sm text-[var(--destructive)] hover:bg-red-50"
            data-testid="shipping-cancel-btn"
          >
            Stornieren
          </button>
        </div>
      </div>

      <div className="overflow-x-auto border border-[var(--line)] rounded-[var(--radius-sm)]" data-testid="shipping-tracking-table">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[var(--panel-soft)] text-[var(--muted)] uppercase text-xs font-semibold">
            <tr>
              <th className="px-6 py-3">Zeit</th>
              <th className="px-6 py-3">Event</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Quelle</th>
              <th className="px-6 py-3">Info</th>
            </tr>
          </thead>

          <tbody className="bg-[var(--bg)] divide-y divide-[var(--line)]">
            {trackingEvents.map((event) => (
              <tr key={event.id} className="hover:bg-[var(--panel-soft)] transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-xs text-[var(--muted)]">{new Date(event.event_at).toLocaleString()}</td>
                <td className="px-6 py-4 whitespace-nowrap font-medium text-[var(--ink)]">{event.event_type}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--panel-soft)] text-[var(--muted)] border border-[var(--line)]">
                    {event.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-[var(--muted)]">{event.source}</td>
                <td className="px-6 py-4 text-[var(--muted)] max-w-xs truncate" title={event.description ?? ""}>
                  {event.description ?? "-"}
                </td>
              </tr>
            ))}

            {!trackingLoading && trackingEvents.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-[var(--muted)] italic">
                  Keine Tracking-Ereignisse verfügbar.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
