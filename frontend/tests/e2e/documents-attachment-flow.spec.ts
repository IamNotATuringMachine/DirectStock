import { expect, test } from "@playwright/test";

test("documents flow uploads and lists an attachment", async ({ page }) => {
  const uniqueDocType = `e2e-doc-${Date.now()}`;
  const fileName = `phase3-${Date.now()}.pdf`;

  await page.goto("/login");
  await page.getByTestId("login-username").fill(process.env.E2E_ADMIN_USERNAME ?? "admin");
  await page.getByTestId("login-password").fill(process.env.E2E_ADMIN_PASSWORD ?? "DirectStock2026!");
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/documents");
  await expect(page.getByTestId("documents-page")).toBeVisible();

  await page.getByTestId("documents-entity-type").fill("purchase_order");
  await page.getByTestId("documents-entity-id").fill("1");
  await page.getByTestId("documents-document-type").fill(uniqueDocType);
  await page.getByTestId("documents-file-input").setInputFiles({
    name: fileName,
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n", "utf-8"),
  });
  await page.getByTestId("documents-upload-btn").click();

  await expect(page.getByTestId("documents-list")).toContainText(fileName);
  await expect(page.getByTestId("documents-list")).toContainText(uniqueDocType);
});
