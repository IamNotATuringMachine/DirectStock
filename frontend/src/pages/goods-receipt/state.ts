export type ReceiptFlowStep = "product_scan" | "quantity" | "bin_scan" | "confirm";

export const flowSteps: Array<{ id: ReceiptFlowStep; label: string }> = [
  { id: "product_scan", label: "Artikel" },
  { id: "quantity", label: "Menge" },
  { id: "bin_scan", label: "Platz" },
  { id: "confirm", label: "Bestätigen" },
];
