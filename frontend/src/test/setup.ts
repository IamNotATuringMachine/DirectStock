import { afterEach } from "vitest";

const memoryStorage = (() => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
})();

if (typeof window !== "undefined") {
  const current = window.localStorage as unknown as { getItem?: unknown; setItem?: unknown } | undefined;
  if (typeof current?.getItem !== "function" || typeof current?.setItem !== "function") {
    Object.defineProperty(window, "localStorage", {
      value: memoryStorage,
      writable: true,
      configurable: true,
    });
  }
}

afterEach(() => {
  if (typeof window === "undefined") {
    return;
  }
  const storage = window.localStorage as unknown as { clear?: () => void } | undefined;
  storage?.clear?.();
});
