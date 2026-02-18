export type ReportType =
  | "stock"
  | "movements"
  | "inbound-outbound"
  | "inventory-accuracy"
  | "abc"
  | "returns"
  | "picking-performance"
  | "purchase-recommendations"
  | "trends"
  | "demand-forecast";

export const REPORT_PAGE_SIZE = 25;

export const REPORT_TYPE_OPTIONS: Array<{ value: ReportType; label: string }> = [
  { value: "stock", label: "Bestandsübersicht" },
  { value: "movements", label: "Lagerbewegungen" },
  { value: "inbound-outbound", label: "Wareneingang / Warenausgang" },
  { value: "inventory-accuracy", label: "Bestandsgenauigkeit" },
  { value: "abc", label: "ABC-Analyse" },
  { value: "returns", label: "Retouren & RMA" },
  { value: "picking-performance", label: "Picking Leistung" },
  { value: "purchase-recommendations", label: "Einkaufsempfehlungen" },
  { value: "trends", label: "Bestandstrends" },
  { value: "demand-forecast", label: "Bedarfsprognose (AI)" },
];

export function defaultDateRange() {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const fromDate = new Date(now);
  fromDate.setDate(fromDate.getDate() - 29);
  const from = fromDate.toISOString().slice(0, 10);
  return { from, to };
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
