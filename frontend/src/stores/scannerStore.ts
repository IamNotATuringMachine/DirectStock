import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { ParsedScanType } from "../utils/scannerUtils";

export type ScanMode = "lookup" | "goods_receipt" | "goods_issue" | "stock_transfer";
export type ScanSource = "camera" | "external" | "manual";
export type ScanStatus = "success" | "error";

export type ScanRecord = {
  id: string;
  raw: string;
  normalized: string;
  parsedType: ParsedScanType;
  resolvedKind: "product" | "bin" | "unknown";
  source: ScanSource;
  status: ScanStatus;
  message?: string;
  timestamp: string;
};

type ScannerState = {
  mode: ScanMode;
  lastScan: ScanRecord | null;
  recentScans: ScanRecord[];
  setMode: (mode: ScanMode) => void;
  addScan: (scan: ScanRecord) => void;
};

export const useScannerStore = create<ScannerState>()(
  persist(
    (set) => ({
      mode: "lookup",
      lastScan: null,
      recentScans: [],
      setMode: (mode) => set({ mode }),
      addScan: (scan) =>
        set((state) => ({
          lastScan: scan,
          recentScans: [scan, ...state.recentScans].slice(0, 25),
        })),
    }),
    {
      name: "directstock-scanner",
      partialize: (state) => ({
        mode: state.mode,
        recentScans: state.recentScans,
      }),
    }
  )
);
