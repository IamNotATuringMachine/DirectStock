import type { PurchaseOrder } from "../../types";

export type PurchasingTab = "orders" | "abc" | "recommendations";

export const transitionTargets: Record<PurchaseOrder["status"], PurchaseOrder["status"][]> = {
  draft: ["approved", "cancelled"],
  approved: ["ordered", "cancelled"],
  ordered: ["partially_received", "completed", "cancelled"],
  partially_received: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};
