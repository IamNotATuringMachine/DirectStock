import { expect, test } from "@playwright/test";

import { createE2EPurchaseOrder, loginAsAdminApi } from "./helpers/api";
import { loginAndOpenRoute, waitForApiCondition, waitForApiResponseJson } from "./helpers/ui";

test("documents flow uploads and lists an attachment", async ({ page, request }) => {
  const token = await loginAsAdminApi(request);
  const purchaseOrder = await createE2EPurchaseOrder(request, token);
  const headers = { Authorization: `Bearer ${token}` };
  const uniqueDocType = `e2e-doc-${Date.now()}`;
  const fileName = `phase3-${Date.now()}.pdf`;

  await loginAndOpenRoute(page, "/documents", { rootTestId: "documents-page" });

  await page.getByTestId("documents-entity-type").fill("purchase_order");
  await page.getByTestId("documents-entity-id").fill(String(purchaseOrder.id));
  await page.getByTestId("documents-document-type").fill(uniqueDocType);
  await page.getByTestId("documents-file-input").setInputFiles({
    name: fileName,
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n", "utf-8"),
  });

  const uploadResponsePromise = page.waitForResponse(
    (response) => response.request().method() === "POST" && response.url().includes("/api/documents"),
  );
  await page.getByTestId("documents-upload-btn").click();
  const uploadResponse = await uploadResponsePromise;
  expect(uploadResponse.ok()).toBeTruthy();

  await waitForApiCondition({
    description: "documents list shows uploaded attachment",
    fetchValue: async () =>
      await waitForApiResponseJson<{
        items: Array<{
          id: number;
          file_name: string;
          document_type: string;
        }>;
      }>({
        request,
        url: `/api/documents?entity_type=purchase_order&entity_id=${purchaseOrder.id}&document_type=${uniqueDocType}&page_size=200`,
        headers,
        description: "poll documents list",
      }),
    predicate: (payload) =>
      payload.items.some((item) => item.file_name === fileName && item.document_type === uniqueDocType),
  });

  await expect(page.getByTestId("documents-list")).toContainText(fileName);
  await expect(page.getByTestId("documents-list")).toContainText(uniqueDocType);
});
