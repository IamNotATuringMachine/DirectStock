import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchCustomerLocations, fetchCustomers } from "../services/customersApi";
import {
  cancelShipment,
  createShipment,
  createShipmentLabel,
  type DhlExpressShipmentCreatePayload,
  type ShipmentCarrier,
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

function carrierLabel(carrier: ShipmentCarrier): string {
  if (carrier === "dhl_express") {
    return "DHL Express";
  }
  return carrier.toUpperCase();
}

type DhlExpressFormState = {
  recipient_company_name: string;
  recipient_contact_name: string;
  recipient_email: string;
  recipient_phone: string;
  recipient_address_line1: string;
  recipient_address_line2: string;
  recipient_postal_code: string;
  recipient_city: string;
  recipient_country_code: string;
  recipient_state_code: string;
  package_weight_kg: string;
  package_length_cm: string;
  package_width_cm: string;
  package_height_cm: string;
};

const DHL_EXPRESS_DEFAULTS: DhlExpressFormState = {
  recipient_company_name: "",
  recipient_contact_name: "",
  recipient_email: "",
  recipient_phone: "",
  recipient_address_line1: "",
  recipient_address_line2: "",
  recipient_postal_code: "",
  recipient_city: "",
  recipient_country_code: "DE",
  recipient_state_code: "",
  package_weight_kg: "1.0",
  package_length_cm: "",
  package_width_cm: "",
  package_height_cm: "",
};

export default function ShippingPage() {
  const queryClient = useQueryClient();
  const [selectedShipmentId, setSelectedShipmentId] = useState<number | null>(null);
  const [carrier, setCarrier] = useState<ShipmentCarrier>("dhl");
  const [customerId, setCustomerId] = useState("");
  const [customerLocationId, setCustomerLocationId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [dhlExpress, setDhlExpress] = useState<DhlExpressFormState>(DHL_EXPRESS_DEFAULTS);
  const [notes, setNotes] = useState("");

  const [statusFilter, setStatusFilter] = useState("");
  const [carrierFilter, setCarrierFilter] = useState<"" | ShipmentCarrier>("");
  const [trackingRefreshCounter, setTrackingRefreshCounter] = useState(0);

  const shipmentsQuery = useQuery({
    queryKey: ["shipments", statusFilter, carrierFilter],
    queryFn: () =>
      fetchShipments({
        status: statusFilter || undefined,
        carrier: carrierFilter || undefined,
      }),
  });
  const customersQuery = useQuery({
    queryKey: ["customers", "shipping"],
    queryFn: () => fetchCustomers({ page: 1, pageSize: 200, isActive: true }),
  });
  const customerLocationsQuery = useQuery({
    queryKey: ["customer-locations", "shipping", customerId],
    queryFn: () => fetchCustomerLocations(Number(customerId), { isActive: true }),
    enabled: Boolean(customerId),
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
      setCustomerId("");
      setCustomerLocationId("");
      setRecipientName("");
      setShippingAddress("");
      setDhlExpress(DHL_EXPRESS_DEFAULTS);
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
    const payload: Parameters<typeof createShipment>[0] = {
      carrier,
      customer_id: customerId ? Number(customerId) : undefined,
      customer_location_id: customerLocationId ? Number(customerLocationId) : undefined,
      notes: notes.trim() || undefined,
    };

    if (carrier === "dhl_express") {
      const hasAllDimensions =
        dhlExpress.package_length_cm.trim() &&
        dhlExpress.package_width_cm.trim() &&
        dhlExpress.package_height_cm.trim();
      const dhlPayload: DhlExpressShipmentCreatePayload = {
        recipient_company_name: dhlExpress.recipient_company_name.trim(),
        recipient_contact_name: dhlExpress.recipient_contact_name.trim(),
        recipient_email: dhlExpress.recipient_email.trim() || undefined,
        recipient_phone: dhlExpress.recipient_phone.trim(),
        recipient_address_line1: dhlExpress.recipient_address_line1.trim(),
        recipient_address_line2: dhlExpress.recipient_address_line2.trim() || undefined,
        recipient_postal_code: dhlExpress.recipient_postal_code.trim(),
        recipient_city: dhlExpress.recipient_city.trim(),
        recipient_country_code: dhlExpress.recipient_country_code.trim().toUpperCase(),
        recipient_state_code: dhlExpress.recipient_state_code.trim() || undefined,
        package_weight_kg: dhlExpress.package_weight_kg.trim(),
        package_length_cm: hasAllDimensions ? dhlExpress.package_length_cm.trim() : undefined,
        package_width_cm: hasAllDimensions ? dhlExpress.package_width_cm.trim() : undefined,
        package_height_cm: hasAllDimensions ? dhlExpress.package_height_cm.trim() : undefined,
      };

      payload.dhl_express = dhlPayload;
      payload.recipient_name = recipientName.trim() || dhlPayload.recipient_contact_name;
      payload.shipping_address =
        shippingAddress.trim() ||
        [
          dhlPayload.recipient_address_line1,
          dhlPayload.recipient_address_line2 ?? "",
          `${dhlPayload.recipient_postal_code} ${dhlPayload.recipient_city}`,
          dhlPayload.recipient_country_code,
        ]
          .filter((part) => part.trim().length > 0)
          .join(", ");
    } else {
      payload.recipient_name = recipientName.trim() || undefined;
      payload.shipping_address = shippingAddress.trim() || undefined;
    }

    await createMutation.mutateAsync(payload);
  };

  const onDownloadLabel = async () => {
    if (!selectedShipment?.label_document_id) {
      return;
    }
    const blob = await downloadDocument(selectedShipment.label_document_id);
    triggerDownload(blob, `${selectedShipment.shipment_number}-label.pdf`);
  };

  return (
    <section className="page flex flex-col gap-6" data-testid="shipping-page">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="page-title">
            Versand
          </h2>
          <p className="section-subtitle mt-1">
            Versandaufträge anlegen, Label erzeugen und Tracking überwachen.
          </p>
        </div>
      </header>

      {/* Toolbar / Filters */}
      <div className="flex flex-col sm:flex-row gap-4 bg-[var(--panel)] p-4 rounded-[var(--radius-lg)] border border-[var(--line)] shadow-sm">
        <div className="w-full sm:w-48 space-y-1">
          <label className="form-label-standard">Status Filter</label>
          <select
            className="input w-full"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
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
            onChange={(event) => setCarrierFilter(event.target.value as "" | ShipmentCarrier)}
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

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* Column 1: Create Shipment (Left) - span 4 */}
        <div className="lg:col-span-4 bg-[var(--panel)] rounded-[var(--radius-lg)] border border-[var(--line)] p-6 shadow-sm">
          <h3 className="section-title mb-4">
            Sendung anlegen
          </h3>
          <form className="space-y-4" onSubmit={(event) => void onCreateShipment(event)} data-testid="shipping-create-form">
            <div className="space-y-2">
              <label className="form-label-standard">
                Versanddienstleister
              </label>
              <select
                className="input w-full"
                value={carrier}
                onChange={(event) => setCarrier(event.target.value as ShipmentCarrier)}
                data-testid="shipping-carrier-select"
              >
                <option value="dhl">DHL</option>
                <option value="dhl_express">DHL Express</option>
                <option value="dpd">DPD</option>
                <option value="ups">UPS</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="form-label-standard">Kunde (optional)</label>
              <select
                className="input w-full"
                value={customerId}
                onChange={(event) => {
                  setCustomerId(event.target.value);
                  setCustomerLocationId("");
                }}
              >
                <option value="">Kein Kunde</option>
                {(customersQuery.data?.items ?? []).map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.customer_number} - {customer.company_name}
                  </option>
                ))}
              </select>
            </div>

            {customerId ? (
              <div className="space-y-2">
                <label className="form-label-standard">Standort (optional)</label>
                <select
                  className="input w-full"
                  value={customerLocationId}
                  onChange={(event) => setCustomerLocationId(event.target.value)}
                >
                  <option value="">Kein Standort</option>
                  {(customerLocationsQuery.data ?? []).map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.location_code} - {location.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {carrier !== "dhl_express" ? (
              <>
                <div className="space-y-2">
                  <label className="form-label-standard">
                    Empfänger
                  </label>
                  <input
                    className="input w-full"
                    value={recipientName}
                    onChange={(event) => setRecipientName(event.target.value)}
                    placeholder="Max Mustermann"
                    data-testid="shipping-recipient-input"
                  />
                </div>

                <div className="space-y-2">
                  <label className="form-label-standard">
                    Lieferadresse
                  </label>
                  <textarea
                    className="input w-full min-h-[80px] py-2 resize-y"
                    value={shippingAddress}
                    onChange={(event) => setShippingAddress(event.target.value)}
                    placeholder="Musterstraße 1, 12345 Musterstadt"
                    data-testid="shipping-address-input"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-3 rounded-[var(--radius-sm)] border border-[var(--line)] p-3">
                <p className="text-xs uppercase tracking-wide text-[var(--muted)]">DHL Express Daten</p>
                <div className="space-y-2">
                  <label className="form-label-standard">Firma</label>
                  <input
                    className="input w-full"
                    value={dhlExpress.recipient_company_name}
                    onChange={(event) =>
                      setDhlExpress((prev) => ({ ...prev, recipient_company_name: event.target.value }))
                    }
                    placeholder="Muster GmbH"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <label className="form-label-standard">Kontaktname</label>
                    <input
                      className="input w-full"
                      value={dhlExpress.recipient_contact_name}
                      onChange={(event) =>
                        setDhlExpress((prev) => ({ ...prev, recipient_contact_name: event.target.value }))
                      }
                      placeholder="Max Mustermann"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="form-label-standard">Telefon</label>
                    <input
                      className="input w-full"
                      value={dhlExpress.recipient_phone}
                      onChange={(event) => setDhlExpress((prev) => ({ ...prev, recipient_phone: event.target.value }))}
                      placeholder="+49..."
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="form-label-standard">E-Mail (optional)</label>
                  <input
                    className="input w-full"
                    value={dhlExpress.recipient_email}
                    onChange={(event) => setDhlExpress((prev) => ({ ...prev, recipient_email: event.target.value }))}
                    placeholder="logistik@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="form-label-standard">Adresszeile 1</label>
                  <input
                    className="input w-full"
                    value={dhlExpress.recipient_address_line1}
                    onChange={(event) =>
                      setDhlExpress((prev) => ({ ...prev, recipient_address_line1: event.target.value }))
                    }
                    placeholder="Musterstrasse 1"
                  />
                </div>
                <div className="space-y-2">
                  <label className="form-label-standard">Adresszeile 2 (optional)</label>
                  <input
                    className="input w-full"
                    value={dhlExpress.recipient_address_line2}
                    onChange={(event) =>
                      setDhlExpress((prev) => ({ ...prev, recipient_address_line2: event.target.value }))
                    }
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="space-y-2">
                    <label className="form-label-standard">PLZ</label>
                    <input
                      className="input w-full"
                      value={dhlExpress.recipient_postal_code}
                      onChange={(event) =>
                        setDhlExpress((prev) => ({ ...prev, recipient_postal_code: event.target.value }))
                      }
                      placeholder="56068"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="form-label-standard">Stadt</label>
                    <input
                      className="input w-full"
                      value={dhlExpress.recipient_city}
                      onChange={(event) => setDhlExpress((prev) => ({ ...prev, recipient_city: event.target.value }))}
                      placeholder="Koblenz"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="form-label-standard">Land (ISO2)</label>
                    <input
                      className="input w-full uppercase"
                      value={dhlExpress.recipient_country_code}
                      onChange={(event) =>
                        setDhlExpress((prev) => ({ ...prev, recipient_country_code: event.target.value }))
                      }
                      placeholder="DE"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <label className="form-label-standard">Bundesland/State (optional)</label>
                    <input
                      className="input w-full"
                      value={dhlExpress.recipient_state_code}
                      onChange={(event) =>
                        setDhlExpress((prev) => ({ ...prev, recipient_state_code: event.target.value }))
                      }
                      placeholder="RP"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="form-label-standard">Gewicht (kg)</label>
                    <input
                      className="input w-full"
                      value={dhlExpress.package_weight_kg}
                      onChange={(event) => setDhlExpress((prev) => ({ ...prev, package_weight_kg: event.target.value }))}
                      placeholder="1.0"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="space-y-2">
                    <label className="form-label-standard">Laenge (cm, optional)</label>
                    <input
                      className="input w-full"
                      value={dhlExpress.package_length_cm}
                      onChange={(event) => setDhlExpress((prev) => ({ ...prev, package_length_cm: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="form-label-standard">Breite (cm, optional)</label>
                    <input
                      className="input w-full"
                      value={dhlExpress.package_width_cm}
                      onChange={(event) => setDhlExpress((prev) => ({ ...prev, package_width_cm: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="form-label-standard">Hoehe (cm, optional)</label>
                    <input
                      className="input w-full"
                      value={dhlExpress.package_height_cm}
                      onChange={(event) => setDhlExpress((prev) => ({ ...prev, package_height_cm: event.target.value }))}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="form-label-standard">
                Notiz
              </label>
              <input
                className="input w-full"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Inhalt, Referenz, etc."
                data-testid="shipping-notes-input"
              />
            </div>

            <button
              type="submit"
              disabled={createMutation.isPending}
              className="btn btn-primary w-full justify-center mt-2"
              data-testid="shipping-create-btn"
            >
              {createMutation.isPending ? "Wird angelegt..." : "Sendung anlegen"}
            </button>
          </form>
        </div>

        {/* Column 2: List & Details (Right) - span 8 */}
        <div className="lg:col-span-8 space-y-6">

          {/* List of Shipments */}
          <div className="bg-[var(--panel)] rounded-[var(--radius-lg)] border border-[var(--line)] shadow-sm overflow-hidden flex flex-col max-h-[400px]">
            <div className="px-6 py-4 border-b border-[var(--line)] bg-[var(--panel-soft)]">
              <h3 className="section-title">Aktuelle Sendungen</h3>
            </div>
            <div className="overflow-y-auto" data-testid="shipping-list">
              {(shipmentsQuery.data ?? []).length === 0 ? (
                <div className="p-8 text-center text-[var(--muted)] italic text-sm">
                  Keine Sendungen gefunden.
                </div>
              ) : (
                <div className="divide-y divide-[var(--line)]">
                  {shipmentsQuery.data?.map((shipment) => (
                    <button
                      key={shipment.id}
                      className={`w-full text-left px-6 py-3 hover:bg-[var(--panel-soft)] transition-colors flex items-center justify-between group ${selectedShipmentId === shipment.id ? "bg-[var(--panel-strong)] border-l-4 border-l-[var(--accent)] pl-[calc(1.5rem-4px)]" : "border-l-4 border-l-transparent"
                        }`}
                      onClick={() => {
                        setSelectedShipmentId(shipment.id);
                        setTrackingRefreshCounter(0);
                      }}
                      data-testid={`shipping-item-${shipment.id}`}
                    >
                      <div className="min-w-0 flex-1 pr-4">
                        <p className={`text-sm font-medium truncate text-[var(--ink)]`}>
                          {shipment.shipment_number}
                        </p>
                        <p className="text-xs text-[var(--muted)] mt-0.5 uppercase tracking-wide">
                          {carrierLabel(shipment.carrier)}
                        </p>
                      </div>
                      <div className="shrink-0">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border
                           ${shipment.status === 'delivered' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                            shipment.status === 'cancelled' ? 'bg-red-500/10 text-red-600 border-red-500/20' :
                              shipment.status === 'in_transit' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' :
                                'bg-[var(--bg)] text-[var(--muted)] border-[var(--line)]'
                          }`}>
                          {shipment.status}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Selected Shipment Details */}
          {selectedShipment && (
            <div className="bg-[var(--panel)] rounded-[var(--radius-lg)] border border-[var(--line)] p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6 border-b border-[var(--line)] pb-6">
                <div className="space-y-1 min-w-0">
                  <h2 className="text-lg font-semibold text-[var(--ink)] truncate" data-testid="shipping-selected-status">
                    {selectedShipment.shipment_number}
                  </h2>
                  <p className="text-sm text-[var(--muted)] break-words">
                    Tracking Nr: <span className="font-mono text-[var(--ink)] select-all ml-1">{selectedShipment.tracking_number ?? "-"}</span>
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border
                       ${selectedShipment.status === 'delivered' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                        selectedShipment.status === 'cancelled' ? 'bg-red-500/10 text-red-600 border-red-500/20' :
                          selectedShipment.status === 'in_transit' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' :
                            'bg-[var(--bg)] text-[var(--muted)] border-[var(--line)]'
                      }`}>
                      Status: {selectedShipment.status}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <button
                    onClick={() => void labelMutation.mutateAsync(selectedShipment.id)}
                    disabled={labelMutation.isPending || selectedShipment.status === "cancelled"}
                    className="btn btn-sm"
                    data-testid="shipping-create-label-btn"
                  >
                    Label erzeugen
                  </button>
                  <button
                    onClick={() => setTrackingRefreshCounter((value) => value + 1)}
                    disabled={!selectedShipment.tracking_number || trackingQuery.isFetching}
                    className="btn btn-sm"
                    data-testid="shipping-refresh-tracking-btn"
                  >
                    Refresh Tracking
                  </button>
                  <button
                    onClick={() => void onDownloadLabel()}
                    disabled={!selectedShipment.label_document_id}
                    className="btn btn-sm"
                    data-testid="shipping-download-label-btn"
                  >
                    Download Label
                  </button>
                  <button
                    onClick={() => void cancelMutation.mutateAsync(selectedShipment.id)}
                    disabled={cancelMutation.isPending || selectedShipment.status === "cancelled"}
                    className="btn btn-sm text-[var(--destructive)] hover:bg-red-50"
                    data-testid="shipping-cancel-btn"
                  >
                    Stornieren
                  </button>
                </div>
              </div>

              {/* Tracking Table */}
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
                    {(trackingQuery.data?.events ?? []).map((event) => (
                      <tr key={event.id} className="hover:bg-[var(--panel-soft)] transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-[var(--muted)]">
                          {new Date(event.event_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-[var(--ink)]">
                          {event.event_type}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--panel-soft)] text-[var(--muted)] border border-[var(--line)]">
                            {event.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-[var(--muted)]">
                          {event.source}
                        </td>
                        <td className="px-6 py-4 text-[var(--muted)] max-w-xs truncate" title={event.description ?? ""}>
                          {event.description ?? "-"}
                        </td>
                      </tr>
                    ))}
                    {!trackingQuery.isLoading && (trackingQuery.data?.events.length ?? 0) === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-[var(--muted)] italic">
                          Keine Tracking-Ereignisse verfügbar.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
