import { useEffect, useState } from "react";

import { usePwaRegistration } from "../../pwa/register";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type PwaStatusProps = {
  compact?: boolean;
};

export default function PwaStatus({ compact = false }: PwaStatusProps) {
  const { needRefresh, offlineReady, updateServiceWorker, dismissNotification } = usePwaRegistration();

  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator === "undefined" ? true : navigator.onLine);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const onInstall = async () => {
    if (!deferredPrompt) {
      return;
    }
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  const onlineLabel = isOnline ? "Online" : "Offline";

  return (
    <div className={`pwa-status ${compact ? "compact" : ""}`} data-testid="pwa-status">

      {deferredPrompt ? (
        <button className="btn pwa-install-btn" onClick={() => void onInstall()} data-testid="pwa-install-btn">
          App installieren
        </button>
      ) : null}

      {needRefresh || offlineReady ? (
        <div className="pwa-banner" data-testid="pwa-update-banner">
          <span>{needRefresh ? "Neue Version verfügbar" : "Offline-Modus bereit"}</span>
          <div className="actions-cell">
            {needRefresh ? (
              <button className="btn" onClick={() => void updateServiceWorker?.(true)} data-testid="pwa-update-btn">
                Aktualisieren
              </button>
            ) : null}
            <button className="btn" onClick={dismissNotification}>
              Schließen
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
