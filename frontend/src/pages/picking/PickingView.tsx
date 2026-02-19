import type { FormEvent } from "react";
import { Check, CheckCircle2, List, Package, Play, RefreshCw, Scan, Search, X } from "lucide-react";

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

function getStatusColor(status: string): string {
  switch (status) {
    case "picked":
    case "completed":
      return "text-[var(--success-ink)] bg-[var(--success-bg)] border-[color:color-mix(in_srgb,var(--success-ink)_30%,var(--line)_70%)]";
    case "skipped":
      return "text-[var(--warning-ink)] bg-[var(--warning-bg)] border-[color:color-mix(in_srgb,var(--warning-ink)_36%,var(--line)_64%)]";
    case "released":
    case "in_progress":
      return "text-[color:color-mix(in_srgb,#2563eb_78%,var(--ink)_22%)] bg-[color-mix(in_srgb,#2563eb_16%,var(--panel)_84%)] border-[color:color-mix(in_srgb,#2563eb_42%,var(--line)_58%)]";
    case "draft":
    case "open":
      return "text-[var(--muted)] bg-[var(--panel-soft)] border-[var(--line)]";
    default:
      return "text-[var(--muted)] bg-[var(--panel-soft)] border-[var(--line)]";
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
    <section className="page flex flex-col gap-6" data-testid="picking-page">
      <ExternalScannerListener enabled={Boolean(selectedWave)} onScan={onExternalScan} />

      <header className="panel-header flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[var(--line)] pb-6">
        <div>
          <h1 className="page-title">Kommissionierung</h1>
          <p className="section-subtitle mt-1">Pick-Waves verwalten und Kommissionieraufgaben ausführen.</p>
        </div>
      </header>

      <div className="warehouse-grid grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <aside className="subpanel lg:col-span-4 xl:col-span-3 bg-[var(--panel)] rounded-[var(--radius-lg)] shadow-sm border border-[var(--line)] overflow-hidden flex flex-col h-full max-h-[calc(100vh-200px)]">
          <div className="p-4 border-b border-[var(--line)] bg-[var(--panel-soft)] flex justify-between items-center sticky top-0 z-10">
            <h3 className="section-title flex items-center gap-2">
              <List className="w-4 h-4" /> Pick-Waves
            </h3>
            <button
              onClick={onCreateWave}
              disabled={createWavePending}
              className="inline-flex items-center justify-center p-2 rounded-[var(--radius-sm)] bg-blue-600 hover:bg-blue-700 text-white transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Neue Pick-Wave erstellen"
              data-testid="pick-wave-create-btn"
            >
              {createWavePending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
            </button>
          </div>

          <div className="overflow-y-auto p-2 space-y-2 flex-1" data-testid="pick-wave-list">
            {waves.length === 0 && !wavesLoading ? (
              <div className="text-center py-8 px-4 text-[var(--muted)] text-sm">
                Keine Pick-Waves vorhanden.
                <br />
                Erstellen Sie eine neue Wave.
              </div>
            ) : null}

            {waves.map((wave) => (
              <button
                key={wave.id}
                onClick={() => onSelectWave(wave.id)}
                className={`w-full text-left p-3 rounded-[var(--radius-sm)] border transition-all duration-200 group relative ${
                  selectedWaveId === wave.id
                    ? "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 shadow-sm"
                    : "bg-[var(--panel)] border-transparent hover:bg-[var(--panel-soft)] hover:border-[var(--line)]"
                }`}
                data-testid={`pick-wave-item-${wave.id}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={`font-medium text-sm ${selectedWaveId === wave.id ? "text-blue-700 dark:text-blue-300" : "text-[var(--ink)]"}`}>
                    {wave.wave_number}
                  </span>
                  {selectedWaveId === wave.id && <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(wave.status)}`}>
                    {wave.status}
                  </span>
                  <span className="text-xs text-[var(--muted)] opacity-70">#{wave.id}</span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main className="subpanel lg:col-span-8 xl:col-span-9 space-y-6">
          {!selectedWave ? (
            <div className="bg-[var(--panel)] rounded-[var(--radius-lg)] shadow-sm border border-[var(--line)] p-12 text-center">
              <Package className="w-12 h-12 text-[var(--muted)] mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium text-[var(--ink)] mb-2">Keine Pick-Wave ausgewählt</h3>
              <p className="text-[var(--muted)] max-w-md mx-auto">
                Wählen Sie eine Pick-Wave aus der Liste links oder erstellen Sie eine neue, um Details zu sehen und Aufgaben zu bearbeiten.
              </p>
            </div>
          ) : (
            <>
              <div className="bg-[var(--panel)] rounded-[var(--radius-lg)] shadow-sm border border-[var(--line)] p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-[var(--ink)] flex items-center gap-3">
                      {selectedWave.wave_number}
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(selectedWave.status)}`}>
                        {selectedWave.status}
                      </span>
                    </h2>
                    <p className="text-sm text-[var(--muted)] mt-1">ID: {selectedWave.id} • Erstellt am {new Date().toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-3 w-full sm:w-auto">
                    <button
                      onClick={() => onReleaseWave(selectedWave.id)}
                      disabled={releaseWavePending || selectedWave.status !== "draft"}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-[var(--radius-sm)] font-medium text-sm transition-colors border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--panel-soft)] focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      data-testid="pick-wave-release-btn"
                    >
                      <Play className="w-4 h-4" /> Freigeben
                    </button>
                    <button
                      onClick={() => onCompleteWave(selectedWave.id)}
                      disabled={completeWavePending || !["released", "in_progress"].includes(selectedWave.status)}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-[var(--radius-sm)] font-medium text-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
                      data-testid="pick-wave-complete-btn"
                    >
                      <Check className="w-4 h-4" /> Abschließen
                    </button>
                  </div>
                </div>

                {["released", "in_progress"].includes(selectedWave.status) && (
                  <div className="subpanel bg-blue-50/50 dark:bg-blue-900/10 rounded-[var(--radius-lg)] border border-blue-100 dark:border-blue-900/30 p-4 sm:p-6 mb-2">
                    <div className="flex items-center gap-2 mb-4 text-blue-800 dark:text-blue-300">
                      <Scan className="w-5 h-5" />
                      <h4 className="font-semibold">Scanner-Erfassung</h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-1.5">Aktive Aufgabe</label>
                          <select
                            className="block w-full rounded-[var(--radius-sm)] border-[var(--line)] bg-[var(--panel)] text-[var(--ink)] shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm py-2.5"
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
                              <Search className="h-4 w-4 text-[var(--muted)]" />
                            </div>
                            <input
                              type="text"
                              className="block w-full pl-10 rounded-[var(--radius-sm)] border-[var(--line)] bg-[var(--panel)] text-[var(--ink)] shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm py-2.5"
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
                            className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-[var(--radius-sm)] shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            data-testid="pick-scan-submit"
                          >
                            OK
                          </button>
                        </form>
                      </div>

                      <div className="bg-[var(--panel)] rounded-[var(--radius-sm)] border border-[var(--line)] p-4 flex flex-col justify-center">
                        <div className="flex items-start gap-3">
                          <div
                            className={`mt-0.5 p-1.5 rounded-full ${
                              scanStatus.includes("bestätigt") || scanStatus.includes("picked")
                                ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                                : scanStatus.includes("Falsch") || scanStatus.includes("Fehler")
                                  ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                                  : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                            }`}
                          >
                            {scanStatus.includes("bestätigt") || scanStatus.includes("picked") ? (
                              <Check className="w-4 h-4" />
                            ) : scanStatus.includes("Falsch") || scanStatus.includes("Fehler") ? (
                              <X className="w-4 h-4" />
                            ) : (
                              <Scan className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <span className="block text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-1">Status</span>
                            <p className="text-sm font-medium text-[var(--ink)]" data-testid="pick-scan-status">{scanStatus}</p>
                            {scanTask && (
                              <div className="mt-2 text-xs text-[var(--muted)] space-y-1">
                                <p>Ziel: <strong className="text-[var(--ink)]">{scanTask.source_bin_code || "-"}</strong></p>
                                <p>Produkt: <strong className="text-[var(--ink)]">{scanTask.product_number}</strong></p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-[var(--panel)] rounded-[var(--radius-lg)] shadow-sm border border-[var(--line)] overflow-hidden">
                <div className="p-4 border-b border-[var(--line)] bg-[var(--panel-soft)]">
                  <h3 className="font-semibold text-[var(--ink)]">Aufgabenliste</h3>
                </div>
                <div className="table-wrap overflow-x-auto">
                  <table className="min-w-full divide-y divide-[var(--line)]" data-testid="pick-task-table">
                    <thead className="bg-[var(--panel-soft)]">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider">#</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Bin</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Produkt</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Menge</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Status</th>
                        <th scope="col" className="relative px-6 py-3"><span className="sr-only">Aktionen</span></th>
                      </tr>
                    </thead>
                    <tbody className="bg-[var(--panel)] divide-y divide-[var(--line)]">
                      {tasks.map((task) => (
                        <tr key={task.id} className="hover:bg-[var(--panel-soft)] transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--muted)]">{task.sequence_no}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[var(--ink)]">{task.source_bin_code ?? "-"}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--ink)]">
                            <span className="truncate max-w-[200px] block" title={task.product_number}>{task.product_number}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--muted)]">{task.quantity}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(task.status)}`}>{task.status}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end gap-2">
                              {task.status !== "picked" && task.status !== "skipped" && (
                                <>
                                  <button
                                    onClick={() => onTaskPicked(task.id)}
                                    disabled={updateTaskPending}
                                    className="text-green-600 hover:text-green-900 dark:hover:text-green-400 disabled:opacity-50 transition-colors"
                                    title="Als gepickt markieren"
                                    data-testid={`pick-task-picked-${task.id}`}
                                  >
                                    <CheckCircle2 className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => onTaskSkipped(task.id)}
                                    disabled={updateTaskPending}
                                    className="text-orange-600 hover:text-orange-900 dark:hover:text-orange-400 disabled:opacity-50 transition-colors"
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
                          <td colSpan={6} className="px-6 py-8 text-center text-sm text-[var(--muted)] italic">Keine Aufgaben in dieser Wave.</td>
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
