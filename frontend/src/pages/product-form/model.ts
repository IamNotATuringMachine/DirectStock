import type { ProductPrice, ProductStatus } from "../../types";

export type ProductFormState = {
  productNumber: string;
  name: string;
  description: string;
  groupId: string;
  unit: string;
  status: ProductStatus;
  requiresItemTracking: boolean;
};

export type ProductTab = "master" | "warehouse" | "suppliers" | "pricing";
export type ProductCreateStep = "master" | "pricing" | "warehouse" | "suppliers";

export type WarehouseSettingFormState = {
  ean: string;
  minStock: string;
  reorderPoint: string;
  maxStock: string;
  safetyStock: string;
  leadTimeDays: string;
};

export function emptyProductForm(): ProductFormState {
  return {
    productNumber: "",
    name: "",
    description: "",
    groupId: "",
    unit: "Stück",
    status: "active",
    requiresItemTracking: false,
  };
}

export function emptyWarehouseSettingForm(): WarehouseSettingFormState {
  return {
    ean: "",
    minStock: "",
    reorderPoint: "",
    maxStock: "",
    safetyStock: "",
    leadTimeDays: "",
  };
}

export function toNullableNumber(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toNullableDecimal(value: string): string | null {
  const normalized = value.trim();
  return normalized ? normalized : null;
}

export function toDisplayUnit(unit: string): string {
  const normalized = unit.trim().toLowerCase();
  if (normalized === "piece" || normalized === "pieces" || normalized === "pc" || normalized === "pcs") {
    return "Stück";
  }
  return unit;
}

export function toApiUnit(unit: string): string {
  const normalized = unit.trim().toLowerCase();
  if (normalized === "stück" || normalized === "stueck") {
    return "piece";
  }
  return unit.trim();
}

export function formatPriceAmount(value: string | null): string {
  if (!value) {
    return "-";
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  return parsed.toFixed(2);
}

export function deriveActiveBasePriceId(
  basePrices: ProductPrice[] | undefined,
  resolvedPrice:
    | {
        source: "customer" | "base" | "none";
        net_price: string | null;
        vat_rate: string | null;
        currency: string | null;
      }
    | undefined
): number | null {
  if (!basePrices || !resolvedPrice || resolvedPrice.source !== "base") {
    return null;
  }
  const match = basePrices.find(
    (item) =>
      item.is_active &&
      item.net_price === resolvedPrice.net_price &&
      item.vat_rate === resolvedPrice.vat_rate &&
      item.currency === resolvedPrice.currency
  );
  return match?.id ?? null;
}
