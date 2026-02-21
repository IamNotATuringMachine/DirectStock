import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";

export const DEFAULT_ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME ?? "admin";
export const DEFAULT_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "DirectStock2026!";

export type LoginCredentials = {
  username: string;
  password: string;
};

export function adminCredentials(): LoginCredentials {
  return {
    username: DEFAULT_ADMIN_USERNAME,
    password: DEFAULT_ADMIN_PASSWORD,
  };
}

export async function loginViaUi(page: Page, credentials: LoginCredentials = adminCredentials()): Promise<void> {
  const submit = async () => {
    await page.goto("/login", { waitUntil: "commit", timeout: 90_000 });
    await expect(page.getByTestId("login-username")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("login-username").fill(credentials.username);
    await page.getByTestId("login-password").fill(credentials.password);
    await page.getByTestId("login-submit").click();
  };

  await submit();
  try {
    await expect(page).toHaveURL(/\/dashboard(?:$|[?#])/, { timeout: 15_000 });
  } catch {
    await submit();
    await expect(page).toHaveURL(/\/dashboard(?:$|[?#])/, { timeout: 15_000 });
  }
}

export async function loginAndOpenRoute(
  page: Page,
  route: string,
  options?: {
    credentials?: LoginCredentials;
    rootTestId?: string;
  },
): Promise<void> {
  await loginViaUi(page, options?.credentials);
  const routePattern = new RegExp(`${route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[?#])`);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.goto(route, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await expect(page).toHaveURL(routePattern, { timeout: 20_000 });
      if (options?.rootTestId) {
        await expect(page.getByTestId(options.rootTestId)).toBeVisible({ timeout: 30_000 });
      }
      return;
    } catch (error) {
      if (attempt === 1) {
        throw error;
      }
      await page.waitForTimeout(500);
    }
  }
}

export async function waitForApiCondition<T>(options: {
  description: string;
  fetchValue: () => Promise<T>;
  predicate: (value: T) => boolean;
  timeoutMs?: number;
  intervalMs?: number;
}): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 20_000;
  const intervalMs = options.intervalMs ?? 300;
  const started = Date.now();
  let latest: T | undefined;

  while (Date.now() - started < timeoutMs) {
    latest = await options.fetchValue();
    if (options.predicate(latest)) {
      return latest;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `Timed out waiting for API condition: ${options.description}. Last value: ${
      latest === undefined ? "undefined" : JSON.stringify(latest)
    }`,
  );
}

export async function waitForApiResponseJson<T>(options: {
  request: APIRequestContext;
  url: string;
  description: string;
  headers?: Record<string, string>;
}): Promise<T> {
  const response = await options.request.get(options.url, {
    headers: options.headers,
  });
  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`${options.description}: expected 2xx, got ${response.status()} ${body}`);
  }
  return (await response.json()) as T;
}

export async function saveProjectScopedScreenshot(
  page: Page,
  testInfo: TestInfo,
  name: string,
  options?: {
    fullPage?: boolean;
  },
): Promise<string> {
  mkdirSync("output", { recursive: true });
  const safeName = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const path = join("output", `${safeName}-${testInfo.project.name}.png`);
  await page.screenshot({ path, fullPage: options?.fullPage ?? true });
  return path;
}
