export type IssueFlowStep = "source_bin_scan" | "product_scan" | "quantity" | "confirm";

export const flowSteps: Array<{ id: IssueFlowStep; label: string }> = [
  { id: "source_bin_scan", label: "Quelle" },
  { id: "product_scan", label: "Artikel" },
  { id: "quantity", label: "Menge" },
  { id: "confirm", label: "OK" },
];
