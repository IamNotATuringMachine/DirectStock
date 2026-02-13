import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import ExternalScannerListener from "../components/scanner/ExternalScannerListener";
import {
  completePickWave,
  createPickWave,
  fetchPickWave,
  fetchPickWaves,
  releasePickWave,
  updatePickTask,
} from "../services/pickingApi";
import { parseScanValue } from "../utils/scannerUtils";

export default function PickingPage() {
  const queryClient = useQueryClient();
  const [selectedWaveId, setSelectedWaveId] = useState<number | null>(null);
  const [scanTaskId, setScanTaskId] = useState<number | null>(null);
  const [scanInput, setScanInput] = useState("");
  const [scanStep, setScanStep] = useState<"await_bin" | "await_product">("await_bin");
  const [scanStatus, setScanStatus] = useState("Bitte Aufgabe auswählen.");

  const wavesQuery = useQuery({
    queryKey: ["pick-waves"],
    queryFn: fetchPickWaves,
  });

  const waveDetailQuery = useQuery({
    queryKey: ["pick-wave", selectedWaveId],
    queryFn: () => fetchPickWave(selectedWaveId as number),
    enabled: selectedWaveId !== null,
  });

  const createWaveMutation = useMutation({
    mutationFn: () => createPickWave({}),
    onSuccess: async (payload) => {
      await queryClient.invalidateQueries({ queryKey: ["pick-waves"] });
      setSelectedWaveId(payload.wave.id);
    },
  });

  const releaseWaveMutation = useMutation({
    mutationFn: (waveId: number) => releasePickWave(waveId),
    onSuccess: async (_, waveId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["pick-waves"] }),
        queryClient.invalidateQueries({ queryKey: ["pick-wave", waveId] }),
      ]);
    },
  });

  const completeWaveMutation = useMutation({
    mutationFn: (waveId: number) => completePickWave(waveId),
    onSuccess: async (_, waveId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["pick-waves"] }),
        queryClient.invalidateQueries({ queryKey: ["pick-wave", waveId] }),
      ]);
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: number; status: "open" | "picked" | "skipped" }) =>
      updatePickTask(taskId, { status }),
    onSuccess: async () => {
      if (selectedWaveId) {
        await queryClient.invalidateQueries({ queryKey: ["pick-wave", selectedWaveId] });
      }
    },
  });

  const selectedWave = useMemo(() => waveDetailQuery.data?.wave ?? null, [waveDetailQuery.data]);
  const tasks = waveDetailQuery.data?.tasks ?? [];
  const scanTask = tasks.find((item) => item.id === scanTaskId) ?? null;

  useEffect(() => {
    if (!tasks.length) {
      setScanTaskId(null);
      setScanStatus("Bitte Aufgabe auswählen.");
      return;
    }
    setScanTaskId((current) => current ?? tasks[0].id);
  }, [tasks]);

  useEffect(() => {
    const task = tasks.find((item) => item.id === scanTaskId) ?? null;
    if (!task) {
      return;
    }
    setScanStep(task.source_bin_code ? "await_bin" : "await_product");
    setScanStatus(task.source_bin_code ? "Bitte zuerst Bin scannen." : "Bitte Produkt scannen.");
    setScanInput("");
  }, [scanTaskId, tasks]);

  const normalize = (value: string | null | undefined) => (value ?? "").trim().toUpperCase();

  const matchesProductScan = (taskProductNumber: string, scannedValue: string) => {
    const expected = normalize(taskProductNumber);
    const normalized = normalize(scannedValue);
    return normalized === expected || normalized.endsWith(`:${expected}`);
  };

  const processScan = async (rawValue: string) => {
    if (!scanTask) {
      setScanStatus("Keine Aufgabe gewählt.");
      return;
    }
    const parsed = parseScanValue(rawValue);
    const scanned = parsed.type === "bin_qr" || parsed.type === "product_qr" ? parsed.value : parsed.normalized;

    if (scanStep === "await_bin" && scanTask.source_bin_code) {
      if (normalize(scanned) !== normalize(scanTask.source_bin_code)) {
        setScanStatus(`Falscher Bin: erwartet ${scanTask.source_bin_code}.`);
        return;
      }
      setScanStep("await_product");
      setScanStatus("Bin bestätigt. Jetzt Produkt scannen.");
      return;
    }

    if (!matchesProductScan(scanTask.product_number, scanned)) {
      setScanStatus(`Falsches Produkt: erwartet ${scanTask.product_number}.`);
      return;
    }

    await updateTaskMutation.mutateAsync({
      taskId: scanTask.id,
      status: "picked",
    });
    setScanStatus(`Task ${scanTask.id} als picked bestätigt.`);
    setScanInput("");
    setScanStep(scanTask.source_bin_code ? "await_bin" : "await_product");
  };

  const onScanSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const value = scanInput.trim();
    if (!value) {
      return;
    }
    await processScan(value);
  };

  return (
    <section className="panel" data-testid="picking-page">
      <ExternalScannerListener enabled={Boolean(selectedWave)} onScan={(value) => void processScan(value)} />
      <header className="panel-header">
        <div>
          <h2>Kommissionierung</h2>
          <p className="panel-subtitle">Pick-Waves erstellen, freigeben und scannergestuetzt abschliessen.</p>
        </div>
      </header>

      <div className="warehouse-grid">
        <article className="subpanel">
          <h3>Pick-Waves</h3>
          <button
            className="btn"
            onClick={() => void createWaveMutation.mutateAsync()}
            disabled={createWaveMutation.isPending}
            data-testid="pick-wave-create-btn"
          >
            Pick-Wave erstellen
          </button>

          <div className="list-stack" data-testid="pick-wave-list">
            {(wavesQuery.data ?? []).map((wave) => (
              <button
                key={wave.id}
                className={`list-item ${selectedWaveId === wave.id ? "active" : ""}`}
                onClick={() => setSelectedWaveId(wave.id)}
                data-testid={`pick-wave-item-${wave.id}`}
              >
                <strong>{wave.wave_number}</strong>
                <span>Status: {wave.status}</span>
              </button>
            ))}
            {!wavesQuery.isLoading && (wavesQuery.data?.length ?? 0) === 0 ? <p>Keine Pick-Waves vorhanden.</p> : null}
          </div>
        </article>

        <article className="subpanel">
          <h3>Details</h3>
          {!selectedWave ? <p>Bitte eine Pick-Wave auswählen.</p> : null}
          {selectedWave ? (
            <>
              <p data-testid="pick-wave-selected-status">
                {selectedWave.wave_number} | Status: <strong>{selectedWave.status}</strong>
              </p>
              <div className="actions-cell">
                <button
                  className="btn"
                  onClick={() => void releaseWaveMutation.mutateAsync(selectedWave.id)}
                  disabled={releaseWaveMutation.isPending || selectedWave.status !== "draft"}
                  data-testid="pick-wave-release-btn"
                >
                  Freigeben
                </button>
                <button
                  className="btn"
                  onClick={() => void completeWaveMutation.mutateAsync(selectedWave.id)}
                  disabled={completeWaveMutation.isPending || !["released", "in_progress"].includes(selectedWave.status)}
                  data-testid="pick-wave-complete-btn"
                >
                  Abschliessen
                </button>
              </div>

              <div className="subpanel" style={{ marginBottom: "1rem" }}>
                <h4>Scanner-Abschluss</h4>
                <label>
                  Aufgabe
                  <select
                    className="input"
                    value={scanTaskId ?? ""}
                    onChange={(event) => setScanTaskId(Number(event.target.value))}
                    data-testid="pick-scan-task-select"
                  >
                    {tasks.map((task) => (
                      <option key={task.id} value={task.id}>
                        #{task.id} | {task.source_bin_code ?? "-"} | {task.product_number} | {task.status}
                      </option>
                    ))}
                  </select>
                </label>
                <form className="scan-form" onSubmit={(event) => void onScanSubmit(event)}>
                  <input
                    className="input scan-input"
                    placeholder={scanStep === "await_bin" ? "Bin scannen" : "Produkt scannen"}
                    value={scanInput}
                    onChange={(event) => setScanInput(event.target.value)}
                    data-testid="pick-scan-input"
                  />
                  <button
                    className="btn btn-primary"
                    type="submit"
                    disabled={!scanTask || updateTaskMutation.isPending}
                    data-testid="pick-scan-submit"
                  >
                    Scannen bestätigen
                  </button>
                </form>
                <p data-testid="pick-scan-status">{scanStatus}</p>
              </div>

              <div className="table-wrap">
                <table className="products-table" data-testid="pick-task-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Bin</th>
                      <th>Produkt</th>
                      <th>Menge</th>
                      <th>Status</th>
                      <th>Aktion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(waveDetailQuery.data?.tasks ?? []).map((task) => (
                      <tr key={task.id}>
                        <td>{task.sequence_no}</td>
                        <td>{task.source_bin_code ?? "-"}</td>
                        <td>{task.product_number}</td>
                        <td>{task.quantity}</td>
                        <td>{task.status}</td>
                        <td>
                          <div className="actions-cell">
                            <button
                              className="btn"
                              onClick={() =>
                                void updateTaskMutation.mutateAsync({
                                  taskId: task.id,
                                  status: "picked",
                                })
                              }
                              disabled={updateTaskMutation.isPending}
                              data-testid={`pick-task-picked-${task.id}`}
                            >
                              picked
                            </button>
                            <button
                              className="btn"
                              onClick={() =>
                                void updateTaskMutation.mutateAsync({
                                  taskId: task.id,
                                  status: "skipped",
                                })
                              }
                              disabled={updateTaskMutation.isPending}
                              data-testid={`pick-task-skipped-${task.id}`}
                            >
                              skipped
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </article>
      </div>
    </section>
  );
}
