import { type FormEvent, useCallback, useMemo, useState } from "react";

import { fetchProductByEan, fetchProductByQr } from "../services/productsApi";
import { fetchBinByQr } from "../services/warehousesApi";
import { useScannerStore } from "../stores/scannerStore";
import type { ScanSource } from "../stores/scannerStore";
import { parseScanValue } from "../utils/scannerUtils";
import { ScannerView } from "./scanner/ScannerView";
import { createScanRecord, type FeedbackStatus, type ScanResult } from "./scanner/model";

export default function ScannerPage() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState<FeedbackStatus>("idle");
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const mode = useScannerStore((state) => state.mode);
  const setMode = useScannerStore((state) => state.setMode);
  const recentScans = useScannerStore((state) => state.recentScans);
  const addScan = useScannerStore((state) => state.addScan);

  const resolveScan = useCallback(async (input: string) => {
    const parsed = parseScanValue(input);

    if (parsed.type === "bin_qr") {
      const bin = await fetchBinByQr(parsed.normalized);
      return {
        parsed,
        resolvedKind: "bin" as const,
        payload: bin as unknown as Record<string, unknown>,
      };
    }

    if (parsed.type === "product_qr") {
      const product = await fetchProductByQr(parsed.normalized);
      return {
        parsed,
        resolvedKind: "product" as const,
        payload: product as unknown as Record<string, unknown>,
      };
    }

    if (parsed.type === "ean") {
      const product = await fetchProductByEan(parsed.value);
      return {
        parsed,
        resolvedKind: "product" as const,
        payload: product as unknown as Record<string, unknown>,
      };
    }

    try {
      const product = await fetchProductByQr(parsed.normalized);
      return {
        parsed,
        resolvedKind: "product" as const,
        payload: product as unknown as Record<string, unknown>,
      };
    } catch {
      const bin = await fetchBinByQr(parsed.normalized);
      return {
        parsed,
        resolvedKind: "bin" as const,
        payload: bin as unknown as Record<string, unknown>,
      };
    }
  }, []);

  const runLookup = useCallback(
    async (rawInput: string, source: ScanSource) => {
      const input = rawInput.trim();
      if (!input) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const resolved = await resolveScan(input);
        const nextResult: ScanResult = {
          input,
          kind: resolved.resolvedKind,
          payload: resolved.payload,
        };

        setResult(nextResult);
        setFeedbackStatus("success");
        setFeedbackMessage(
          `${resolved.resolvedKind === "product" ? "Produkt" : resolved.resolvedKind === "bin" ? "Lagerplatz" : "Element"} erkannt`
        );

        addScan(
          createScanRecord({
            raw: input,
            normalized: resolved.parsed.normalized,
            parsedType: resolved.parsed.type,
            resolvedKind: resolved.resolvedKind,
            source,
            status: "success",
            message: "Scan erfolgreich aufgelöst",
          })
        );
      } catch {
        const parsed = parseScanValue(input);
        const offline = typeof navigator !== "undefined" && !navigator.onLine;

        if (offline) {
          addScan(
            createScanRecord({
              raw: input,
              normalized: parsed.normalized,
              parsedType: parsed.type,
              resolvedKind: "unknown",
              source,
              status: "error",
              message: "Offline: Lookup nicht verfügbar",
            })
          );
          setError("Offline: Lookup nicht möglich. Bitte prüfen Sie Ihre Verbindung.");
          setFeedbackStatus("error");
          setFeedbackMessage("Offline");
          return;
        }

        addScan(
          createScanRecord({
            raw: input,
            normalized: parsed.normalized,
            parsedType: parsed.type,
            resolvedKind: "unknown",
            source,
            status: "error",
            message: "Scan konnte nicht aufgelöst werden",
          })
        );

        setError("Scan konnte nicht aufgelöst werden.");
        setFeedbackStatus("error");
        setFeedbackMessage("Kein Treffer");
      } finally {
        setLoading(false);
      }
    },
    [addScan, resolveScan]
  );

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runLookup(code, "manual");
  };

  const displayedHistory = useMemo(() => recentScans.slice(0, 10), [recentScans]);

  return (
    <ScannerView
      mode={mode}
      onModeChange={setMode}
      code={code}
      onCodeChange={setCode}
      loading={loading}
      onManualSubmit={(event) => void onSubmit(event)}
      feedbackStatus={feedbackStatus}
      feedbackMessage={feedbackMessage}
      error={error}
      result={result}
      displayedHistory={displayedHistory}
      onExternalScan={(value) => void runLookup(value, "external")}
      onCameraScan={(value) => void runLookup(value, "camera")}
    />
  );
}
