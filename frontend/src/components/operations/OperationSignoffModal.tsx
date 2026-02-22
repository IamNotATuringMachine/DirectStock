import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import type {
  CompletionSignoffPayload,
  OperationSignoffSettings,
  OperatorUnlockResponse,
  SignaturePoint,
  SignatureStroke,
  WarehouseOperator,
} from "../../types";

type OperationSignoffModalProps = {
  isOpen: boolean;
  title: string;
  operators: WarehouseOperator[];
  settings: OperationSignoffSettings | null;
  loading?: boolean;
  submitting?: boolean;
  onClose: () => void;
  onUnlock: (pin: string) => Promise<OperatorUnlockResponse>;
  onSetOperatorPin: (operatorId: number, pin: string) => Promise<WarehouseOperator>;
  onEnableOperatorPin: (operatorId: number) => Promise<WarehouseOperator>;
  onConfirm: (payload: CompletionSignoffPayload) => Promise<void> | void;
};

type PinSessionState = {
  operatorId: number;
  operatorName: string;
  token: string;
  expiresAt: string;
};

const CANVAS_HEIGHT = 220;

function drawSignature(canvas: HTMLCanvasElement, strokes: SignatureStroke[]) {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.lineJoin = "round";
  context.lineCap = "round";
  context.strokeStyle = "#111827";
  context.lineWidth = 2.5;

  for (const stroke of strokes) {
    if (stroke.points.length === 0) {
      continue;
    }

    const first = stroke.points[0];
    if (!first) {
      continue;
    }

    context.beginPath();
    context.moveTo(first.x, first.y);

    for (let index = 1; index < stroke.points.length; index += 1) {
      const point = stroke.points[index];
      if (!point) {
        continue;
      }
      context.lineTo(point.x, point.y);
    }

    if (stroke.points.length === 1) {
      context.lineTo(first.x + 0.1, first.y + 0.1);
    }

    context.stroke();
  }
}

export function OperationSignoffModal({
  isOpen,
  title,
  operators,
  settings,
  loading = false,
  submitting = false,
  onClose,
  onUnlock,
  onSetOperatorPin,
  onEnableOperatorPin,
  onConfirm,
}: OperationSignoffModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const drawingPointerIdRef = useRef<number | null>(null);

  const [selectedOperatorId, setSelectedOperatorId] = useState<string>("");
  const [strokes, setStrokes] = useState<SignatureStroke[]>([]);
  const [pinInput, setPinInput] = useState("");
  const [pinSetupInput, setPinSetupInput] = useState("");
  const [pinSession, setPinSession] = useState<PinSessionState | null>(null);
  const [operatorOverrides, setOperatorOverrides] = useState<Record<number, { has_pin: boolean; pin_enabled: boolean }>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUnlockingPin, setIsUnlockingPin] = useState(false);
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [isEnablingPin, setIsEnablingPin] = useState(false);

  const requiresPin = Boolean(settings?.require_pin);
  const requiresOperatorSelection = settings?.require_operator_selection ?? true;
  const mergedOperators = useMemo(
    () =>
      operators.map((operator) => {
        const override = operatorOverrides[operator.id];
        if (!override) {
          return operator;
        }
        return {
          ...operator,
          has_pin: override.has_pin,
          pin_enabled: override.pin_enabled,
        };
      }),
    [operators, operatorOverrides]
  );
  const activeOperators = useMemo(
    () => mergedOperators.filter((operator) => operator.is_active),
    [mergedOperators]
  );
  const selectedOperator = activeOperators.find((operator) => String(operator.id) === selectedOperatorId) ?? null;
  const operatorHasPinConfigured = Boolean(selectedOperator?.has_pin);
  const operatorPinModeEnabled = Boolean(selectedOperator?.pin_enabled);
  const requiresPinSetup = requiresPin && requiresOperatorSelection && selectedOperator !== null && !operatorHasPinConfigured;
  const requiresPinEnable =
    requiresPin && requiresOperatorSelection && selectedOperator !== null && operatorHasPinConfigured && !operatorPinModeEnabled;
  const canUnlockSelectedOperator =
    requiresPin &&
    (!requiresOperatorSelection || (selectedOperator !== null && operatorHasPinConfigured && operatorPinModeEnabled));

  const ensureCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = canvasContainerRef.current;
    if (!canvas || !container) {
      return;
    }

    const width = Math.max(320, Math.floor(container.clientWidth));
    if (canvas.width !== width || canvas.height !== CANVAS_HEIGHT) {
      canvas.width = width;
      canvas.height = CANVAS_HEIGHT;
    }
    drawSignature(canvas, strokes);
  }, [strokes]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    ensureCanvasSize();
    const onResize = () => ensureCanvasSize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, [ensureCanvasSize, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    ensureCanvasSize();
  }, [ensureCanvasSize, isOpen, strokes]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedOperatorId("");
      setStrokes([]);
      setPinInput("");
      setPinSetupInput("");
      setPinSession(null);
      setOperatorOverrides({});
      setErrorMessage(null);
      return;
    }

    if (requiresOperatorSelection && !selectedOperatorId && activeOperators.length > 0) {
      setSelectedOperatorId(String(activeOperators[0]?.id ?? ""));
    }
  }, [activeOperators, isOpen, requiresOperatorSelection, selectedOperatorId]);

  if (!isOpen) {
    return null;
  }

  const extractPoint = (event: ReactPointerEvent<HTMLCanvasElement>): SignaturePoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return null;
    }

    return {
      x: ((event.clientX - rect.left) * canvas.width) / rect.width,
      y: ((event.clientY - rect.top) * canvas.height) / rect.height,
      t: Date.now(),
    };
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const point = extractPoint(event);
    if (!point) {
      return;
    }

    drawingPointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    setErrorMessage(null);
    setStrokes((prev) => [...prev, { points: [point] }]);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (drawingPointerIdRef.current !== event.pointerId) {
      return;
    }

    const point = extractPoint(event);
    if (!point) {
      return;
    }

    setStrokes((prev) => {
      if (prev.length === 0) {
        return prev;
      }
      const next = [...prev];
      const last = next[next.length - 1];
      if (!last) {
        return prev;
      }
      next[next.length - 1] = { points: [...last.points, point] };
      return next;
    });
  };

  const finishStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (drawingPointerIdRef.current !== event.pointerId) {
      return;
    }

    drawingPointerIdRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // no-op: release may fail if capture is already gone.
    }
  };

  const onSetPinClick = async () => {
    if (!selectedOperator) {
      setErrorMessage("Bitte einen aktiven Mitarbeiter auswählen.");
      return;
    }

    const value = pinSetupInput.trim();
    if (value.length < 4) {
      setErrorMessage("PIN muss mindestens 4 Zeichen haben.");
      return;
    }

    setIsSettingPin(true);
    setErrorMessage(null);
    try {
      await onSetOperatorPin(selectedOperator.id, value);
      setOperatorOverrides((prev) => ({
        ...prev,
        [selectedOperator.id]: { has_pin: true, pin_enabled: true },
      }));
      setPinSetupInput("");
      setPinInput(value);
    } catch {
      setErrorMessage("PIN konnte nicht gesetzt werden.");
    } finally {
      setIsSettingPin(false);
    }
  };

  const onEnablePinClick = async () => {
    if (!selectedOperator) {
      setErrorMessage("Bitte einen aktiven Mitarbeiter auswählen.");
      return;
    }
    setIsEnablingPin(true);
    setErrorMessage(null);
    try {
      await onEnableOperatorPin(selectedOperator.id);
      setOperatorOverrides((prev) => ({
        ...prev,
        [selectedOperator.id]: { has_pin: true, pin_enabled: true },
      }));
    } catch {
      setErrorMessage("PIN-Modus konnte nicht aktiviert werden.");
    } finally {
      setIsEnablingPin(false);
    }
  };

  const onUnlockClick = async () => {
    if (requiresOperatorSelection && !canUnlockSelectedOperator) {
      setErrorMessage("Bitte zuerst PIN für den ausgewählten Mitarbeiter einrichten.");
      return;
    }

    if (!pinInput.trim()) {
      setErrorMessage("Bitte PIN eingeben.");
      return;
    }

    setIsUnlockingPin(true);
    setErrorMessage(null);
    try {
      const unlocked = await onUnlock(pinInput.trim());
      setPinSession({
        operatorId: unlocked.operator_id,
        operatorName: unlocked.operator_name,
        token: unlocked.session_token,
        expiresAt: unlocked.expires_at,
      });
      setSelectedOperatorId(String(unlocked.operator_id));
      setPinInput("");
    } catch {
      setErrorMessage("PIN-Entsperrung fehlgeschlagen.");
    } finally {
      setIsUnlockingPin(false);
    }
  };

  const hasSignature = strokes.some((stroke) => stroke.points.length > 0);

  const onConfirmClick = async () => {
    let operatorId: number | null = null;
    if (requiresOperatorSelection) {
      const parsedOperatorId = Number(selectedOperatorId);
      if (!selectedOperator || !Number.isFinite(parsedOperatorId) || parsedOperatorId <= 0) {
        setErrorMessage("Bitte einen aktiven Mitarbeiter auswählen.");
        return;
      }
      operatorId = parsedOperatorId;
    }

    if (!hasSignature) {
      setErrorMessage("Bitte Unterschrift erfassen.");
      return;
    }

    if (requiresPin) {
      if (requiresOperatorSelection && (!operatorHasPinConfigured || !operatorPinModeEnabled)) {
        setErrorMessage("Bitte zuerst PIN für den ausgewählten Mitarbeiter einrichten.");
        return;
      }
      if (!pinSession) {
        setErrorMessage(
          requiresOperatorSelection
            ? "Bitte den ausgewählten Mitarbeiter per PIN entsperren."
            : "Bitte Signoff per PIN entsperren."
        );
        return;
      }
      if (operatorId !== null && pinSession.operatorId !== operatorId) {
        setErrorMessage("Bitte den ausgewählten Mitarbeiter per PIN entsperren.");
        return;
      }
      if (operatorId === null) {
        operatorId = pinSession.operatorId;
      }
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      setErrorMessage("Signaturfeld ist nicht verfügbar.");
      return;
    }

    setErrorMessage(null);
    await onConfirm({
      operator_id: operatorId,
      signature_payload: {
        strokes,
        canvas_width: canvas.width,
        canvas_height: canvas.height,
        captured_at: new Date().toISOString(),
      },
      pin_session_token: requiresPin ? pinSession?.token : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/45 p-4 flex items-center justify-center" data-testid="operation-signoff-modal">
      <div
        className="w-full max-w-3xl rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--panel)] p-5 md:p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="section-title">{title}</h3>
          <button className="btn btn-ghost" type="button" onClick={onClose} disabled={submitting || isUnlockingPin}>
            Schließen
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {requiresOperatorSelection ? (
            <label className="flex flex-col gap-1.5">
              <span className="form-label-standard">Mitarbeiter</span>
              <select
                className="input w-full"
                value={selectedOperatorId}
                onChange={(event) => {
                  setSelectedOperatorId(event.target.value);
                  setErrorMessage(null);
                  setPinSetupInput("");
                  if (pinSession && String(pinSession.operatorId) !== event.target.value) {
                    setPinSession(null);
                  }
                }}
                disabled={loading || submitting || isSettingPin || isEnablingPin || activeOperators.length === 0}
                data-testid="operation-signoff-operator-select"
              >
                {activeOperators.length === 0 ? <option value="">Keine aktiven Mitarbeiter</option> : null}
                {activeOperators.map((operator) => (
                  <option key={operator.id} value={operator.id}>
                    {operator.display_name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="rounded-[var(--radius-sm)] border border-[var(--line)] p-3 bg-[var(--panel-soft)] text-sm text-[var(--muted)]">
              Namensauswahl ist deaktiviert.
            </div>
          )}

          {requiresPin ? (
            <div className="rounded-[var(--radius-sm)] border border-[var(--line)] p-3 bg-[var(--panel-soft)]">
              <div className="text-sm font-medium mb-2">PIN-Entsperrung erforderlich</div>
              {requiresPinSetup ? (
                <div className="space-y-2">
                  <p className="text-xs text-[var(--muted)]">
                    Für diesen Mitarbeiter ist noch keine PIN hinterlegt. Bitte jetzt eine PIN vergeben.
                  </p>
                  <div className="flex gap-2 items-center">
                    <input
                      className="input w-full"
                      type="password"
                      inputMode="numeric"
                      placeholder="Neue PIN (mind. 4 Zeichen)"
                      value={pinSetupInput}
                      onChange={(event) => setPinSetupInput(event.target.value)}
                      disabled={submitting || isSettingPin}
                      data-testid="operation-signoff-pin-setup-input"
                    />
                    <button
                      className="btn"
                      type="button"
                      onClick={() => void onSetPinClick()}
                      disabled={submitting || isSettingPin}
                      data-testid="operation-signoff-pin-setup-btn"
                    >
                      {isSettingPin ? "Speichert..." : "PIN setzen"}
                    </button>
                  </div>
                </div>
              ) : null}
              {requiresPinEnable ? (
                <div className="space-y-2">
                  <p className="text-xs text-[var(--muted)]">
                    Für diesen Mitarbeiter ist eine PIN vorhanden, aber der PIN-Modus ist deaktiviert.
                  </p>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => void onEnablePinClick()}
                    disabled={submitting || isEnablingPin}
                    data-testid="operation-signoff-pin-enable-btn"
                  >
                    {isEnablingPin ? "Aktiviert..." : "PIN-Modus aktivieren"}
                  </button>
                </div>
              ) : null}
              {canUnlockSelectedOperator ? (
                <div className="flex gap-2 items-center">
                  <input
                    className="input w-full"
                    type="password"
                    inputMode="numeric"
                    placeholder="PIN eingeben"
                    value={pinInput}
                    onChange={(event) => setPinInput(event.target.value)}
                    disabled={submitting || isUnlockingPin}
                    data-testid="operation-signoff-pin-input"
                  />
                  <button
                    className="btn"
                    type="button"
                    onClick={() => void onUnlockClick()}
                    disabled={submitting || isUnlockingPin}
                    data-testid="operation-signoff-pin-unlock-btn"
                  >
                    Entsperren
                  </button>
                </div>
              ) : null}
              {pinSession ? (
                <p className="mt-2 text-xs text-[var(--muted)]" data-testid="operation-signoff-pin-status">
                  Entsperrt: {pinSession.operatorName} bis {new Date(pinSession.expiresAt).toLocaleTimeString()}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="rounded-[var(--radius-sm)] border border-[var(--line)] p-3 bg-[var(--panel-soft)] text-sm text-[var(--muted)]">
              PIN-Modus ist aktuell deaktiviert.
            </div>
          )}
        </div>

        <div className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-white p-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Unterschrift</span>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => setStrokes([])}
              disabled={submitting || strokes.length === 0}
              data-testid="operation-signoff-signature-clear"
            >
              Zurücksetzen
            </button>
          </div>
          <div ref={canvasContainerRef} className="w-full">
            <canvas
              ref={canvasRef}
              className="w-full border border-dashed border-slate-300 rounded-md touch-none bg-white"
              style={{ height: `${CANVAS_HEIGHT}px` }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={finishStroke}
              onPointerLeave={finishStroke}
              data-testid="operation-signoff-signature-canvas"
            />
          </div>
        </div>

        {errorMessage ? <p className="text-sm text-[var(--danger)] mb-3">{errorMessage}</p> : null}

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button className="btn" type="button" onClick={onClose} disabled={submitting || isUnlockingPin}>
            Abbrechen
          </button>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => void onConfirmClick()}
            disabled={loading || submitting || isSettingPin || isEnablingPin || activeOperators.length === 0}
            data-testid="operation-signoff-confirm-btn"
          >
            {submitting ? "Speichert..." : "Abschluss bestätigen"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default OperationSignoffModal;
