import type { WarehouseZoneType } from "../../types";

export const zoneTypes: WarehouseZoneType[] = [
  "inbound",
  "storage",
  "picking",
  "outbound",
  "returns",
  "blocked",
  "quality",
];

export const zoneTypeLabels: Record<WarehouseZoneType, string> = {
  inbound: "Wareneingang",
  storage: "Lagerung",
  picking: "Kommissionierung",
  outbound: "Warenausgang",
  returns: "Retouren",
  blocked: "Gesperrt",
  quality: "Qualitaetspruefung",
};
