import { expect, test } from "@playwright/test";
import { createE2EUserWithRoles } from "./helpers/api";

test("shipping flow supports create label tracking and cancel", async ({ page, request }) => {
  const user = await createE2EUserWithRoles(request, ["admin"]);

  await page.goto("/login");
  await page.getByTestId("login-username").fill(user.username);
  await page.getByTestId("login-password").fill(user.password);
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/shipping");
  await expect(page.getByTestId("shipping-page")).toBeVisible();
  await expect(page.getByTestId("shipping-carrier-select").locator('option[value="dhl_express"]')).toHaveCount(1);

  await page.getByTestId("shipping-carrier-select").selectOption("dhl");
  await page.getByTestId("shipping-recipient-input").fill("E2E Shipping Empfaenger");
  await page.getByTestId("shipping-address-input").fill("Musterstr. 42, 12345 Teststadt");
  await page.getByTestId("shipping-notes-input").fill(`E2E shipping ${Date.now()}`);
  await page.getByTestId("shipping-create-btn").click();

  await expect.poll(async () => await page.locator('[data-testid^="shipping-item-"]').count()).toBeGreaterThan(0);
  await expect
    .poll(async () => (await page.getByTestId("shipping-selected-status").textContent()) ?? "")
    .toContain("Status: draft");

  await page.getByTestId("shipping-create-label-btn").click();
  await expect
    .poll(async () => (await page.getByTestId("shipping-selected-status").textContent()) ?? "")
    .toContain("label_created");

  await page.getByTestId("shipping-refresh-tracking-btn").click();
  await expect.poll(async () => await page.getByTestId("shipping-tracking-table").locator("tbody tr").count()).toBeGreaterThan(0);

  await page.getByTestId("shipping-cancel-btn").click();
  await expect
    .poll(async () => (await page.getByTestId("shipping-selected-status").textContent()) ?? "")
    .toContain("cancelled");
});
