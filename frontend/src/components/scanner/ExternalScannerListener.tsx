import { useEffect, useRef } from "react";

import { isRapidScannerKeystroke } from "../../utils/scannerUtils";

type ExternalScannerListenerProps = {
  enabled?: boolean;
  onScan: (value: string) => void;
};

export default function ExternalScannerListener({
  enabled = true,
  onScan,
}: ExternalScannerListenerProps) {
  const bufferRef = useRef("");
  const lastTimestampRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const resetBuffer = () => {
      bufferRef.current = "";
      lastTimestampRef.current = null;
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (event.key === "Enter") {
        const value = bufferRef.current;
        if (value.length >= 3) {
          onScan(value);
          event.preventDefault();
        }
        resetBuffer();
        return;
      }

      if (event.key.length !== 1) {
        return;
      }

      const now = performance.now();
      if (!isRapidScannerKeystroke(now, lastTimestampRef.current, 50)) {
        bufferRef.current = "";
      }

      bufferRef.current += event.key;
      lastTimestampRef.current = now;

      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(() => {
        resetBuffer();
      }, 120);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      resetBuffer();
    };
  }, [enabled, onScan]);

  return null;
}
