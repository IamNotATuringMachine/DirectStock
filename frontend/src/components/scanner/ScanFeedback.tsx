import { useEffect, useRef } from "react";

type ScanFeedbackStatus = "idle" | "success" | "error";

type ScanFeedbackProps = {
  status: ScanFeedbackStatus;
  message?: string | null;
};

function playTone(frequency: number, durationMs: number) {
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) {
    return;
  }

  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  gainNode.gain.value = 0.06;

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);

  oscillator.start();
  window.setTimeout(() => {
    oscillator.stop();
    void context.close();
  }, durationMs);
}

export default function ScanFeedback({ status, message }: ScanFeedbackProps) {
  const previousStatus = useRef<ScanFeedbackStatus>("idle");

  useEffect(() => {
    if (status === "idle" || status === previousStatus.current) {
      previousStatus.current = status;
      return;
    }

    if (status === "success") {
      playTone(920, 90);
      window.navigator.vibrate?.(35);
    }

    if (status === "error") {
      playTone(220, 120);
      window.navigator.vibrate?.([40, 30, 40]);
    }

    previousStatus.current = status;
  }, [status]);

  return (
    <div className={`scan-feedback scan-feedback-${status}`}>
      <strong>
        {status === "success"
          ? "Scan erfolgreich"
          : status === "error"
            ? "Scan fehlgeschlagen"
            : "Bereit"}
      </strong>
      <span>{message ?? ""}</span>
    </div>
  );
}
