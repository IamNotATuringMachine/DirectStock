import { type FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  completeInventoryCountSession,
  createInventoryCountSession,
  fetchInventoryCountItems,
  fetchInventoryCountSessions,
  fetchInventoryCountSummary,
  generateInventoryCountItems,
  updateInventoryCountItem,
} from "../services/inventoryCountsApi";
import { fetchWarehouses } from "../services/warehousesApi";
import type { InventoryCountItem } from "../types";
import { InventoryCountView } from "./inventory-count/InventoryCountView";

export default function InventoryCountPage() {
  const queryClient = useQueryClient();

  const [sessionType, setSessionType] = useState<"snapshot" | "cycle">("snapshot");
  const [warehouseId, setWarehouseId] = useState("");
  const [toleranceQuantity, setToleranceQuantity] = useState("0");
  const [notes, setNotes] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);

  const [scanBin, setScanBin] = useState("");
  const [scanProduct, setScanProduct] = useState("");
  const [quickQuantity, setQuickQuantity] = useState("0");

  const [rowCounts, setRowCounts] = useState<Record<number, string>>({});

  const sessionsQuery = useQuery({
    queryKey: ["inventory-count-sessions"],
    queryFn: () => fetchInventoryCountSessions(),
  });

  const warehousesQuery = useQuery({
    queryKey: ["warehouses", "inventory-counts"],
    queryFn: fetchWarehouses,
  });

  const itemsQuery = useQuery({
    queryKey: ["inventory-count-items", selectedSessionId],
    queryFn: () => fetchInventoryCountItems(selectedSessionId as number),
    enabled: selectedSessionId !== null,
  });

  const summaryQuery = useQuery({
    queryKey: ["inventory-count-summary", selectedSessionId],
    queryFn: () => fetchInventoryCountSummary(selectedSessionId as number),
    enabled: selectedSessionId !== null,
    refetchInterval: 15_000,
  });

  const selectedSession = useMemo(
    () => sessionsQuery.data?.find((session) => session.id === selectedSessionId) ?? null,
    [sessionsQuery.data, selectedSessionId]
  );

  const filteredItems = useMemo(() => {
    const items = itemsQuery.data ?? [];
    const binTerm = scanBin.trim().toLowerCase();
    const productTerm = scanProduct.trim().toLowerCase();
    return items.filter((item) => {
      const binMatch = !binTerm || item.bin_code.toLowerCase().includes(binTerm);
      const productMatch =
        !productTerm ||
        item.product_number.toLowerCase().includes(productTerm) ||
        item.product_name.toLowerCase().includes(productTerm);
      return binMatch && productMatch;
    });
  }, [itemsQuery.data, scanBin, scanProduct]);

  const focusedQuickItem: InventoryCountItem | null = filteredItems[0] ?? null;

  const createSessionMutation = useMutation({
    mutationFn: createInventoryCountSession,
    onSuccess: async (session) => {
      setNotes("");
      setToleranceQuantity("0");
      setWarehouseId("");
      await queryClient.invalidateQueries({ queryKey: ["inventory-count-sessions"] });
      setSelectedSessionId(session.id);
    },
  });

  const generateItemsMutation = useMutation({
    mutationFn: ({ sessionId, refresh }: { sessionId: number; refresh: boolean }) =>
      generateInventoryCountItems(sessionId, refresh),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["inventory-count-sessions"] });
      await queryClient.invalidateQueries({ queryKey: ["inventory-count-items", selectedSessionId] });
      await queryClient.invalidateQueries({ queryKey: ["inventory-count-summary", selectedSessionId] });
    },
  });

  const countItemMutation = useMutation({
    mutationFn: ({
      sessionId,
      itemId,
      countedQuantity,
    }: {
      sessionId: number;
      itemId: number;
      countedQuantity: string;
    }) => updateInventoryCountItem(sessionId, itemId, countedQuantity),
    onSuccess: async (item) => {
      setRowCounts((prev) => ({ ...prev, [item.id]: item.counted_quantity ?? "0" }));
      await queryClient.invalidateQueries({ queryKey: ["inventory-count-items", selectedSessionId] });
      await queryClient.invalidateQueries({ queryKey: ["inventory-count-summary", selectedSessionId] });
    },
  });

  const countActionsDisabled =
    countItemMutation.isPending || !selectedSessionId || generateItemsMutation.isPending || itemsQuery.isFetching;

  const completeMutation = useMutation({
    mutationFn: completeInventoryCountSession,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["inventory-count-sessions"] });
      await queryClient.invalidateQueries({ queryKey: ["inventory-count-items", selectedSessionId] });
      await queryClient.invalidateQueries({ queryKey: ["inventory-count-summary", selectedSessionId] });
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
      await queryClient.invalidateQueries({ queryKey: ["inventory-summary"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });

  const onCreateSession = async (event: FormEvent) => {
    event.preventDefault();
    await createSessionMutation.mutateAsync({
      session_type: sessionType,
      warehouse_id: warehouseId ? Number(warehouseId) : undefined,
      tolerance_quantity: toleranceQuantity,
      notes: notes.trim() || undefined,
    });
  };

  const saveRowCount = async (item: InventoryCountItem) => {
    if (!selectedSessionId) {
      return;
    }
    const value = rowCounts[item.id] ?? item.counted_quantity ?? "0";
    await countItemMutation.mutateAsync({
      sessionId: selectedSessionId,
      itemId: item.id,
      countedQuantity: value,
    });
  };

  const saveQuickCount = async () => {
    if (!selectedSessionId || !focusedQuickItem) {
      return;
    }
    await countItemMutation.mutateAsync({
      sessionId: selectedSessionId,
      itemId: focusedQuickItem.id,
      countedQuantity: quickQuantity,
    });
  };

  return (
    <InventoryCountView
      sessionsPanelProps={{
        sessionType,
        onSessionTypeChange: setSessionType,
        warehouseId,
        onWarehouseIdChange: setWarehouseId,
        toleranceQuantity,
        onToleranceQuantityChange: setToleranceQuantity,
        notes,
        onNotesChange: setNotes,
        onCreateSession: (event) => void onCreateSession(event),
        createSessionPending: createSessionMutation.isPending,
        warehouses: warehousesQuery.data ?? [],
        sessions: sessionsQuery.data ?? [],
        selectedSessionId,
        onSelectSession: setSelectedSessionId,
      }}
      actionsPanelProps={{
        selectedSession,
        onGenerate: (refresh) => {
          if (!selectedSession) {
            return;
          }
          void generateItemsMutation.mutateAsync({ sessionId: selectedSession.id, refresh });
        },
        generatePending: generateItemsMutation.isPending,
        onComplete: (sessionId) => {
          void completeMutation.mutateAsync(sessionId);
        },
        completePending: completeMutation.isPending,
        summary: summaryQuery.data,
      }}
      quickCapturePanelProps={{
        scanBin,
        onScanBinChange: setScanBin,
        scanProduct,
        onScanProductChange: setScanProduct,
        focusedQuickItem,
        quickQuantity,
        onQuickQuantityChange: setQuickQuantity,
        onSaveQuickCount: () => {
          void saveQuickCount();
        },
        countActionsDisabled,
      }}
      itemsTableProps={{
        filteredItems,
        rowCounts,
        onRowCountChange: (itemId, value) => {
          setRowCounts((prev) => ({ ...prev, [itemId]: value }));
        },
        onSaveRowCount: (item) => {
          void saveRowCount(item);
        },
        countActionsDisabled,
        itemsLoading: itemsQuery.isLoading,
      }}
    />
  );
}
