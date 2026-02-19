import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  completePickWave,
  createPickWave,
  fetchPickWave,
  fetchPickWaves,
  releasePickWave,
  updatePickTask,
} from "../services/pickingApi";
import { parseScanValue } from "../utils/scannerUtils";
import { PickingView } from "./picking/PickingView";

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

  const onScanSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = scanInput.trim();
    if (!value) {
      return;
    }
    await processScan(value);
  };

  return (
    <PickingView
      waves={wavesQuery.data ?? []}
      selectedWaveId={selectedWaveId}
      selectedWave={selectedWave}
      tasks={tasks}
      scanTask={scanTask}
      scanTaskId={scanTaskId}
      scanInput={scanInput}
      scanStep={scanStep}
      scanStatus={scanStatus}
      wavesLoading={wavesQuery.isLoading}
      createWavePending={createWaveMutation.isPending}
      releaseWavePending={releaseWaveMutation.isPending}
      completeWavePending={completeWaveMutation.isPending}
      updateTaskPending={updateTaskMutation.isPending}
      onSelectWave={setSelectedWaveId}
      onCreateWave={() => {
        void createWaveMutation.mutateAsync();
      }}
      onReleaseWave={(waveId) => {
        void releaseWaveMutation.mutateAsync(waveId);
      }}
      onCompleteWave={(waveId) => {
        void completeWaveMutation.mutateAsync(waveId);
      }}
      onScanTaskIdChange={setScanTaskId}
      onScanInputChange={setScanInput}
      onScanSubmit={(event) => void onScanSubmit(event)}
      onExternalScan={(value) => void processScan(value)}
      onTaskPicked={(taskId) => {
        void updateTaskMutation.mutateAsync({ taskId, status: "picked" });
      }}
      onTaskSkipped={(taskId) => {
        void updateTaskMutation.mutateAsync({ taskId, status: "skipped" });
      }}
    />
  );
}
