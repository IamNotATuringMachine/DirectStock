import { type FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { OperationSignoffModal } from "../components/operations/OperationSignoffModal";
import {
  completeInventoryCountSession,
  createInventoryCountSession,
  fetchInventoryCountItems,
  fetchInventoryCountSessions,
  fetchInventoryCountSummary,
  generateInventoryCountItems,
  updateInventoryCountItem,
} from "../services/inventoryCountsApi";
import {
  fetchOperationSignoffSettings,
  fetchOperators,
  unlockOperator,
  updateOperator,
} from "../services/operatorsApi";
import { fetchWarehouses } from "../services/warehousesApi";
import { useAuthStore } from "../stores/authStore";
import type { CompletionSignoffPayload, InventoryCountItem } from "../types";
import { isOperationSignoffRequired } from "../utils/tabletOps";
import { InventoryCountView } from "./inventory-count/InventoryCountView";

export default function InventoryCountPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const requiresSignoffCompletion = isOperationSignoffRequired(user);

  const [sessionType, setSessionType] = useState<"snapshot" | "cycle">("snapshot");
  const [warehouseId, setWarehouseId] = useState("");
  const [toleranceQuantity, setToleranceQuantity] = useState("0");
  const [notes, setNotes] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);

  const [scanBin, setScanBin] = useState("");
  const [scanProduct, setScanProduct] = useState("");
  const [quickQuantity, setQuickQuantity] = useState("0");

  const [rowCounts, setRowCounts] = useState<Record<number, string>>({});
  const [isSignoffModalOpen, setIsSignoffModalOpen] = useState(false);

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

  const operatorsQuery = useQuery({
    queryKey: ["operators"],
    queryFn: fetchOperators,
    enabled: requiresSignoffCompletion,
  });

  const signoffSettingsQuery = useQuery({
    queryKey: ["operators", "signoff-settings"],
    queryFn: fetchOperationSignoffSettings,
    enabled: requiresSignoffCompletion,
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

  const unlockOperatorMutation = useMutation({
    mutationFn: unlockOperator,
  });

  const updateOperatorPinMutation = useMutation({
    mutationFn: ({
      operatorId,
      pin,
      pinEnabledOnly = false,
    }: {
      operatorId: number;
      pin?: string;
      pinEnabledOnly?: boolean;
    }) =>
      updateOperator(operatorId, pinEnabledOnly ? { pin_enabled: true } : { pin, pin_enabled: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["operators"] });
    },
  });

  const countActionsDisabled =
    countItemMutation.isPending || !selectedSessionId || generateItemsMutation.isPending || itemsQuery.isFetching;

  const completeMutation = useMutation({
    mutationFn: ({
      sessionId,
      payload,
    }: {
      sessionId: number;
      payload?: CompletionSignoffPayload;
    }) => completeInventoryCountSession(sessionId, payload),
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

  const onCompleteSession = async (sessionId: number) => {
    if (!requiresSignoffCompletion) {
      await completeMutation.mutateAsync({ sessionId });
      return;
    }
    setIsSignoffModalOpen(true);
  };

  const onConfirmSignoff = async (payload: CompletionSignoffPayload) => {
    if (!selectedSessionId) {
      return;
    }
    await completeMutation.mutateAsync({ sessionId: selectedSessionId, payload });
    setIsSignoffModalOpen(false);
  };

  return (
    <>
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
            void onCompleteSession(sessionId);
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
      <OperationSignoffModal
        isOpen={isSignoffModalOpen}
        title="Inventur abschließen"
        operators={operatorsQuery.data ?? []}
        settings={signoffSettingsQuery.data ?? null}
        loading={operatorsQuery.isLoading || signoffSettingsQuery.isLoading}
        submitting={completeMutation.isPending || updateOperatorPinMutation.isPending}
        onClose={() => setIsSignoffModalOpen(false)}
        onUnlock={(pin) => unlockOperatorMutation.mutateAsync(pin)}
        onSetOperatorPin={(operatorId, pin) => updateOperatorPinMutation.mutateAsync({ operatorId, pin })}
        onEnableOperatorPin={(operatorId) => updateOperatorPinMutation.mutateAsync({ operatorId, pinEnabledOnly: true })}
        onConfirm={(payload) => onConfirmSignoff(payload)}
      />
    </>
  );
}
