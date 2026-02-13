export type ParsedScanType = "bin_qr" | "product_qr" | "ean" | "unknown";

export type ParsedScan = {
  raw: string;
  normalized: string;
  type: ParsedScanType;
  value: string;
};

const BIN_PREFIX = "DS:BIN:";
const PRODUCT_PREFIX = "DS:ART:";

export function normalizeScanValue(value: string): string {
  return value.trim().replace(/\s+/g, "");
}

export function isEan13(value: string): boolean {
  return /^\d{13}$/.test(value);
}

export function parseScanValue(value: string): ParsedScan {
  const normalized = normalizeScanValue(value);

  if (normalized.startsWith(BIN_PREFIX)) {
    return {
      raw: value,
      normalized,
      type: "bin_qr",
      value: normalized.slice(BIN_PREFIX.length),
    };
  }

  if (normalized.startsWith(PRODUCT_PREFIX)) {
    return {
      raw: value,
      normalized,
      type: "product_qr",
      value: normalized.slice(PRODUCT_PREFIX.length),
    };
  }

  if (isEan13(normalized)) {
    return {
      raw: value,
      normalized,
      type: "ean",
      value: normalized,
    };
  }

  return {
    raw: value,
    normalized,
    type: "unknown",
    value: normalized,
  };
}

export function isRapidScannerKeystroke(
  currentTimestamp: number,
  lastTimestamp: number | null,
  thresholdMs = 50
): boolean {
  if (lastTimestamp === null) {
    return true;
  }
  return currentTimestamp - lastTimestamp <= thresholdMs;
}
