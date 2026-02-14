import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

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

  const chipLabel = compact ? `Queue ${stats.total}` : `${isOnline ? "Online" : "Offline"} | Queue ${stats.total}`;

  return (
    <div className={`offline-sync ${compact ? "compact" : ""}`}>
      <button
        className={`pwa-chip offline-sync-chip ${isOnline ? "pwa-chip-online" : "pwa-chip-offline"} ${compact ? "compact" : ""}`}
        onClick={() => setIsPanelOpen((value) => !value)}
        data-testid="offline-sync-chip"
        aria-label={`${isOnline ? "Online" : "Offline"} Queue: ${stats.total}`}
        type="button"
      >
        {chipLabel}
      </button>
      {isPanelOpen ? (
        <div className="offline-sync-panel" data-testid="offline-sync-panel">
          <div className="offline-sync-panel-header">
            <strong>Offline Queue</strong>
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
            Offen: {stats.total} | queued: {stats.queued} | failed: {stats.failed}
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
                      Status: {item.status} | Attempts: {item.attempts}
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
                      Retry
                    </button>
                    <button
                      className="btn offline-sync-btn"
                      onClick={() => void onDiscard(item.id)}
                      type="button"
                      data-testid={`offline-sync-discard-${index}`}
                    >
                      Discard
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
