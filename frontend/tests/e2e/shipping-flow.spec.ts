import { expect, test } from "@playwright/test";

test("shipping flow supports create label tracking and cancel", async ({ page }) => {
  await page.goto("/login");
  await page.getByTestId("login-username").fill(process.env.E2E_ADMIN_USERNAME ?? "admin");
  await page.getByTestId("login-password").fill(process.env.E2E_ADMIN_PASSWORD ?? "DirectStock2026!");
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/shipping");
  await expect(page.getByTestId("shipping-page")).toBeVisible();

  await page.getByTestId("shipping-carrier-select").selectOption("dhl");
  await page.getByTestId("shipping-recipient-input").fill("E2E Shipping Empfaenger");
  await page.getByTestId("shipping-address-input").fill("Musterstr. 42, 12345 Teststadt");
  await page.getByTestId("shipping-notes-input").fill(`E2E shipping ${Date.now()}`);
  await page.getByTestId("shipping-create-btn").click();

  await expect.poll(async () => await page.locator('[data-testid^="shipping-item-"]').count()).toBeGreaterThan(0);
  await page.locator('[data-testid^="shipping-item-"]').first().click();

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
