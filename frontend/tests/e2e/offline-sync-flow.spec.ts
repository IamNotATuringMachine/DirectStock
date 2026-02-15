import { expect, test } from "@playwright/test";

test("offline queue captures goods receipt mutation and syncs after reconnect", async ({ page }) => {
  await page.goto("/login");
  await page.getByTestId("login-username").fill(process.env.E2E_ADMIN_USERNAME ?? "admin");
  await page.getByTestId("login-password").fill(process.env.E2E_ADMIN_PASSWORD ?? "DirectStock2026!");
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/dashboard$/);
  const isMobileLayout = await page.evaluate(() => window.matchMedia("(max-width: 1100px)").matches);
  if (isMobileLayout) {
    await page.getByTestId("sidebar-toggle").click();
  }
  await page.getByTestId("offline-sync-chip").click();
  await expect(page.getByTestId("offline-sync-panel")).toBeVisible();
  await expect(page.getByTestId("offline-sync-count")).toContainText("Offen: 0 | wartend: 0 | fehlerhaft: 0");

  await page.context().setOffline(true);
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("directstock_offline_queue", 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("queue")) {
          db.createObjectStore("queue", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("id_map")) {
          db.createObjectStore("id_map", { keyPath: "local_id" });
        }
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta", { keyPath: "key" });
        }
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("queue", "readwrite");
        const store = tx.objectStore("queue");
        const now = new Date().toISOString();
        store.put({
          id: `e2e-${Date.now()}`,
          operation_id: `op-${Date.now()}`,
          method: "POST",
          url: "/goods-receipts",
          payload: { notes: "offline-e2e" },
          status: "queued",
          attempts: 0,
          next_retry_at: null,
          last_error: null,
          created_at: now,
          updated_at: now,
          entity_type: "goods_receipt",
          entity_id: -1,
          parent_entity_id: null,
        });
        tx.onerror = () => reject(tx.error);
        tx.oncomplete = () => resolve();
      };
    });
    window.dispatchEvent(new CustomEvent("directstock-offline-queue-changed"));
  });

  await expect(page.getByTestId("offline-sync-count")).toContainText(/Offen: [1-9]/);

  await page.context().setOffline(false);
  await page.evaluate(() => {
    Object.defineProperty(Navigator.prototype, "onLine", {
      configurable: true,
      get: () => true,
    });
    window.dispatchEvent(new Event("online"));
  });

  await expect(page.getByTestId("offline-sync-count")).toContainText("Offen: 0 | wartend: 0 | fehlerhaft: 0");
});
