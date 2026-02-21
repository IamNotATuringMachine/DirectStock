import { expect, test } from "@playwright/test";

import { loginAsAdminApi } from "./helpers/api";
import { loginAndOpenRoute, waitForApiCondition, waitForApiResponseJson } from "./helpers/ui";

test("audit log page shows phase-3 mutating endpoint entries", async ({ page, request }) => {
  const token = await loginAsAdminApi(request);
  const headers = { Authorization: `Bearer ${token}` };

  const create = await request.post("/api/return-orders", {
    headers,
    data: { notes: `audit-e2e-${Date.now()}` },
  });
  expect(create.ok()).toBeTruthy();
  const created = (await create.json()) as { id: number };

  await waitForApiCondition({
    description: "audit log entries for POST /api/return-orders",
    timeoutMs: 20_000,
    intervalMs: 350,
    fetchValue: async () =>
      await waitForApiResponseJson<{
        items: Array<{
          entity: string;
          action: string;
          endpoint: string;
          entity_id: string | null;
        }>;
      }>({
        request,
        url: "/api/audit-log?entity=return-orders&action=POST&page_size=50",
        headers,
        description: "poll audit log list",
      }),
    predicate: (payload) =>
      payload.items.some(
        (item) =>
          item.entity === "return-orders" &&
          item.action === "POST" &&
          item.endpoint === "/api/return-orders" &&
          item.entity_id === String(created.id),
      ),
  });

  await loginAndOpenRoute(page, "/audit-trail", { rootTestId: "audit-trail-page" });

  await page.getByTestId("audit-filter-entity").fill("return-orders");
  await page.getByTestId("audit-filter-action").fill("POST");

  await expect
    .poll(async () => await page.getByTestId("audit-table").innerText(), { timeout: 20_000 })
    .toContain("/api/return-orders");
  await expect(page.getByTestId("audit-table")).toContainText("/api/return-orders");
  await expect(page.getByTestId("audit-table")).toContainText("POST");
  await expect(page.getByTestId("audit-table")).toContainText(`#${created.id}`);
});
