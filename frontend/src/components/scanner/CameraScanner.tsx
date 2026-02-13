import { useEffect, useMemo, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

type CameraScannerProps = {
  onScan: (value: string) => void;
};

export default function CameraScanner({ onScan }: CameraScannerProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastDecodedRef = useRef<{ value: string; timestamp: number } | null>(null);

  const containerId = useMemo(
    () => `camera-scanner-${Math.random().toString(36).slice(2, 10)}`,
    []
  );

  const startScanner = async () => {
    if (isRunning) {
      return;
    }

    setError(null);

    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(containerId, { verbose: false });
      }

      await scannerRef.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 300, height: 300 },
        },
        (decodedText) => {
          const now = Date.now();
          const last = lastDecodedRef.current;
          if (last && last.value === decodedText && now - last.timestamp < 1200) {
            return;
          }

          lastDecodedRef.current = { value: decodedText, timestamp: now };
          onScan(decodedText);
        },
        () => {
          // Decoder errors are expected during scanning, ignore noisy callback.
        }
      );

      setIsRunning(true);
    } catch {
      setError("Kamera konnte nicht gestartet werden.");
    }
  };

  const stopScanner = async () => {
    if (!scannerRef.current || !isRunning) {
      return;
    }

    try {
      await scannerRef.current.stop();
      await scannerRef.current.clear();
    } finally {
      setIsRunning(false);
      scannerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (!scannerRef.current) {
        return;
      }
      void scannerRef.current
        .stop()
        .then(() => scannerRef.current?.clear())
        .catch(() => {
          // best effort cleanup
        });
    };
  }, []);

  return (
    <article className="subpanel">
      <h3>Kamera-Scanner</h3>
      <div id={containerId} className="camera-scanner" />
      <div className="actions-cell">
        <button className="btn" onClick={() => void startScanner()} disabled={isRunning}>
          Kamera starten
        </button>
        <button className="btn" onClick={() => void stopScanner()} disabled={!isRunning}>
          Kamera stoppen
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
    </article>
  );
}
