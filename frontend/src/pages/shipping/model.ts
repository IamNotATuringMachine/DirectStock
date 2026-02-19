import type { ShipmentCarrier } from "../../services/shippingApi";

export type DhlExpressFormState = {
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

export const DHL_EXPRESS_DEFAULTS: DhlExpressFormState = {
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

export function carrierLabel(carrier: ShipmentCarrier): string {
  if (carrier === "dhl_express") {
    return "DHL Express";
  }
  return carrier.toUpperCase();
}

export function shipmentStatusBadgeClass(status: string): string {
  if (status === "delivered") {
    return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
  }
  if (status === "cancelled") {
    return "bg-red-500/10 text-red-600 border-red-500/20";
  }
  if (status === "in_transit") {
    return "bg-blue-500/10 text-blue-600 border-blue-500/20";
  }
  return "bg-[var(--bg)] text-[var(--muted)] border-[var(--line)]";
}
