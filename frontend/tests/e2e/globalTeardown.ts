import { rm } from "node:fs/promises";
import { join } from "node:path";

import type { FullConfig } from "@playwright/test";

const ARTIFACT_DIRECTORIES = ["test-results", "playwright-report", "blob-report"];

export default async function globalTeardown(_config: FullConfig) {
  if (process.env.E2E_KEEP_ARTIFACTS === "1" || process.env.E2E_KEEP_ARTIFACTS?.toLowerCase() === "true") {
    return;
  }

  await Promise.all(
    ARTIFACT_DIRECTORIES.map(async (directory) => {
      await rm(join(process.cwd(), directory), { recursive: true, force: true });
    }),
  );
}
