import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Cloud, CloudOff, RefreshCw } from "lucide-react";

import {
  discardOfflineMutation,
  getQueueStats,
  isOfflineNow,
  listOfflineQueueItems,
  retryOfflineMutation,
  subscribeOfflineQueueChanges,
  syncOfflineQueue,
  type OfflineQueueItem,
} from "../../services/offlineQueue";

type QueueStats = {
  queued: number;
  failed: number;
  total: number;
};

const REFRESH_INTERVAL_MS = 5000;

type OfflineSyncPanelProps = {
  compact?: boolean;
};

async function invalidateAfterSync(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["goods-receipts"] }),
    queryClient.invalidateQueries({ queryKey: ["goods-receipt-items"] }),
    queryClient.invalidateQueries({ queryKey: ["goods-issues"] }),
    queryClient.invalidateQueries({ queryKey: ["goods-issue-items"] }),
    queryClient.invalidateQueries({ queryKey: ["stock-transfers"] }),
    queryClient.invalidateQueries({ queryKey: ["stock-transfer-items"] }),
    queryClient.invalidateQueries({ queryKey: ["inventory-count-sessions"] }),
    queryClient.invalidateQueries({ queryKey: ["inventory-count-items"] }),
    queryClient.invalidateQueries({ queryKey: ["inventory-count-summary"] }),
    queryClient.invalidateQueries({ queryKey: ["inventory"] }),
    queryClient.invalidateQueries({ queryKey: ["inventory-summary"] }),
    queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
    queryClient.invalidateQueries({ queryKey: ["inter-warehouse-transfers"] }),
    queryClient.invalidateQueries({ queryKey: ["inter-warehouse-transfer-detail"] }),
    queryClient.invalidateQueries({ queryKey: ["shipments"] }),
    queryClient.invalidateQueries({ queryKey: ["shipment-tracking"] }),
  ]);
}

export default function OfflineSyncPanel({ compact = false }: OfflineSyncPanelProps) {
  const queryClient = useQueryClient();
  const [stats, setStats] = useState<QueueStats>({ queued: 0, failed: 0, total: 0 });
  const [items, setItems] = useState<OfflineQueueItem[]>([]);
  const [isOnline, setIsOnline] = useState(!isOfflineNow());
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncMessage, setLastSyncMessage] = useState<string | null>(null);

  const loadQueueState = async () => {
    const [nextStats, nextItems] = await Promise.all([getQueueStats(), listOfflineQueueItems()]);
    setStats(nextStats);
    setItems(nextItems);
  };

  const runSync = async () => {
    if (isOfflineNow()) {
      setLastSyncMessage("Synchronisation nicht moeglich: App ist offline.");
      return;
    }
    if (syncing) {
      return;
    }
    setSyncing(true);
    try {
      const result = await syncOfflineQueue();
      await loadQueueState();
      if (result.processed > 0) {
        await invalidateAfterSync(queryClient);
      }
      setLastSyncMessage(
        `Sync abgeschlossen: ${result.processed} verarbeitet, ${result.failed} fehlgeschlagen, ${result.remaining} offen.`
      );
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    void loadQueueState();
    const interval = window.setInterval(() => {
      void loadQueueState();
    }, REFRESH_INTERVAL_MS);

    const unsubscribe = subscribeOfflineQueueChanges(() => {
      void loadQueueState();
    });

    const onOnline = () => {
      setIsOnline(true);
      void runSync();
    };
    const onOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      unsubscribe();
      window.clearInterval(interval);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) => {
        if (a.status === b.status) {
          return a.created_at.localeCompare(b.created_at);
        }
        return a.status === "failed" ? -1 : 1;
      }),
    [items]
  );

  const onRetry = async (itemId: string) => {
    await retryOfflineMutation(itemId);
    await loadQueueState();
    if (isOnline) {
      await runSync();
    }
  };

  const onDiscard = async (itemId: string) => {
    await discardOfflineMutation(itemId);
    await loadQueueState();
  };

  const chipLabel = compact
    ? stats.total > 0 ? `${stats.total}` : ""
    : isOnline ? "Online" : "Offline";


  return (
    <div className={`offline-sync ${compact ? "compact" : ""}`}>
      <button
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all border ${isOnline
          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800"
          : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
          }`}
        onClick={() => setIsPanelOpen((value) => !value)}
        data-testid="offline-sync-chip"
        title={isOnline ? "Verbindung hergestellt" : "Keine Verbindung"}
        type="button"
      >
        {isOnline ? (
          <>
            <div className="relative">
              <Cloud className="w-4 h-4" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900"></span>
            </div>
            {!compact && <span className="text-xs font-semibold">Online</span>}
          </>
        ) : (
          <>
            <CloudOff className="w-4 h-4 opacity-70" />
            {!compact && <span className="text-xs font-semibold">Offline</span>}
          </>
        )}

        {stats.total > 0 && (
          <span className="ml-1 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">
            {stats.total}
          </span>
        )}
      </button>
      {isPanelOpen ? (
        <div className="offline-sync-panel" data-testid="offline-sync-panel">
          <div className="offline-sync-panel-header">
            <strong>Offline-Warteschlange</strong>
            <button
              className="btn offline-sync-btn"
              onClick={() => void runSync()}
              disabled={!isOnline || syncing || stats.total === 0}
              data-testid="offline-sync-run-btn"
              type="button"
            >
              {syncing ? "Sync laeuft..." : "Jetzt synchronisieren"}
            </button>
          </div>
          <p className="offline-sync-meta" data-testid="offline-sync-count">
            Offen: {stats.total} | wartend: {stats.queued} | fehlerhaft: {stats.failed}
          </p>
          {lastSyncMessage ? <p className="offline-sync-meta">{lastSyncMessage}</p> : null}
          <div className="offline-sync-list">
            {sortedItems.length === 0 ? (
              <p className="offline-sync-empty">Keine offenen Offline-Mutationen.</p>
            ) : (
              sortedItems.map((item, index) => (
                <div className={`offline-sync-item ${item.status}`} key={item.id} data-testid={`offline-sync-item-${index}`}>
                  <div>
                    <strong>
                      {item.method} {item.url}
                    </strong>
                    <p>
                      Status: {item.status} | Versuche: {item.attempts}
                    </p>
                    {item.last_error ? <p className="offline-sync-error">{item.last_error}</p> : null}
                  </div>
                  <div className="actions-cell">
                    <button
                      className="btn offline-sync-btn"
                      onClick={() => void onRetry(item.id)}
                      type="button"
                      data-testid={`offline-sync-retry-${index}`}
                    >
                      Erneut senden
                    </button>
                    <button
                      className="btn offline-sync-btn"
                      onClick={() => void onDiscard(item.id)}
                      type="button"
                      data-testid={`offline-sync-discard-${index}`}
                    >
                      Verwerfen
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
