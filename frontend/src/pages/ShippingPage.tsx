import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  cancelShipment,
  createShipment,
  createShipmentLabel,
  downloadDocument,
  fetchShipmentTracking,
  fetchShipments,
} from "../services/shippingApi";

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function ShippingPage() {
  const queryClient = useQueryClient();
  const [selectedShipmentId, setSelectedShipmentId] = useState<number | null>(null);
  const [carrier, setCarrier] = useState<"dhl" | "dpd" | "ups">("dhl");
  const [recipientName, setRecipientName] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [notes, setNotes] = useState("");

  const [statusFilter, setStatusFilter] = useState("");
  const [carrierFilter, setCarrierFilter] = useState<"" | "dhl" | "dpd" | "ups">("");
  const [trackingRefreshCounter, setTrackingRefreshCounter] = useState(0);

  const shipmentsQuery = useQuery({
    queryKey: ["shipments", statusFilter, carrierFilter],
    queryFn: () =>
      fetchShipments({
        status: statusFilter || undefined,
        carrier: carrierFilter || undefined,
      }),
  });

  const trackingQuery = useQuery({
    queryKey: ["shipment-tracking", selectedShipmentId, trackingRefreshCounter],
    queryFn: () => fetchShipmentTracking(selectedShipmentId as number, trackingRefreshCounter > 0),
    enabled: selectedShipmentId !== null,
  });

  const createMutation = useMutation({
    mutationFn: createShipment,
    onSuccess: async (shipment) => {
      await queryClient.invalidateQueries({ queryKey: ["shipments"] });
      setSelectedShipmentId(shipment.id);
      setNotes("");
      setRecipientName("");
      setShippingAddress("");
    },
  });

  const labelMutation = useMutation({
    mutationFn: createShipmentLabel,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["shipments"] }),
        queryClient.invalidateQueries({ queryKey: ["shipment-tracking", selectedShipmentId] }),
      ]);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelShipment,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["shipments"] }),
        queryClient.invalidateQueries({ queryKey: ["shipment-tracking", selectedShipmentId] }),
      ]);
    },
  });

  const selectedShipment = useMemo(
    () => shipmentsQuery.data?.find((shipment) => shipment.id === selectedShipmentId) ?? trackingQuery.data?.shipment ?? null,
    [shipmentsQuery.data, selectedShipmentId, trackingQuery.data?.shipment]
  );

  const onCreateShipment = async (event: FormEvent) => {
    event.preventDefault();
    await createMutation.mutateAsync({
      carrier,
      recipient_name: recipientName.trim() || undefined,
      shipping_address: shippingAddress.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  const onDownloadLabel = async () => {
    if (!selectedShipment?.label_document_id) {
      return;
    }
    const blob = await downloadDocument(selectedShipment.label_document_id);
    triggerDownload(blob, `${selectedShipment.shipment_number}-label.pdf`);
  };

  return (
    <section className="panel" data-testid="shipping-page">
      <header className="panel-header">
        <div>
          <h2>Shipping</h2>
          <p className="panel-subtitle">Versandaufträge anlegen, Label erzeugen und Tracking überwachen.</p>
        </div>
      </header>

      <div className="products-toolbar">
        <select
          className="input"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          data-testid="shipping-status-filter"
        >
          <option value="">Alle Status</option>
          <option value="draft">draft</option>
          <option value="label_created">label_created</option>
          <option value="in_transit">in_transit</option>
          <option value="delivered">delivered</option>
          <option value="cancelled">cancelled</option>
        </select>
        <select
          className="input"
          value={carrierFilter}
          onChange={(event) => setCarrierFilter(event.target.value as "" | "dhl" | "dpd" | "ups")}
          data-testid="shipping-carrier-filter"
        >
          <option value="">Alle Carrier</option>
          <option value="dhl">dhl</option>
          <option value="dpd">dpd</option>
          <option value="ups">ups</option>
        </select>
      </div>

      <div className="warehouse-grid">
        <article className="subpanel">
          <h3>1. Shipment anlegen</h3>
          <form className="form-grid" onSubmit={(event) => void onCreateShipment(event)} data-testid="shipping-create-form">
            <label>
              Carrier
              <select
                className="input"
                value={carrier}
                onChange={(event) => setCarrier(event.target.value as "dhl" | "dpd" | "ups")}
                data-testid="shipping-carrier-select"
              >
                <option value="dhl">dhl</option>
                <option value="dpd">dpd</option>
                <option value="ups">ups</option>
              </select>
            </label>
            <label>
              Empfänger
              <input
                className="input"
                value={recipientName}
                onChange={(event) => setRecipientName(event.target.value)}
                data-testid="shipping-recipient-input"
              />
            </label>
            <label>
              Lieferadresse
              <textarea
                className="input"
                value={shippingAddress}
                onChange={(event) => setShippingAddress(event.target.value)}
                data-testid="shipping-address-input"
              />
            </label>
            <label>
              Notiz
              <input
                className="input"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                data-testid="shipping-notes-input"
              />
            </label>
            <button className="btn" type="submit" disabled={createMutation.isPending} data-testid="shipping-create-btn">
              Shipment anlegen
            </button>
          </form>

          <div className="list-stack small" data-testid="shipping-list">
            {(shipmentsQuery.data ?? []).map((shipment) => (
              <button
                key={shipment.id}
                className={`list-item ${selectedShipmentId === shipment.id ? "active" : ""}`}
                onClick={() => {
                  setSelectedShipmentId(shipment.id);
                  setTrackingRefreshCounter(0);
                }}
                data-testid={`shipping-item-${shipment.id}`}
              >
                <strong>{shipment.shipment_number}</strong>
                <span>
                  {shipment.carrier} | {shipment.status}
                </span>
              </button>
            ))}
          </div>
        </article>

        <article className="subpanel">
          <h3>2. Label + Tracking</h3>
          {!selectedShipment ? <p>Bitte Shipment auswählen.</p> : null}
          {selectedShipment ? (
            <>
              <p data-testid="shipping-selected-status">
                {selectedShipment.shipment_number} | Status: <strong>{selectedShipment.status}</strong>
              </p>
              <p>
                Tracking: <strong>{selectedShipment.tracking_number ?? "-"}</strong>
              </p>

              <div className="actions-cell" style={{ marginBottom: "1rem" }}>
                <button
                  className="btn"
                  onClick={() => void labelMutation.mutateAsync(selectedShipment.id)}
                  disabled={labelMutation.isPending || selectedShipment.status === "cancelled"}
                  data-testid="shipping-create-label-btn"
                >
                  Label erzeugen
                </button>
                <button
                  className="btn"
                  onClick={() => setTrackingRefreshCounter((value) => value + 1)}
                  disabled={!selectedShipment.tracking_number || trackingQuery.isFetching}
                  data-testid="shipping-refresh-tracking-btn"
                >
                  Tracking aktualisieren
                </button>
                <button
                  className="btn"
                  onClick={() => void cancelMutation.mutateAsync(selectedShipment.id)}
                  disabled={cancelMutation.isPending || selectedShipment.status === "cancelled"}
                  data-testid="shipping-cancel-btn"
                >
                  Shipment stornieren
                </button>
                <button
                  className="btn"
                  onClick={() => void onDownloadLabel()}
                  disabled={!selectedShipment.label_document_id}
                  data-testid="shipping-download-label-btn"
                >
                  Label herunterladen
                </button>
              </div>

              <div className="table-wrap">
                <table className="products-table mobile-cards-table" data-testid="shipping-tracking-table">
                  <thead>
                    <tr>
                      <th>Zeit</th>
                      <th>Event</th>
                      <th>Status</th>
                      <th>Quelle</th>
                      <th>Beschreibung</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(trackingQuery.data?.events ?? []).map((event) => (
                      <tr key={event.id}>
                        <td data-label="Zeit">{new Date(event.event_at).toLocaleString()}</td>
                        <td data-label="Event">{event.event_type}</td>
                        <td data-label="Status">{event.status}</td>
                        <td data-label="Quelle">{event.source}</td>
                        <td data-label="Beschreibung">{event.description ?? "-"}</td>
                      </tr>
                    ))}
                    {!trackingQuery.isLoading && (trackingQuery.data?.events.length ?? 0) === 0 ? (
                      <tr>
                        <td colSpan={5}>Keine Tracking-Ereignisse verfügbar.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </article>
      </div>
    </section>
  );
}
