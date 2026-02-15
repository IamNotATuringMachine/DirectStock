import { expect, test, type Page } from "@playwright/test";

type Rect = {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

type BoxMetrics = {
  username: Rect;
  password: Rect;
  submit: Rect;
  viewportWidth: number;
  htmlScrollWidth: number;
  bodyScrollWidth: number;
};

const VALID_USERNAME = process.env.E2E_ADMIN_USERNAME ?? "admin";
const VALID_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "DirectStock2026!";

function intersects(a: Rect, b: Rect): boolean {
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

async function collectLayoutMetrics(page: Page): Promise<BoxMetrics> {
  return page.evaluate(() => {
    const username = document.querySelector('[data-testid="login-username"]');
    const password = document.querySelector('[data-testid="login-password"]');
    const submit = document.querySelector('[data-testid="login-submit"]');

    if (!username || !password || !submit) {
      throw new Error("Login fields not found while collecting layout metrics.");
    }

    const rect = (node: Element) => {
      const box = node.getBoundingClientRect();
      return {
        top: box.top,
        left: box.left,
        right: box.right,
        bottom: box.bottom,
        width: box.width,
        height: box.height,
      };
    };

    return {
      username: rect(username),
      password: rect(password),
      submit: rect(submit),
      viewportWidth: window.innerWidth,
      htmlScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
    };
  });
}

async function assertLoginBaseVisible(page: Page) {
  await expect(page.getByTestId("login-page")).toBeVisible();
  await expect(page.locator("section.login-card")).toBeVisible();
  await expect(page.getByRole("heading", { name: "DirectStock Login" })).toBeVisible();
  await expect(page.getByTestId("login-form")).toBeVisible();
  await expect(page.getByTestId("login-username")).toBeVisible();
  await expect(page.getByTestId("login-password")).toBeVisible();
  await expect(page.getByTestId("login-submit")).toBeVisible();
}

test.describe("login page ui and functional regression", () => {
  test("functional: invalid login shows error and stays on /login", async ({ page }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];

    page.on("pageerror", (error) => {
      pageErrors.push(String(error));
    });
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    await page.goto("/login");
    await assertLoginBaseVisible(page);

    await page.getByTestId("login-username").fill("invalid-user");
    await page.getByTestId("login-password").fill("invalid-password");
    await page.getByTestId("login-submit").click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByTestId("login-error")).toHaveText("Login fehlgeschlagen");
    await expect(pageErrors, `Unexpected page errors: ${pageErrors.join(" | ")}`).toEqual([]);

    const unexpectedConsoleErrors = consoleErrors.filter(
      (entry) => !(entry.includes("401") || entry.includes("Unauthorized") || entry.includes("/api/auth/login")),
    );
    await expect(
      unexpectedConsoleErrors,
      `Unexpected console errors: ${unexpectedConsoleErrors.join(" | ")}`,
    ).toEqual([]);
  });

  test("functional: password enter submits and valid login redirects to dashboard", async ({ page }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];

    page.on("pageerror", (error) => {
      pageErrors.push(String(error));
    });
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    await page.goto("/login");
    await assertLoginBaseVisible(page);

    await page.getByTestId("login-username").fill(VALID_USERNAME);
    await page.getByTestId("login-password").fill(VALID_PASSWORD);
    await page.getByTestId("login-password").press("Enter");

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId("dashboard-page")).toBeVisible();
    await expect(pageErrors, `Unexpected page errors: ${pageErrors.join(" | ")}`).toEqual([]);
    await expect(consoleErrors, `Unexpected console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
  });

  test("ui-formatting: no overlap, consistent alignment and no horizontal overflow", async ({ page }) => {
    await page.goto("/login");
    await assertLoginBaseVisible(page);

    const metrics = await collectLayoutMetrics(page);

    expect(intersects(metrics.username, metrics.password)).toBeFalsy();
    expect(intersects(metrics.password, metrics.submit)).toBeFalsy();

    expect(Math.abs(metrics.username.left - metrics.password.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(metrics.password.left - metrics.submit.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(metrics.username.right - metrics.password.right)).toBeLessThanOrEqual(1);
    expect(Math.abs(metrics.password.right - metrics.submit.right)).toBeLessThanOrEqual(1);

    expect(metrics.htmlScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  });
});
