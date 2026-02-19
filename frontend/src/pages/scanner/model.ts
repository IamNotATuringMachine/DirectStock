import type { ScanRecord, ScanSource } from "../../stores/scannerStore";

export type ScanResult = {
  input: string;
  kind: "product" | "bin" | "unknown";
  payload: Record<string, unknown>;
};

export type FeedbackStatus = "idle" | "success" | "error";

export function createScanRecord(params: {
  raw: string;
  normalized: string;
  parsedType: ScanRecord["parsedType"];
  resolvedKind: ScanRecord["resolvedKind"];
  source: ScanSource;
  status: ScanRecord["status"];
  message?: string;
}): ScanRecord {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    raw: params.raw,
    normalized: params.normalized,
    parsedType: params.parsedType,
    resolvedKind: params.resolvedKind,
    source: params.source,
    status: params.status,
    message: params.message,
    timestamp: new Date().toISOString(),
  };
}
