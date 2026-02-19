export function getTypeLabel(type: string): string {
  switch (type) {
    case "low_stock":
      return "Niedriger Bestand";
    case "zero_stock":
      return "Kein Bestand";
    case "expiry_window":
      return "Ablaufdatum";
    default:
      return type;
  }
}
