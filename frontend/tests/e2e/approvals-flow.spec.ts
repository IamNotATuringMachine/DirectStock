import { expect, test } from "@playwright/test";

import { loginAsAdminApi } from "./helpers/api";

test("approvals flow can approve a pending request", async ({ page, request }) => {
  const token = await loginAsAdminApi(request);
  const headers = { Authorization: `Bearer ${token}` };

  const create = await request.post("/api/approvals", {
    headers,
    data: {
      entity_type: "purchase_order",
      entity_id: 1,
      amount: "10",
      reason: `E2E approval ${Date.now()}`,
    },
  });
  expect(create.ok()).toBeTruthy();
  const approval = (await create.json()) as { id: number };

  await page.goto("/login");
  await page.getByTestId("login-username").fill(process.env.E2E_ADMIN_USERNAME ?? "admin");
  await page.getByTestId("login-password").fill(process.env.E2E_ADMIN_PASSWORD ?? "DirectStock2026!");
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/approvals");
  await expect(page.getByTestId("approvals-page")).toBeVisible();

  // New UI splits ID and Type, so we look for the approve button which is specific to the ID
  const approveButton = page.getByTestId(`approval-approve-${approval.id}`);
  await expect(approveButton).toBeVisible();

  await approveButton.click();
  await expect(approveButton).toHaveCount(0);
});
