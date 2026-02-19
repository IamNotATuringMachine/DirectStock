import os from "node:os";
import path from "node:path";

import fs from "fs-extra";
import { describe, expect, it } from "vitest";

import { listPlanCandidates } from "../src/ui/prompts.js";

describe("prompts", () => {
  it("finds multiple plan candidates in cwd", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ralph-prompts-"));
    await fs.writeFile(path.join(tempDir, "frontend_plan.json"), "{}");
    await fs.writeFile(path.join(tempDir, "backend_plan.json"), "{}");
    await fs.writeFile(path.join(tempDir, "notes.txt"), "ignore");

    const candidates = await listPlanCandidates(tempDir);

    expect(candidates).toEqual([
      path.join(tempDir, "backend_plan.json"),
      path.join(tempDir, "frontend_plan.json"),
    ]);
  });
});
