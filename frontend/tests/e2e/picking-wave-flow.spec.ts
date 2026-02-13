import { expect, test } from "@playwright/test";

import { ensureE2EInventoryStock, loginAsAdminApi } from "./helpers/api";

test("picking wave flow supports scanner-based task completion", async ({ page, request }) => {
  const token = await loginAsAdminApi(request);
  const seeded = await ensureE2EInventoryStock(request, token, `E2E-PK-${Date.now()}`);
  const headers = { Authorization: `Bearer ${token}` };

  const productResponse = await request.get(
    `/api/products?search=${encodeURIComponent(seeded.productNumber)}&page_size=200`,
    { headers }
  );
  expect(productResponse.ok()).toBeTruthy();
  const productPayload = (await productResponse.json()) as {
    items: Array<{ id: number; product_number: string }>;
  };
  const product = productPayload.items.find((item) => item.product_number === seeded.productNumber);
  expect(product).toBeTruthy();

  const issue = await request.post("/api/goods-issues", {
    headers,
    data: { notes: `E2E picking ${Date.now()}` },
  });
  expect(issue.ok()).toBeTruthy();
  const issuePayload = (await issue.json()) as { id: number };

  const issueItem = await request.post(`/api/goods-issues/${issuePayload.id}/items`, {
    headers,
    data: {
      product_id: product!.id,
      requested_quantity: "1",
      unit: "piece",
      source_bin_id: seeded.binId,
    },
  });
  expect(issueItem.ok()).toBeTruthy();

  const wave = await request.post("/api/pick-waves", {
    headers,
    data: {
      goods_issue_ids: [issuePayload.id],
      notes: "E2E picking wave",
    },
  });
  expect(wave.ok()).toBeTruthy();
  const wavePayload = (await wave.json()) as {
    wave: { id: number; status: string };
    tasks: Array<{ id: number; source_bin_code: string | null; product_number: string }>;
  };
  const waveId = wavePayload.wave.id;
  const task = wavePayload.tasks[0];
  expect(task).toBeTruthy();

  await page.goto("/login");
  await page.getByTestId("login-username").fill(process.env.E2E_ADMIN_USERNAME ?? "admin");
  await page.getByTestId("login-password").fill(process.env.E2E_ADMIN_PASSWORD ?? "DirectStock2026!");
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/picking");
  await expect(page.getByTestId("picking-page")).toBeVisible();

  await expect(page.getByTestId(`pick-wave-item-${waveId}`)).toBeVisible();
  await page.getByTestId(`pick-wave-item-${waveId}`).click();

  await page.getByTestId("pick-wave-release-btn").click();
  await expect(page.getByTestId("pick-wave-selected-status")).toContainText("released");

  await page.getByTestId("pick-scan-task-select").selectOption(String(task.id));

  if (task.source_bin_code) {
    await page.getByTestId("pick-scan-input").fill(`DS:BIN:${task.source_bin_code}`);
    await page.getByTestId("pick-scan-submit").click();
    await expect(page.getByTestId("pick-scan-status")).toContainText("Produkt");
  }

  await page.getByTestId("pick-scan-input").fill(task.product_number);
  await page.getByTestId("pick-scan-submit").click();
  const taskRow = page.getByTestId(`pick-task-picked-${task.id}`).locator("xpath=ancestor::tr");
  await expect(taskRow).toContainText("picked");

  const pickButtons = page.locator('[data-testid^="pick-task-picked-"]');
  const totalTasks = await pickButtons.count();
  for (let index = 0; index < totalTasks; index += 1) {
    await pickButtons.nth(index).click();
  }

  await page.getByTestId("pick-wave-complete-btn").click();
  await expect(page.getByTestId("pick-wave-selected-status")).toContainText("completed");
});
