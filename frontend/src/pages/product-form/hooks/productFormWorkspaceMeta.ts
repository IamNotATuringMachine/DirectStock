import { AxiosError } from "axios";
import { DollarSign, Package, Truck, Warehouse } from "lucide-react";

import { ProductCreateStep, ProductTab } from "../model";

export const tabConfig: Array<{
  id: ProductTab;
  label: string;
  icon: typeof Package;
  testId: string;
}> = [
  { id: "master", label: "Stammdaten", icon: Package, testId: "product-form-master-tab" },
  { id: "warehouse", label: "Lagerdaten", icon: Warehouse, testId: "product-form-warehouse-tab-button" },
  { id: "suppliers", label: "Lieferanten", icon: Truck, testId: "product-form-suppliers-tab-button" },
  { id: "pricing", label: "Preise", icon: DollarSign, testId: "product-form-pricing-tab" },
];

export const createStepMeta: Record<ProductCreateStep, { label: string; icon: typeof Package; optional: boolean }> = {
  master: { label: "Stammdaten", icon: Package, optional: false },
  pricing: { label: "Preise", icon: DollarSign, optional: true },
  warehouse: { label: "Lagerdaten", icon: Warehouse, optional: true },
  suppliers: { label: "Lieferanten", icon: Truck, optional: true },
};

export function toMutationErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string" && detail.trim().length > 0) {
      return detail;
    }
  }
  return fallback;
}
