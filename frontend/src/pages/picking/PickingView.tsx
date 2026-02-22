import type { FormEvent } from "react";
import { Check, CheckCircle2, ChevronRight, Package, Play, Scan, Search, X } from "lucide-react";

import ExternalScannerListener from "../../components/scanner/ExternalScannerListener";
import type { PickTask, PickWave } from "../../types";

type PickingViewProps = {
  waves: PickWave[];
  selectedWaveId: number | null;
  selectedWave: PickWave | null;
  tasks: PickTask[];
  scanTask: PickTask | null;
  scanTaskId: number | null;
  scanInput: string;
  scanStep: "await_bin" | "await_product";
  scanStatus: string;
  wavesLoading: boolean;
  createWavePending: boolean;
  releaseWavePending: boolean;
  completeWavePending: boolean;
  updateTaskPending: boolean;
  onSelectWave: (waveId: number) => void;
  onCreateWave: () => void;
  onReleaseWave: (waveId: number) => void;
  onCompleteWave: (waveId: number) => void;
  onScanTaskIdChange: (taskId: number) => void;
  onScanInputChange: (value: string) => void;
  onScanSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onExternalScan: (value: string) => void;
  onTaskPicked: (taskId: number) => void;
  onTaskSkipped: (taskId: number) => void;
};

function getStatusBadge(status: string) {
  const baseClasses = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border";
  switch (status) {
    case "picked":
    case "completed":
      return <span className={`${baseClasses} bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800`}>{status}</span>;
    case "skipped":
      return <span className={`${baseClasses} bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800`}>{status}</span>;
    case "released":
    case "in_progress":
      return <span className={`${baseClasses} bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800`}>{status}</span>;
    case "draft":
    case "open":
    default:
      return <span className={`${baseClasses} bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700`}>{status}</span>;
  }
}

export function PickingView({
  waves,
  selectedWaveId,
  selectedWave,
  tasks,
  scanTask,
  scanTaskId,
  scanInput,
  scanStep,
  scanStatus,
  wavesLoading,
  createWavePending,
  releaseWavePending,
  completeWavePending,
  updateTaskPending,
  onSelectWave,
  onCreateWave,
  onReleaseWave,
  onCompleteWave,
  onScanTaskIdChange,
  onScanInputChange,
  onScanSubmit,
  onExternalScan,
  onTaskPicked,
  onTaskSkipped,
}: PickingViewProps) {
  return (
    <section className="page flex flex-col gap-8" data-testid="picking-page">
      <ExternalScannerListener enabled={Boolean(selectedWave)} onScan={onExternalScan} />

      <header className="panel-header flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div>
          <h1 className="page-title text-2xl font-bold text-zinc-900 dark:text-zinc-50">Kommissionierung</h1>
          <p className="section-subtitle mt-1 text-zinc-500 dark:text-zinc-400">Pick-Waves verwalten und Kommissionieraufgaben ausführen.</p>
        </div>
      </header>

      <div className="warehouse-grid grid grid-cols-1 gap-6 items-start">
        <aside className="subpanel bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col h-auto lg:h-[calc(100dvh-220px)] lg:sticky lg:top-6">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex justify-between items-center">
            <h3 className="section-title font-semibold text-zinc-900 dark:text-zinc-100">
              Pick-Waves
            </h3>
            <button
              onClick={onCreateWave}
              disabled={createWavePending}
              className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              title="Neue Pick-Wave erstellen"
              data-testid="pick-wave-create-btn"
            >
              {createWavePending ? "Erstelle..." : "Neue Wave"}
            </button>
          </div>

          <div className="overflow-y-auto p-3 space-y-2 flex-1" data-testid="pick-wave-list">
            {waves.length === 0 && !wavesLoading ? (
              <div className="text-center py-12 px-4 text-zinc-500 dark:text-zinc-400 text-sm">
                Keine Pick-Waves vorhanden.
                <br />
                Erstellen Sie eine neue Wave.
              </div>
            ) : null}

            {waves.map((wave) => (
              <button
                key={wave.id}
                onClick={() => onSelectWave(wave.id)}
                className={`w-full text-left p-3 rounded-lg border transition-all duration-200 group relative ${
                  selectedWaveId === wave.id
                    ? "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 shadow-sm"
                    : "bg-white dark:bg-zinc-900 border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700"
                }`}
                data-testid={`pick-wave-item-${wave.id}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={`font-medium text-sm ${selectedWaveId === wave.id ? "text-blue-700 dark:text-blue-300" : "text-zinc-900 dark:text-zinc-100"}`}>
                    {wave.wave_number}
                  </span>
                  {selectedWaveId === wave.id && <ChevronRight className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                </div>
                <div className="flex justify-between items-center mt-2">
                  {getStatusBadge(wave.status)}
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">#{wave.id}</span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main className="subpanel space-y-6">
          {!selectedWave ? (
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-12 text-center h-full flex flex-col items-center justify-center min-h-[400px]">
              <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                <Package className="w-8 h-8 text-zinc-400 dark:text-zinc-500" />
              </div>
              <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">Keine Pick-Wave ausgewählt</h3>
              <p className="text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
                Wählen Sie eine Pick-Wave aus der Liste links oder erstellen Sie eine neue, um Details zu sehen und Aufgaben zu bearbeiten.
              </p>
            </div>
          ) : (
            <>
              <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-3" data-testid="pick-wave-selected-status">
                      {selectedWave.wave_number}
                      {getStatusBadge(selectedWave.status)}
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">ID: {selectedWave.id} • Erstellt am {new Date().toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-3 w-full sm:w-auto">
                    <button
                      onClick={() => onReleaseWave(selectedWave.id)}
                      disabled={releaseWavePending || selectedWave.status !== "draft"}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-zinc-900"
                      data-testid="pick-wave-release-btn"
                    >
                      <Play className="w-4 h-4" /> Freigeben
                    </button>
                    <button
                      onClick={() => onCompleteWave(selectedWave.id)}
                      disabled={completeWavePending || !["released", "in_progress"].includes(selectedWave.status)}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
                      data-testid="pick-wave-complete-btn"
                    >
                      <Check className="w-4 h-4" /> Abschließen
                    </button>
                  </div>
                </div>

                {["released", "in_progress"].includes(selectedWave.status) && (
                  <div className="subpanel bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30 p-4 sm:p-6 mb-2">
                    <div className="mb-4 text-blue-900 dark:text-blue-200">
                      <h4 className="font-semibold text-base">Scanner-Erfassung</h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Aktive Aufgabe</label>
                          <select
                            className="block w-full rounded-lg border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm py-2.5"
                            value={scanTaskId ?? ""}
                            onChange={(event) => onScanTaskIdChange(Number(event.target.value))}
                            data-testid="pick-scan-task-select"
                          >
                            {tasks.map((task) => (
                              <option key={task.id} value={task.id}>
                                #{task.sequence_no} | {task.product_number} | {task.status}
                              </option>
                            ))}
                          </select>
                        </div>

                        <form onSubmit={onScanSubmit} className="flex gap-2">
                          <div className="relative flex-grow">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <Search className="h-4 w-4 text-zinc-400" />
                            </div>
                            <input
                              type="text"
                              className="block w-full pl-10 rounded-lg border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm py-2.5"
                              placeholder={scanStep === "await_bin" ? "Lagerplatz scannen..." : "Produkt scannen..."}
                              value={scanInput}
                              onChange={(event) => onScanInputChange(event.target.value)}
                              data-testid="pick-scan-input"
                              autoFocus
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={!scanTask || updateTaskPending}
                            className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            data-testid="pick-scan-submit"
                          >
                            OK
                          </button>
                        </form>
                      </div>

                      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 flex flex-col justify-center shadow-sm">
                        <div className="flex items-start gap-3">
                          <div
                            className={`mt-0.5 p-2 rounded-full ${
                              scanStatus.includes("bestätigt") || scanStatus.includes("picked")
                                ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                                : scanStatus.includes("Falsch") || scanStatus.includes("Fehler")
                                  ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                                  : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                            }`}
                          >
                            {scanStatus.includes("bestätigt") || scanStatus.includes("picked") ? (
                              <Check className="w-5 h-5" />
                            ) : scanStatus.includes("Falsch") || scanStatus.includes("Fehler") ? (
                              <X className="w-5 h-5" />
                            ) : (
                              <Scan className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <span className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Status</span>
                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100" data-testid="pick-scan-status">{scanStatus}</p>
                            {scanTask && (
                              <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
                                <p>Ziel: <strong className="text-zinc-900 dark:text-zinc-200">{scanTask.source_bin_code || "-"}</strong></p>
                                <p>Produkt: <strong className="text-zinc-900 dark:text-zinc-200">{scanTask.product_number}</strong></p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Aufgabenliste</h3>
                </div>
                <div className="table-wrap overflow-x-auto">
                  <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800" data-testid="pick-task-table">
                    <thead className="bg-zinc-50 dark:bg-zinc-900/50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">#</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Bin</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Produkt</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Menge</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Status</th>
                        <th scope="col" className="relative px-6 py-3"><span className="sr-only">Aktionen</span></th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-zinc-900 divide-y divide-zinc-200 dark:divide-zinc-800">
                      {tasks.map((task) => (
                        <tr key={task.id} data-testid={`pick-task-row-${task.id}`} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500 dark:text-zinc-400">{task.sequence_no}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-zinc-900 dark:text-zinc-100">{task.source_bin_code ?? "-"}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-900 dark:text-zinc-100">
                            <span className="truncate max-w-[200px] block" title={task.product_number}>{task.product_number}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500 dark:text-zinc-400">{task.quantity}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getStatusBadge(task.status)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end gap-2">
                              {task.status !== "picked" && task.status !== "skipped" && (
                                <>
                                  <button
                                    onClick={() => onTaskPicked(task.id)}
                                    disabled={updateTaskPending}
                                    className="p-1 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 transition-colors disabled:opacity-50"
                                    title="Als gepickt markieren"
                                    data-testid={`pick-task-picked-${task.id}`}
                                  >
                                    <CheckCircle2 className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => onTaskSkipped(task.id)}
                                    disabled={updateTaskPending}
                                    className="p-1 rounded hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-600 dark:text-amber-400 transition-colors disabled:opacity-50"
                                    title="Überspringen"
                                    data-testid={`pick-task-skipped-${task.id}`}
                                  >
                                    <X className="w-5 h-5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {tasks.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-sm text-zinc-500 dark:text-zinc-400 italic">Keine Aufgaben in dieser Wave.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </section>
  );
}
