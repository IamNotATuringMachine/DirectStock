import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Map as MapIcon, Plus, Search, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import BinBatchCreateDialog from "../components/warehouse/BinBatchCreateDialog";
import BinLocationGrid from "../components/warehouse/BinLocationGrid";
import QRPrintDialog from "../components/warehouse/QRPrintDialog";
import {
  createBinBatch,
  createWarehouse,
  createZone,
  downloadBinLabelsPdf,
  downloadBinQrCode,
  fetchBins,
  fetchWarehouses,
  fetchZones,
} from "../services/warehousesApi";
import { useAuthStore } from "../stores/authStore";
import type { BinLocation, WarehouseZoneType } from "../types";

const zoneTypes: WarehouseZoneType[] = [
  "inbound",
  "storage",
  "picking",
  "outbound",
  "returns",
  "blocked",
  "quality",
];

const zoneTypeLabels: Record<WarehouseZoneType, string> = {
  inbound: "Wareneingang",
  storage: "Lagerung",
  picking: "Kommissionierung",
  outbound: "Warenausgang",
  returns: "Retouren",
  blocked: "Gesperrt",
  quality: "Qualitaetspruefung",
};

export default function WarehousePage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const canWrite = Boolean(user?.roles.includes("admin") || user?.roles.includes("lagerleiter"));

  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);

  const [warehouseCode, setWarehouseCode] = useState("");
  const [warehouseName, setWarehouseName] = useState("");
  const [warehouseAddress, setWarehouseAddress] = useState("");
  const [isCreatingWarehouse, setIsCreatingWarehouse] = useState(false);

  const [zoneCode, setZoneCode] = useState("");
  const [zoneName, setZoneName] = useState("");
  const [zoneType, setZoneType] = useState<WarehouseZoneType>("storage");
  const [isCreatingZone, setIsCreatingZone] = useState(false);

  const [batchPrefix, setBatchPrefix] = useState("A");
  const [aisleTo, setAisleTo] = useState(2);
  const [shelfTo, setShelfTo] = useState(2);
  const [levelTo, setLevelTo] = useState(1);
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);

  const [downloadingBinId, setDownloadingBinId] = useState<number | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const warehousesQuery = useQuery({
    queryKey: ["warehouses"],
    queryFn: fetchWarehouses,
  });

  const zonesQuery = useQuery({
    queryKey: ["zones", selectedWarehouseId],
    queryFn: () => fetchZones(selectedWarehouseId as number),
    enabled: selectedWarehouseId !== null,
  });

  const binsQuery = useQuery({
    queryKey: ["bins", selectedZoneId],
    queryFn: () => fetchBins(selectedZoneId as number),
    enabled: selectedZoneId !== null,
  });

  const createWarehouseMutation = useMutation({
    mutationFn: createWarehouse,
    onSuccess: async () => {
      setWarehouseCode("");
      setWarehouseName("");
      setWarehouseAddress("");
      setIsCreatingWarehouse(false);
      await queryClient.invalidateQueries({ queryKey: ["warehouses"] });
    },
  });

  const createZoneMutation = useMutation({
    mutationFn: ({ warehouseId, payload }: { warehouseId: number; payload: Parameters<typeof createZone>[1] }) =>
      createZone(warehouseId, payload),
    onSuccess: async () => {
      setZoneCode("");
      setZoneName("");
      setIsCreatingZone(false);
      await queryClient.invalidateQueries({ queryKey: ["zones", selectedWarehouseId] });
    },
  });

  const batchMutation = useMutation({
    mutationFn: ({ zoneId }: { zoneId: number }) =>
      createBinBatch(zoneId, {
        prefix: batchPrefix,
        aisle_from: 1,
        aisle_to: aisleTo,
        shelf_from: 1,
        shelf_to: shelfTo,
        level_from: 1,
        level_to: levelTo,
        bin_type: "storage",
      }),
    onSuccess: async () => {
      setIsCreatingBatch(false);
      await queryClient.invalidateQueries({ queryKey: ["bins", selectedZoneId] });
    },
  });

  useEffect(() => {
    if (!selectedWarehouseId && warehousesQuery.data && warehousesQuery.data.length > 0) {
      setSelectedWarehouseId(warehousesQuery.data[0].id);
    }
  }, [selectedWarehouseId, warehousesQuery.data]);

  useEffect(() => {
    if (!selectedZoneId && zonesQuery.data && zonesQuery.data.length > 0) {
      setSelectedZoneId(zonesQuery.data[0].id);
    }
  }, [selectedZoneId, zonesQuery.data]);

  const selectedWarehouse = useMemo(
    () => warehousesQuery.data?.find((item) => item.id === selectedWarehouseId) ?? null,
    [warehousesQuery.data, selectedWarehouseId]
  );

  const onCreateWarehouse = async (event: FormEvent) => {
    event.preventDefault();
    await createWarehouseMutation.mutateAsync({
      code: warehouseCode,
      name: warehouseName,
      address: warehouseAddress || undefined,
      is_active: true,
    });
  };

  const onCreateZone = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedWarehouseId) {
      return;
    }
    await createZoneMutation.mutateAsync({
      warehouseId: selectedWarehouseId,
      payload: {
        code: zoneCode,
        name: zoneName,
        zone_type: zoneType,
        is_active: true,
      },
    });
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const onDownloadBinQr = async (bin: BinLocation) => {
    setDownloadingBinId(bin.id);
    try {
      const blob = await downloadBinQrCode(bin.id);
      triggerDownload(blob, `bin-${bin.code}.png`);
    } finally {
      setDownloadingBinId(null);
    }
  };

  const onDownloadZonePdf = async () => {
    const bins = binsQuery.data ?? [];
    if (!bins.length) {
      return;
    }
    setDownloadingPdf(true);
    try {
      const blob = await downloadBinLabelsPdf(bins.map((bin) => bin.id));
      triggerDownload(blob, `bin-labels-zone-${selectedZoneId ?? "n-a"}.pdf`);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const onCreateBatch = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedZoneId) {
      return;
    }
    await batchMutation.mutateAsync({ zoneId: selectedZoneId });
  };

  return (
    <div className="page space-y-6" data-testid="warehouse-page">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="page-title">Lagerstruktur</h2>
          <p className="section-subtitle">Verwaltung von Lagern, Zonen und Lagerplätzen.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Column 1: Warehouses */}
        <section className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm overflow-hidden flex flex-col h-[calc(100vh-12rem)] min-h-[500px]">
          <div className="p-4 border-b border-[var(--line)] bg-[var(--panel-soft)] flex items-center justify-between sticky top-0 z-10">
            <h3 className="section-title">Lager</h3>
            {canWrite && (
              <button
                onClick={() => setIsCreatingWarehouse(!isCreatingWarehouse)}
                className="text-sm p-1.5 text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--panel-strong)] rounded-md transition-colors"
                title="Neues Lager"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-[var(--panel)]">
            {isCreatingWarehouse && (
              <form onSubmit={onCreateWarehouse} className="p-3 bg-[var(--bg)] rounded-lg border border-[var(--line)] space-y-3 mb-4 animate-in fade-in slide-in-from-top-2">
                <div className="space-y-2">
                  <input
                    className="input w-full px-3 py-2 text-sm border rounded-md bg-[var(--panel)] text-[var(--ink)] border-[var(--line)]"
                    placeholder="Code (z.B. WH-MAIN)"
                    value={warehouseCode}
                    onChange={(e) => setWarehouseCode(e.target.value)}
                    required
                    autoFocus
                  />
                  <input
                    className="input w-full px-3 py-2 text-sm border rounded-md bg-[var(--panel)] text-[var(--ink)] border-[var(--line)]"
                    placeholder="Name"
                    value={warehouseName}
                    onChange={(e) => setWarehouseName(e.target.value)}
                    required
                  />
                  <input
                    className="input w-full px-3 py-2 text-sm border rounded-md bg-[var(--panel)] text-[var(--ink)] border-[var(--line)]"
                    placeholder="Adresse"
                    value={warehouseAddress}
                    onChange={(e) => setWarehouseAddress(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreatingWarehouse(false)}
                    className="px-3 py-1.5 text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)]"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    disabled={createWarehouseMutation.isPending}
                    className="px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Anlegen
                  </button>
                </div>
              </form>
            )}

            {(warehousesQuery.data ?? []).map((warehouse) => (
              <button
                key={warehouse.id}
                onClick={() => {
                  setSelectedWarehouseId(warehouse.id);
                  setSelectedZoneId(null);
                }}
                className={`w-full text-left p-3 rounded-lg border transition-all ${selectedWarehouseId === warehouse.id
                    ? "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 ring-1 ring-blue-200 dark:ring-blue-800"
                    : "bg-[var(--panel)] border-[var(--line)] hover:border-[var(--line-strong)] hover:bg-[var(--panel-soft)]"
                  }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-semibold text-sm ${selectedWarehouseId === warehouse.id ? "text-blue-700 dark:text-blue-300" : "text-[var(--ink)]"}`}>{warehouse.code}</span>
                  {selectedWarehouseId === warehouse.id && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                </div>
                <div className={`text-sm truncate ${selectedWarehouseId === warehouse.id ? "text-blue-600/80 dark:text-blue-300/80" : "text-[var(--muted)]"}`}>{warehouse.name}</div>
              </button>
            ))}

            {warehousesQuery.data?.length === 0 && (
              <div className="text-center py-8 text-[var(--muted)] text-sm">Keine Lager vorhanden</div>
            )}
          </div>
        </section>

        {/* Column 2: Zones */}
        <section className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm overflow-hidden flex flex-col h-[calc(100vh-12rem)] min-h-[500px]">
          <div className="p-4 border-b border-[var(--line)] bg-[var(--panel-soft)] flex items-center justify-between sticky top-0 z-10">
            <h3 className="section-title">Zonen</h3>
            {canWrite && selectedWarehouseId && (
              <button
                onClick={() => setIsCreatingZone(!isCreatingZone)}
                className="text-sm p-1.5 text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--panel-strong)] rounded-md transition-colors"
                title="Neue Zone"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-[var(--panel)]">
            {!selectedWarehouseId ? (
              <div className="h-full flex flex-col items-center justify-center text-[var(--muted)] p-4 text-center">
                <Building2 className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm">Wähle ein Lager aus, um Zonen zu sehen.</p>
              </div>
            ) : (
              <>
                {isCreatingZone && (
                  <form onSubmit={onCreateZone} className="p-3 bg-[var(--bg)] rounded-lg border border-[var(--line)] space-y-3 mb-4 animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-2">
                      <input
                        className="input w-full px-3 py-2 text-sm border rounded-md bg-[var(--panel)] text-[var(--ink)] border-[var(--line)]"
                        placeholder="Zone-Code (z.B. Z-01)"
                        value={zoneCode}
                        onChange={(e) => setZoneCode(e.target.value)}
                        required
                        autoFocus
                      />
                      <input
                        className="input w-full px-3 py-2 text-sm border rounded-md bg-[var(--panel)] text-[var(--ink)] border-[var(--line)]"
                        placeholder="Name"
                        value={zoneName}
                        onChange={(e) => setZoneName(e.target.value)}
                        required
                      />
                      <select
                        className="input w-full px-3 py-2 text-sm border rounded-md bg-[var(--panel)] text-[var(--ink)] border-[var(--line)]"
                        value={zoneType}
                        onChange={(e) => setZoneType(e.target.value as WarehouseZoneType)}
                      >
                        {zoneTypes.map((type) => (
                          <option key={type} value={type}>
                            {zoneTypeLabels[type]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsCreatingZone(false)}
                        className="px-3 py-1.5 text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)]"
                      >
                        Abbrechen
                      </button>
                      <button
                        type="submit"
                        disabled={createZoneMutation.isPending}
                        className="px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Anlegen
                      </button>
                    </div>
                  </form>
                )}

                {(zonesQuery.data ?? []).map((zone) => (
                  <button
                    key={zone.id}
                    onClick={() => setSelectedZoneId(zone.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${selectedZoneId === zone.id
                        ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800 ring-1 ring-emerald-200 dark:ring-emerald-800"
                        : "bg-[var(--panel)] border-[var(--line)] hover:border-[var(--line-strong)] hover:bg-[var(--panel-soft)]"
                      }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-semibold text-sm ${selectedZoneId === zone.id ? "text-emerald-700 dark:text-emerald-300" : "text-[var(--ink)]"}`}>{zone.code}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wide ${selectedZoneId === zone.id
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : "bg-[var(--bg)] text-[var(--muted)] border border-[var(--line)]"
                        }`}>
                        {zoneTypeLabels[zone.zone_type]}
                      </span>
                    </div>
                    <div className={`text-sm truncate ${selectedZoneId === zone.id ? "text-emerald-600/80 dark:text-emerald-300/80" : "text-[var(--muted)]"}`}>{zone.name}</div>
                  </button>
                ))}

                {zonesQuery.data?.length === 0 && !isCreatingZone && (
                  <div className="text-center py-8 text-[var(--muted)] text-sm">Keine Zonen vorhanden</div>
                )}
              </>
            )}
          </div>
        </section>

        {/* Column 3: Bins */}
        <section className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm overflow-hidden flex flex-col h-[calc(100vh-12rem)] min-h-[500px]">
          <div className="p-4 border-b border-[var(--line)] bg-[var(--panel-soft)] flex items-center justify-between sticky top-0 z-10">
            <h3 className="section-title">Lagerplätze</h3>
            <div className="flex items-center gap-1">
              {canWrite && selectedZoneId && (
                <button
                  onClick={() => setIsCreatingBatch(!isCreatingBatch)}
                  className={`text-sm p-1.5 rounded-md transition-colors ${isCreatingBatch ? "bg-purple-100 text-purple-700" : "text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--panel-strong)]"
                    }`}
                  title="Batch erstellen"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-4 bg-[var(--panel)]">
            {!selectedZoneId ? (
              <div className="h-full flex flex-col items-center justify-center text-[var(--muted)] p-4 text-center">
                <MapIcon className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm">Wähle eine Zone aus, um Lagerplätze zu sehen.</p>
              </div>
            ) : (
              <>
                <BinBatchCreateDialog
                  canWrite={canWrite && isCreatingBatch}
                  selectedZoneId={selectedZoneId}
                  batchPrefix={batchPrefix}
                  aisleTo={aisleTo}
                  shelfTo={shelfTo}
                  levelTo={levelTo}
                  isPending={batchMutation.isPending}
                  onBatchPrefixChange={setBatchPrefix}
                  onAisleToChange={setAisleTo}
                  onShelfToChange={setShelfTo}
                  onLevelToChange={setLevelTo}
                  onSubmit={(e) => {
                    onCreateBatch(e);
                    setIsCreatingBatch(false);
                  }}
                />

                <QRPrintDialog
                  bins={binsQuery.data ?? []}
                  downloadingPdf={downloadingPdf}
                  onDownloadZonePdf={onDownloadZonePdf}
                />

                <BinLocationGrid
                  bins={binsQuery.data ?? []}
                  downloadingBinId={downloadingBinId}
                  onDownloadQr={onDownloadBinQr}
                />
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
