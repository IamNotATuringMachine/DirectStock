import { type FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchCustomerLocations, fetchCustomers } from "../../services/customersApi";
import {
  cancelShipment,
  createShipment,
  createShipmentLabel,
  downloadDocument,
  fetchShipmentTracking,
  fetchShipments,
  type DhlExpressShipmentCreatePayload,
  type ShipmentCarrier,
} from "../../services/shippingApi";
import { ShippingView } from "./ShippingView";
import { DHL_EXPRESS_DEFAULTS, type DhlExpressFormState } from "./model";

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

  const onDhlExpressChange = (field: keyof DhlExpressFormState, value: string) => {
    setDhlExpress((previous) => ({ ...previous, [field]: value }));
  };

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
    <ShippingView
      statusFilter={statusFilter}
      carrierFilter={carrierFilter}
      onStatusFilterChange={setStatusFilter}
      onCarrierFilterChange={setCarrierFilter}
      createPanelProps={{
        carrier,
        onCarrierChange: setCarrier,
        customerId,
        onCustomerChange: (value) => {
          setCustomerId(value);
          setCustomerLocationId("");
        },
        customerLocationId,
        onCustomerLocationChange: setCustomerLocationId,
        customers: customersQuery.data?.items ?? [],
        customerLocations: customerLocationsQuery.data ?? [],
        recipientName,
        onRecipientNameChange: setRecipientName,
        shippingAddress,
        onShippingAddressChange: setShippingAddress,
        dhlExpress,
        onDhlExpressChange,
        notes,
        onNotesChange: setNotes,
        onCreateShipment: (event) => void onCreateShipment(event),
        createPending: createMutation.isPending,
      }}
      shipmentsListProps={{
        shipments: shipmentsQuery.data ?? [],
        selectedShipmentId,
        onSelectShipment: (shipmentId) => {
          setSelectedShipmentId(shipmentId);
          setTrackingRefreshCounter(0);
        },
      }}
      detailsProps={{
        selectedShipment,
        trackingEvents: trackingQuery.data?.events ?? [],
        trackingLoading: trackingQuery.isLoading,
        trackingRefreshing: trackingQuery.isFetching,
        onCreateLabel: (shipmentId) => {
          void labelMutation.mutateAsync(shipmentId);
        },
        onRefreshTracking: () => {
          setTrackingRefreshCounter((value) => value + 1);
        },
        onDownloadLabel: () => {
          void onDownloadLabel();
        },
        onCancelShipment: (shipmentId) => {
          void cancelMutation.mutateAsync(shipmentId);
        },
        labelPending: labelMutation.isPending,
        cancelPending: cancelMutation.isPending,
      }}
    />
  );
}
