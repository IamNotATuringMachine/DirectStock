export type ReturnOrderStatus = "registered" | "received" | "inspected" | "resolved" | "cancelled";
export type ReturnDecision = "restock" | "repair" | "scrap" | "return_supplier";
export type ReturnRepairMode = "internal" | "external";

export const transitionTargets: Record<ReturnOrderStatus, ReturnOrderStatus[]> = {
  registered: ["received", "cancelled"],
  received: ["inspected", "cancelled"],
  inspected: ["resolved", "cancelled"],
  resolved: [],
  cancelled: [],
};

export const decisionLabels: Record<ReturnDecision, string> = {
  restock: "Ins Lager (Restock)",
  repair: "Reparatur",
  scrap: "Verschrotten",
  return_supplier: "Ruecksendung (Lieferant)",
};
