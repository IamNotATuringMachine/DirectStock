import { expect, test, type Page } from "@playwright/test";

async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByTestId("login-username").fill(process.env.E2E_ADMIN_USERNAME ?? "admin");
  await page.getByTestId("login-password").fill(process.env.E2E_ADMIN_PASSWORD ?? "DirectStock2026!");
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/(dashboard|tablet-ops)(?:$|[?#])/);
}

test.describe("sidebar repeat navigation", () => {
  test("can switch between dashboard and products more than five times", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard(?:$|[?#])/);

    const navigation = page.getByRole("navigation");
    const sequence = [
      { label: "Artikelstamm", path: "/products" },
      { label: "Dashboard", path: "/dashboard" },
    ];

    for (let index = 0; index < 12; index += 1) {
      const current = sequence[index % sequence.length];
      await navigation.getByRole("link", { name: current.label }).click();
      await expect(page).toHaveURL(new RegExp(`${current.path}(?:$|[?#])`));
    }
  });
});
