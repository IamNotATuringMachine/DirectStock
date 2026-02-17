import { FormEvent, useCallback, useMemo, useState } from "react";
import {
  Scan,
  Search,
  History,
  Box,
  ClipboardCheck,
  Zap,
  WifiOff
} from "lucide-react";

import CameraScanner from "../components/scanner/CameraScanner";
import ExternalScannerListener from "../components/scanner/ExternalScannerListener";
import ScanFeedback from "../components/scanner/ScanFeedback";
import { fetchProductByEan, fetchProductByQr } from "../services/productsApi";
import { useScannerStore } from "../stores/scannerStore";
import type { ScanRecord, ScanSource } from "../stores/scannerStore";
import { fetchBinByQr } from "../services/warehousesApi";
import { parseScanValue } from "../utils/scannerUtils";

type ScanResult = {
  input: string;
  kind: "product" | "bin" | "unknown";
  payload: Record<string, unknown>;
};

type FeedbackStatus = "idle" | "success" | "error";

function createScanRecord(params: {
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

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await runLookup(code, "manual");
  };

  const displayedHistory = useMemo(() => recentScans.slice(0, 10), [recentScans]);

  return (
    <div className="page" data-testid="scanner-page">
      <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500">
        <ExternalScannerListener onScan={(value) => void runLookup(value, "external")} />

        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--line)] pb-6">
          <div>
            <h1 className="page-title">
              Scanner
            </h1>
            <p className="section-subtitle mt-2">
              Universeller Scanner für Produkte und Lagerplätze.
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left Column - Controls & Scanner */}
          <div className="lg:col-span-4 space-y-6">

            {/* Controls Card */}
            <section className="bg-[var(--panel)] text-[var(--ink)] border border-[var(--line)] shadow-sm rounded-[var(--radius-lg)] p-6">
              <h2 className="section-title mb-4 flex items-center gap-2">
                <Scan className="h-5 w-5 text-[var(--accent)]" />
                Eingabe
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="form-label-standard">
                    Modus
                  </label>
                  <select
                    value={mode}
                    onChange={(event) => setMode(event.target.value as typeof mode)}
                    className="input w-full"
                  >
                    <option value="lookup">Lookup (Info)</option>
                    <option value="goods_receipt">Wareneingang</option>
                    <option value="goods_issue">Warenausgang</option>
                    <option value="stock_transfer">Umlagerung</option>
                  </select>
                </div>

                <form onSubmit={(event) => void onSubmit(event)} className="space-y-2">
                  <label className="form-label-standard">
                    Manueller Scan
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-grow">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <Scan className="h-5 w-5 text-[var(--muted)]" aria-hidden="true" />
                      </div>
                      <input
                        type="text"
                        className="input input-leading-icon w-full"
                        placeholder="Barcode / QR-Code..."
                        value={code}
                        onChange={(event) => setCode(event.target.value)}
                        autoFocus
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="btn btn-primary"
                    >
                      {loading ? "..." : "Suchen"}
                    </button>
                  </div>
                </form>
              </div>
            </section>

            {/* Feedback & Error */}
            <div className="space-y-4">
              <ScanFeedback status={feedbackStatus} message={feedbackMessage} />
              {error && (
                <div className="rounded-[var(--radius-sm)] bg-red-500/10 p-4 border border-red-500/20">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <WifiOff className="h-5 w-5 text-red-600" aria-hidden="true" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-600">
                        Fehler beim Scannen
                      </h3>
                      <div className="mt-2 text-sm text-red-600/90 break-words">
                        <p>{error}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Camera Scanner */}
            <section className="bg-[var(--panel)] text-[var(--ink)] border border-[var(--line)] shadow-sm rounded-[var(--radius-lg)] overflow-hidden">
              <div className="p-4 border-b border-[var(--line)] bg-[var(--panel-soft)]">
                <h3 className="section-title flex items-center gap-2">
                  <Zap className="h-4 w-4 text-[var(--muted)]" />
                  Kamera
                </h3>
              </div>
              <div className="p-4 relative">
                <CameraScanner onScan={(value) => void runLookup(value, "camera")} />
              </div>
            </section>

          </div>

          {/* Right Column - Results & History */}
          <div className="lg:col-span-8 space-y-6">

            {/* Result Card */}
            <section className="bg-[var(--panel)] text-[var(--ink)] border border-[var(--line)] shadow-sm rounded-[var(--radius-lg)] h-fit">
              <div className="p-6">
                <h2 className="section-title leading-7 flex items-center gap-2 mb-4">
                  <Search className="h-5 w-5 text-[var(--accent)]" />
                  Ergebnis
                </h2>

                <div className="mt-2 text-sm text-[var(--muted)] min-h-[120px]">
                  {result ? (
                    <div className="bg-[var(--code-bg)] rounded-[var(--radius-sm)] p-4 font-mono text-xs overflow-auto max-h-[400px] border border-[var(--line)] text-[var(--ink)]">
                      <pre className="whitespace-pre-wrap break-words">
                        {JSON.stringify(result, null, 2)}
                      </pre>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-32 text-[var(--muted)] border-2 border-dashed border-[var(--line)] rounded-[var(--radius-lg)] bg-[var(--panel-soft)]">
                      <Search className="h-8 w-8 mb-2 opacity-50" />
                      <p>Noch kein Ergebnis</p>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* History Card */}
            <section className="bg-[var(--panel)] text-[var(--ink)] border border-[var(--line)] shadow-sm rounded-[var(--radius-lg)]">
              <div className="p-6">
                <h2 className="section-title leading-7 flex items-center gap-2 mb-4">
                  <History className="h-5 w-5 text-[var(--muted)]" />
                  Verlauf
                </h2>
                <div className="flow-root">
                  <ul role="list" className="-my-5 divide-y divide-[var(--line)]">
                    {displayedHistory.length > 0 ? (
                      displayedHistory.map((item) => (
                        <li key={item.id} className="py-4">
                          <div className="flex items-center gap-x-3">
                            <div className="flex-none">
                              {item.resolvedKind === 'product' && <Box className="h-5 w-5 text-[var(--accent)]" />}
                              {item.resolvedKind === 'bin' && <ClipboardCheck className="h-5 w-5 text-emerald-500" />}
                              {item.resolvedKind === 'unknown' && <Search className="h-5 w-5 text-[var(--muted)]" />}
                            </div>
                            <div className="min-w-0 flex-auto">
                              <p className="text-sm font-medium leading-6 text-[var(--ink)] truncate">
                                {item.raw}
                              </p>
                              <div className="flex items-center gap-x-2 text-xs leading-5 text-[var(--muted)]">
                                <span className="capitalize hidden sm:inline">{item.source}</span>
                                <span className="hidden sm:inline">•</span>
                                <span className={`capitalize px-1.5 py-0.5 rounded text-[10px] font-semibold border ${item.status === 'success' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-red-500/10 text-red-600 border-red-500/20'}`}>
                                  {item.status}
                                </span>
                              </div>
                            </div>
                            <div className="flex-none">
                              <time className="text-xs text-[var(--muted)] bg-[var(--panel-soft)] px-2 py-1 rounded ring-1 ring-[var(--line)]">
                                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </time>
                            </div>
                          </div>
                        </li>
                      ))
                    ) : (
                      <li className="py-8 text-center text-sm text-[var(--muted)] italic">
                        Keine Historie vorhanden.
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
