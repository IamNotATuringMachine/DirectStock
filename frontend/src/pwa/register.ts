import { useEffect, useMemo, useState } from "react";
import { registerSW } from "virtual:pwa-register";

type UpdateServiceWorker = (reloadPage?: boolean) => Promise<void>;

export type PwaRegistrationState = {
  needRefresh: boolean;
  offlineReady: boolean;
  updateServiceWorker: UpdateServiceWorker | null;
  dismissNotification: () => void;
};

export function usePwaRegistration(): PwaRegistrationState {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [updateServiceWorker, setUpdateServiceWorker] =
    useState<UpdateServiceWorker | null>(null);

  useEffect(() => {
    if (import.meta.env.DEV) {
      return;
    }

    const update = registerSW({
      immediate: false,
      onNeedRefresh() {
        setNeedRefresh(true);
      },
      onOfflineReady() {
        setOfflineReady(true);
      },
      onRegisteredSW(swUrl: string | undefined, registration: ServiceWorkerRegistration | undefined) {
        if (!swUrl || !registration) {
          return;
        }
      },
      onRegisterError(error: unknown) {
        console.error("PWA registration error", error);
      },
    });

    setUpdateServiceWorker(() => update);
  }, []);

  const dismissNotification = useMemo(
    () => () => {
      setNeedRefresh(false);
      setOfflineReady(false);
    },
    []
  );

  return {
    needRefresh,
    offlineReady,
    updateServiceWorker,
    dismissNotification,
  };
}
