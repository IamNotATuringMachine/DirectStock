import { expect, test } from "@playwright/test";

import { loginAndOpenRoute } from "./helpers/ui";

test("verify UI changes for Artikelstamm and Top Taskbar", async ({ page }) => {
  await loginAndOpenRoute(page, "/products", { rootTestId: "products-page" });

  const searchInput = page.getByTestId("products-search-input");
  await expect(searchInput).toBeVisible();
  await expect(searchInput).toHaveClass(/pl-12/);

  const searchIcon = page.locator('[data-testid="products-toolbar"] .lucide-search').first();
  await expect(searchIcon).toHaveClass(/pointer-events-none/);
  await expect(searchIcon).toHaveClass(/left-3\.5/);

  const statusSelect = page.getByTestId("products-status-filter");
  await expect(statusSelect).toHaveClass(/pl-12/);

  const topbarTitle = page.locator(".topbar-title");
  await expect(topbarTitle).toHaveClass(/font-semibold/);
  await expect(topbarTitle).toHaveClass(/tracking-tight/);
  await expect(topbarTitle).toHaveClass(/text-lg/);

  const userAvatar = page.locator(".user-avatar");
  await expect(userAvatar).toBeVisible();
  await expect(userAvatar).toHaveClass(/rounded-full/);
});
