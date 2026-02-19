import { type FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createBinBatch,
  createWarehouse,
  createZone,
  deleteBin,
  deleteZone,
  downloadBinLabelsPdf,
  downloadBinQrCode,
  fetchBins,
  fetchWarehouses,
  fetchZones,
} from "../services/warehousesApi";
import { useAuthStore } from "../stores/authStore";
import type { BinLocation, WarehouseZoneType } from "../types";
import { WarehouseView } from "./warehouse/WarehouseView";

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

  const deleteZoneMutation = useMutation({
    mutationFn: deleteZone,
    onSuccess: async () => {
      setSelectedZoneId(null);
      await queryClient.invalidateQueries({ queryKey: ["zones", selectedWarehouseId] });
      await queryClient.invalidateQueries({ queryKey: ["bins"] });
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

  const deleteBinMutation = useMutation({
    mutationFn: deleteBin,
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

  const onDeleteZone = async () => {
    if (!selectedZoneId) {
      return;
    }
    const selectedZone = zonesQuery.data?.find((zone) => zone.id === selectedZoneId);
    const zoneLabel = selectedZone ? `${selectedZone.code} (${selectedZone.name})` : `#${selectedZoneId}`;
    if (
      !window.confirm(
        `Zone "${zoneLabel}" wirklich löschen? Alle darin enthaltenen Lagerplätze werden ebenfalls entfernt.`
      )
    ) {
      return;
    }
    await deleteZoneMutation.mutateAsync(selectedZoneId);
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

  const onDeleteBin = async (bin: BinLocation) => {
    const occupancyHint = bin.is_occupied ? " Der Lagerplatz enthält aktuell Bestand." : "";
    if (!window.confirm(`Lagerplatz "${bin.code}" wirklich löschen?${occupancyHint}`)) {
      return;
    }
    await deleteBinMutation.mutateAsync(bin.id);
  };

  return (
    <WarehouseView
      warehousesPanelProps={{
        canWrite,
        warehouses: warehousesQuery.data ?? [],
        selectedWarehouseId,
        onSelectWarehouse: (warehouseId) => {
          setSelectedWarehouseId(warehouseId);
          setSelectedZoneId(null);
        },
        isCreatingWarehouse,
        onToggleCreateWarehouse: () => setIsCreatingWarehouse((value) => !value),
        onCancelCreateWarehouse: () => setIsCreatingWarehouse(false),
        warehouseCode,
        onWarehouseCodeChange: setWarehouseCode,
        warehouseName,
        onWarehouseNameChange: setWarehouseName,
        warehouseAddress,
        onWarehouseAddressChange: setWarehouseAddress,
        onCreateWarehouse: (event) => void onCreateWarehouse(event),
        createWarehousePending: createWarehouseMutation.isPending,
      }}
      zonesPanelProps={{
        canWrite,
        selectedWarehouseId,
        zones: zonesQuery.data ?? [],
        selectedZoneId,
        onSelectZone: setSelectedZoneId,
        isCreatingZone,
        onToggleCreateZone: () => setIsCreatingZone((value) => !value),
        onCancelCreateZone: () => setIsCreatingZone(false),
        zoneCode,
        onZoneCodeChange: setZoneCode,
        zoneName,
        onZoneNameChange: setZoneName,
        zoneType,
        onZoneTypeChange: setZoneType,
        onCreateZone: (event) => void onCreateZone(event),
        createZonePending: createZoneMutation.isPending,
        onDeleteSelectedZone: () => {
          void onDeleteZone();
        },
        deleteZonePending: deleteZoneMutation.isPending,
      }}
      binsPanelProps={{
        canWrite,
        selectedZoneId,
        isCreatingBatch,
        onToggleCreateBatch: () => setIsCreatingBatch((value) => !value),
        onCloseCreateBatch: () => setIsCreatingBatch(false),
        batchPrefix,
        aisleTo,
        shelfTo,
        levelTo,
        batchPending: batchMutation.isPending,
        onBatchPrefixChange: setBatchPrefix,
        onAisleToChange: setAisleTo,
        onShelfToChange: setShelfTo,
        onLevelToChange: setLevelTo,
        onCreateBatch: (event) => {
          void onCreateBatch(event);
        },
        bins: binsQuery.data ?? [],
        downloadingPdf,
        onDownloadZonePdf: () => {
          void onDownloadZonePdf();
        },
        downloadingBinId,
        deletingBinId: deleteBinMutation.isPending ? deleteBinMutation.variables ?? null : null,
        onDownloadBinQr: (bin) => {
          void onDownloadBinQr(bin);
        },
        onDeleteBin: (bin) => {
          void onDeleteBin(bin);
        },
      }}
    />
  );
}
