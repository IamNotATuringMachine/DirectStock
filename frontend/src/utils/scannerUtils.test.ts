import { describe, expect, it } from "vitest";

import {
  isEan13,
  isRapidScannerKeystroke,
  normalizeScanValue,
  parseScanValue,
} from "./scannerUtils";

describe("scannerUtils", () => {
  it("normalizes scanner values", () => {
    expect(normalizeScanValue("  DS:BIN:A-01-01-01 \n")).toBe("DS:BIN:A-01-01-01");
  });

  it("parses DS:BIN format", () => {
    expect(parseScanValue("DS:BIN:A-01-01-01")).toEqual({
      raw: "DS:BIN:A-01-01-01",
      normalized: "DS:BIN:A-01-01-01",
      type: "bin_qr",
      value: "A-01-01-01",
    });
  });

  it("parses DS:ART format", () => {
    expect(parseScanValue("DS:ART:ART-100")).toEqual({
      raw: "DS:ART:ART-100",
      normalized: "DS:ART:ART-100",
      type: "product_qr",
      value: "ART-100",
    });
  });

  it("parses DS:PO format", () => {
    expect(parseScanValue("DS:PO:PO-20260001")).toEqual({
      raw: "DS:PO:PO-20260001",
      normalized: "DS:PO:PO-20260001",
      type: "po_qr",
      value: "PO-20260001",
    });
  });

  it("parses DS:SN format", () => {
    expect(parseScanValue("DS:SN:SN-ABC-001")).toEqual({
      raw: "DS:SN:SN-ABC-001",
      normalized: "DS:SN:SN-ABC-001",
      type: "serial_qr",
      value: "SN-ABC-001",
    });
  });

  it("detects EAN13", () => {
    expect(isEan13("4006381333931")).toBe(true);
    expect(parseScanValue("4006381333931").type).toBe("ean");
  });

  it("falls back to unknown", () => {
    expect(parseScanValue("SOMETHING-ELSE").type).toBe("unknown");
  });

  it("detects rapid scanner keystrokes", () => {
    expect(isRapidScannerKeystroke(1000, null)).toBe(true);
    expect(isRapidScannerKeystroke(1040, 1000, 50)).toBe(true);
    expect(isRapidScannerKeystroke(1120, 1000, 50)).toBe(false);
  });
});
