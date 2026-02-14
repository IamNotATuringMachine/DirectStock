import { FormEvent, useCallback, useMemo, useState } from "react";

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
        setFeedbackMessage(`${resolved.resolvedKind.toUpperCase()} erkannt`);

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
              message: "Offline: Lookup nicht verfuegbar",
            })
          );
          setError("Offline: Lookup kann nicht synchronisiert werden. Nutze WE/WA/Umlagerung/Inventur fuer Queue-Sync.");
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

  const displayedHistory = useMemo(() => recentScans.slice(0, 12), [recentScans]);

  return (
    <section className="panel" data-testid="scanner-page">
      <ExternalScannerListener onScan={(value) => void runLookup(value, "external")} />

      <header className="panel-header">
        <div>
          <h2>Scanner</h2>
          <p className="panel-subtitle">Kamera-Scan und externer Scanner fuer Lookup-Workflows.</p>
        </div>
      </header>

      <div className="scan-controls">
        <label>
          Scan-Modus
          <select className="input" value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}>
            <option value="lookup">Lookup</option>
            <option value="goods_receipt">Wareneingang</option>
            <option value="goods_issue">Warenausgang</option>
            <option value="stock_transfer">Umlagerung</option>
          </select>
        </label>

      </div>

      <form className="scan-form" onSubmit={(event) => void onSubmit(event)}>
        <input
          className="input scan-input"
          placeholder="Code scannen oder eingeben"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          autoFocus
        />
        <button className="btn btn-primary" disabled={loading} type="submit">
          {loading ? "Suche..." : "Lookup"}
        </button>
      </form>

      <ScanFeedback status={feedbackStatus} message={feedbackMessage} />
      {error ? <p className="error">{error}</p> : null}

      <div className="two-col-grid">
        <CameraScanner onScan={(value) => void runLookup(value, "camera")} />

        <article className="subpanel">
          <h3>Ergebnis</h3>
          {result ? <pre className="code-block">{JSON.stringify(result, null, 2)}</pre> : <p>Noch kein Ergebnis.</p>}
        </article>
      </div>

      <article className="subpanel">
        <h3>Letzte Scans</h3>
        <div className="list-stack small">
          {displayedHistory.map((item) => (
            <div key={item.id} className="list-item static-item">
              <strong>{item.raw}</strong>
              <span>
                {item.source} | {item.status} | {item.resolvedKind}
              </span>
            </div>
          ))}
          {displayedHistory.length === 0 ? <p>Keine Historie.</p> : null}
        </div>
      </article>
    </section>
  );
}
