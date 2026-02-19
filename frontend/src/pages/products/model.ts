import type { ProductStatus } from "../../types";

export const productStatuses: ProductStatus[] = ["active", "blocked", "deprecated", "archived"];

const productStatusLabels: Record<ProductStatus, string> = {
  active: "Aktiv",
  blocked: "Gesperrt",
  deprecated: "Veraltet",
  archived: "Archiviert",
};

export function toDisplayUnit(unit: string): string {
  const normalized = unit.trim().toLowerCase();
  if (normalized === "piece" || normalized === "pieces") {
    return "Stück";
  }
  return unit;
}

export function toDisplayStatus(status: ProductStatus): string {
  return productStatusLabels[status];
}
