import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  globalTeardown: "./tests/e2e/globalTeardown.ts",
  fullyParallel: false,
  preserveOutput: "never",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    trace: "on-first-retry",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    testIdAttribute: "data-testid",
  },
  projects: [
    {
      name: "web-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1366, height: 768 },
      },
    },
    {
      name: "ios-iphone-se",
      use: {
        ...devices["iPhone SE"],
      },
    },
    {
      name: "ios-iphone-15-pro",
      use: {
        ...devices["iPhone 15 Pro"],
      },
    },
    {
      name: "ios-ipad",
      use: {
        ...devices["iPad Pro 11"],
      },
    },
  ],
});
