import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { ParsedScanType } from "../utils/scannerUtils";

export type ScanMode = "lookup" | "goods_receipt" | "goods_issue" | "stock_transfer";
export type ScanSource = "camera" | "external" | "manual" | "queue";
export type ScanStatus = "success" | "error" | "queued";

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
  offlineQueue: ScanRecord[];
  setMode: (mode: ScanMode) => void;
  addScan: (scan: ScanRecord) => void;
  enqueueOffline: (scan: ScanRecord) => void;
  dequeueOffline: () => ScanRecord | null;
  clearOfflineQueue: () => void;
};

export const useScannerStore = create<ScannerState>()(
  persist(
    (set, get) => ({
      mode: "lookup",
      lastScan: null,
      recentScans: [],
      offlineQueue: [],
      setMode: (mode) => set({ mode }),
      addScan: (scan) =>
        set((state) => ({
          lastScan: scan,
          recentScans: [scan, ...state.recentScans].slice(0, 25),
        })),
      enqueueOffline: (scan) =>
        set((state) => ({
          offlineQueue: [...state.offlineQueue, scan],
        })),
      dequeueOffline: () => {
        const queue = get().offlineQueue;
        if (queue.length === 0) {
          return null;
        }
        const [first, ...rest] = queue;
        set({ offlineQueue: rest });
        return first;
      },
      clearOfflineQueue: () => set({ offlineQueue: [] }),
    }),
    {
      name: "directstock-scanner",
      partialize: (state) => ({
        mode: state.mode,
        recentScans: state.recentScans,
        offlineQueue: state.offlineQueue,
      }),
    }
  )
);
