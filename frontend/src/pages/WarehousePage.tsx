import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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

export default function WarehousePage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const canWrite = Boolean(user?.roles.includes("admin") || user?.roles.includes("lagerleiter"));

  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);

  const [warehouseCode, setWarehouseCode] = useState("");
  const [warehouseName, setWarehouseName] = useState("");
  const [warehouseAddress, setWarehouseAddress] = useState("");

  const [zoneCode, setZoneCode] = useState("");
  const [zoneName, setZoneName] = useState("");
  const [zoneType, setZoneType] = useState<WarehouseZoneType>("storage");

  const [batchPrefix, setBatchPrefix] = useState("A");
  const [aisleTo, setAisleTo] = useState(2);
  const [shelfTo, setShelfTo] = useState(2);
  const [levelTo, setLevelTo] = useState(1);

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
      await queryClient.invalidateQueries({ queryKey: ["warehouses"] });
    },
  });

  const createZoneMutation = useMutation({
    mutationFn: ({ warehouseId, payload }: { warehouseId: number; payload: Parameters<typeof createZone>[1] }) =>
      createZone(warehouseId, payload),
    onSuccess: async () => {
      setZoneCode("");
      setZoneName("");
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
    <section className="panel">
      <header className="panel-header">
        <div>
          <h2>Lagerstruktur</h2>
          <p className="panel-subtitle">Lager, Zonen und Lagerplätze verwalten.</p>
        </div>
      </header>

      <div className="warehouse-grid">
        <article className="subpanel">
          <h3>Lager</h3>
          {canWrite ? (
            <form className="form-grid" onSubmit={(event) => void onCreateWarehouse(event)}>
              <input
                className="input"
                placeholder="Code"
                value={warehouseCode}
                onChange={(event) => setWarehouseCode(event.target.value)}
                required
              />
              <input
                className="input"
                placeholder="Name"
                value={warehouseName}
                onChange={(event) => setWarehouseName(event.target.value)}
                required
              />
              <input
                className="input"
                placeholder="Adresse"
                value={warehouseAddress}
                onChange={(event) => setWarehouseAddress(event.target.value)}
              />
              <button className="btn" type="submit" disabled={createWarehouseMutation.isPending}>
                Lager anlegen
              </button>
            </form>
          ) : null}

          <div className="list-stack">
            {(warehousesQuery.data ?? []).map((warehouse) => (
              <button
                key={warehouse.id}
                className={`list-item ${selectedWarehouseId === warehouse.id ? "active" : ""}`}
                onClick={() => {
                  setSelectedWarehouseId(warehouse.id);
                  setSelectedZoneId(null);
                }}
              >
                <strong>{warehouse.code}</strong>
                <span>{warehouse.name}</span>
              </button>
            ))}
          </div>
        </article>

        <article className="subpanel">
          <h3>Zonen {selectedWarehouse ? `(${selectedWarehouse.code})` : ""}</h3>
          {canWrite && selectedWarehouseId ? (
            <form className="form-grid" onSubmit={(event) => void onCreateZone(event)}>
              <input
                className="input"
                placeholder="Zone-Code"
                value={zoneCode}
                onChange={(event) => setZoneCode(event.target.value)}
                required
              />
              <input
                className="input"
                placeholder="Zone-Name"
                value={zoneName}
                onChange={(event) => setZoneName(event.target.value)}
                required
              />
              <select className="input" value={zoneType} onChange={(event) => setZoneType(event.target.value as WarehouseZoneType)}>
                {zoneTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <button className="btn" type="submit" disabled={createZoneMutation.isPending}>
                Zone anlegen
              </button>
            </form>
          ) : null}

          <div className="list-stack">
            {(zonesQuery.data ?? []).map((zone) => (
              <button
                key={zone.id}
                className={`list-item ${selectedZoneId === zone.id ? "active" : ""}`}
                onClick={() => setSelectedZoneId(zone.id)}
              >
                <strong>{zone.code}</strong>
                <span>{zone.name}</span>
              </button>
            ))}
          </div>
        </article>

        <article className="subpanel">
          <h3>Lagerplätze</h3>

          <BinBatchCreateDialog
            canWrite={canWrite}
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
            onSubmit={onCreateBatch}
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
        </article>
      </div>
    </section>
  );
}
