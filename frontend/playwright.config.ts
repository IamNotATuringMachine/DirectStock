import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:8080",
    trace: "on-first-retry",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    testIdAttribute: "data-testid",
  },
});
