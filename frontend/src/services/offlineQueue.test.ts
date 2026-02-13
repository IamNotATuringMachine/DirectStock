import { describe, expect, it } from "vitest";

import { applyBackoffForAttempt, buildQueuedMessage, isOfflineNow, shouldQueueOfflineMutation } from "./offlineQueue";

function setOnlineState(isOnline: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: isOnline,
  });
}

describe("offlineQueue helpers", () => {
  it("queues supported mutation paths only when offline", () => {
    setOnlineState(false);
    expect(isOfflineNow()).toBe(true);
    expect(shouldQueueOfflineMutation("POST", "/goods-receipts")).toBe(true);
    expect(shouldQueueOfflineMutation("PUT", "/inventory-counts/1/items/2")).toBe(true);
    expect(shouldQueueOfflineMutation("PATCH", "/pick-tasks/10")).toBe(true);
    expect(shouldQueueOfflineMutation("POST", "/return-orders/5/status")).toBe(true);
    expect(shouldQueueOfflineMutation("GET", "/goods-receipts")).toBe(false);
    expect(shouldQueueOfflineMutation("POST", "/products")).toBe(false);
  });

  it("does not queue when online", () => {
    setOnlineState(true);
    expect(isOfflineNow()).toBe(false);
    expect(shouldQueueOfflineMutation("POST", "/goods-receipts")).toBe(false);
  });

  it("builds user-facing queue message", () => {
    expect(buildQueuedMessage("Wareneingang").message).toContain("Wareneingang");
  });

  it("backoff timestamp increases with attempts", () => {
    const first = new Date(applyBackoffForAttempt(1)).getTime();
    const later = new Date(applyBackoffForAttempt(3)).getTime();
    expect(later).toBeGreaterThan(first);
  });
});
