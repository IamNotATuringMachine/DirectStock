import { expect, test } from "@playwright/test";

import { loginViaUi } from "./helpers/ui";

test("customers page supports master-detail with location-specific contacts", async ({ page }) => {
  await loginViaUi(page);
  await page.goto("/customers", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("customers-page")).toBeVisible();

  const marker = Date.now().toString();
  const customerNumber = `UI-CUS-${marker}`;
  const customerName = `Globus Gruppe ${marker}`;
  const locationNameKoblenz = `Globus Markthalle Koblenz ${marker}`;
  const locationNameMainz = `Globus Markthalle Mainz ${marker}`;
  const locationCodeKoblenz = `GLOBUS-KO-${marker.slice(-4)}`;
  const locationCodeMainz = `GLOBUS-MZ-${marker.slice(-4)}`;

  await page.getByTestId("customers-open-create-modal").click();
  const customerModal = page.getByTestId("customer-create-modal");
  await expect(customerModal).toBeVisible();

  await customerModal.getByPlaceholder("Kundennummer*").fill(customerNumber);
  await customerModal.getByPlaceholder("Firmenname*").fill(customerName);
  await customerModal.getByPlaceholder("Kontaktname").fill("Zentrale Einkauf");
  await customerModal.getByPlaceholder("E-Mail").fill(`globus-${marker}@example.com`);
  await customerModal.getByPlaceholder("Telefon").fill("+49 261 1000");

  await page.getByTestId("customer-create-submit").click();
  await expect(page.getByTestId("customer-create-modal")).toBeHidden();
  await expect(page.locator("[data-testid^='customers-item-']").filter({ hasText: customerName }).first()).toBeVisible();

  await page.getByTestId("locations-open-create-modal").click();
  const createLocationModal = page.getByTestId("location-create-modal");
  await expect(createLocationModal).toBeVisible();

  await createLocationModal.getByPlaceholder("Standortcode*").fill(locationCodeKoblenz);
  await createLocationModal.getByPlaceholder("Standortname*").fill(locationNameKoblenz);
  await createLocationModal.getByPlaceholder("Straße").fill("Markthallenstraße");
  await createLocationModal.getByPlaceholder("Hausnummer").fill("1");
  await createLocationModal.getByPlaceholder("PLZ").fill("56068");
  await createLocationModal.getByPlaceholder("Ort", { exact: true }).fill("Koblenz");

  await page.getByTestId("location-create-submit").click();
  await expect(page.getByTestId("location-create-modal")).toBeHidden();
  await expect(page.getByTestId("customer-location-details")).toContainText(locationNameKoblenz);

  await page.getByTestId("locations-open-create-modal").click();
  await expect(createLocationModal).toBeVisible();

  await createLocationModal.getByPlaceholder("Standortcode*").fill(locationCodeMainz);
  await createLocationModal.getByPlaceholder("Standortname*").fill(locationNameMainz);
  await createLocationModal.getByPlaceholder("Straße").fill("Markthallenallee");
  await createLocationModal.getByPlaceholder("Hausnummer").fill("8");
  await createLocationModal.getByPlaceholder("PLZ").fill("55116");
  await createLocationModal.getByPlaceholder("Ort", { exact: true }).fill("Mainz");

  await page.getByTestId("location-create-submit").click();
  await expect(page.getByTestId("location-create-modal")).toBeHidden();
  await expect(page.getByTestId("customer-location-details")).toContainText(locationNameMainz);

  const koblenzLocationRow = page
    .locator("[data-testid^='customer-location-item-']")
    .filter({ hasText: locationNameKoblenz });
  await koblenzLocationRow.locator("button").first().click();

  await expect(page.getByTestId("customer-location-details")).toContainText(locationNameKoblenz);
  await expect(page.getByTestId("customer-location-details")).toContainText(locationCodeKoblenz);
  await expect(page.getByTestId("customer-location-details")).toContainText("Koblenz");

  await page.getByTestId("location-edit-open").click();
  const editLocationModal = page.getByTestId("location-edit-modal");
  await expect(editLocationModal).toBeVisible();

  await editLocationModal.getByPlaceholder("Telefon").fill("0261-987654");
  await page.getByTestId("location-edit-submit").click();

  await expect(page.getByTestId("location-edit-modal")).toBeHidden();
  await expect(page.getByTestId("customer-location-details")).toContainText("0261-987654");

  await page.getByPlaceholder("Vorname").fill("Erika");
  await page.getByPlaceholder("Nachname").fill("Mueller");
  await page.getByPlaceholder("Titel / Funktion (z. B. Kassenleitung)").fill("Kassenleitung");
  await page.getByRole("button", { name: "Ansprechpartner anlegen" }).click();

  await expect(page.getByText("Erika Mueller")).toBeVisible();

  const mainzLocationRow = page
    .locator("[data-testid^='customer-location-item-']")
    .filter({ hasText: locationNameMainz });
  await mainzLocationRow.locator("button").first().click();

  await page.getByPlaceholder("Vorname").fill("Max");
  await page.getByPlaceholder("Nachname").fill("Mustermann");
  await page.getByPlaceholder("Titel / Funktion (z. B. Kassenleitung)").fill("Marktleitung");
  await page.getByRole("button", { name: "Ansprechpartner anlegen" }).click();

  await expect(page.getByText("Max Mustermann")).toBeVisible();
  await expect(page.getByText("Erika Mueller")).toHaveCount(0);

  await koblenzLocationRow.locator("button").first().click();
  await expect(page.getByText("Erika Mueller")).toBeVisible();
  await expect(page.getByText("Max Mustermann")).toHaveCount(0);
});
