import type { PurchaseOrder, SupplierCommStatus } from "../../types";

export type PurchasingTab = "orders" | "abc" | "recommendations" | "setup";

export const transitionTargets: Record<PurchaseOrder["status"], PurchaseOrder["status"][]> = {
  draft: ["approved", "cancelled"],
  approved: ["ordered", "cancelled"],
  ordered: ["partially_received", "completed", "cancelled"],
  partially_received: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export const supplierCommStatusLabels: Record<SupplierCommStatus, string> = {
  open_unsent: "Offen (nicht gesendet)",
  waiting_reply: "Wartet auf Rückmeldung",
  reply_received_pending: "Rückmeldung erhalten",
  confirmed_with_date: "Bestätigt mit Termin",
  confirmed_undetermined: "Bestätigt unbestimmt",
};

export const purchaseTemplatePlaceholders = [
  "{supplier_company_name}",
  "{supplier_contact_name}",
  "{salutation}",
  "{order_number}",
  "{items_table}",
  "{sender_name}",
  "{sender_email}",
];
