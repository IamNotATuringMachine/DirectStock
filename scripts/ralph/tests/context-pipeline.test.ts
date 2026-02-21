import os from "node:os";
import path from "node:path";

import fs from "fs-extra";
import { describe, expect, it, vi } from "vitest";

import { assertContextPipeline, resolveContextFilesForPlan } from "../src/lib/context-pipeline.js";
import type { Plan } from "../src/planner/plan-schema.js";

function samplePlan(stepFiles: string[]): Plan {
  return {
    schemaVersion: "1.1.0",
    goal: "Goal",
    createdAt: new Date().toISOString(),
    steps: [
      {
        id: "step-01",
        title: "Do work",
        description: "Implement feature",
        successCriteria: "true",
        status: "pending",
        attempts: 0,
        maxAttempts: 3,
        type: "code",
        files: stepFiles,
        riskLevel: "medium",
        owner: "team",
        postChecks: [],
        rollbackHint: "git revert",
      },
    ],
    metadata: {
      provider: "OpenAI",
      model: "gpt-5.3-codex",
      totalIterations: 2,
      completedIterations: 0,
    },
  };
}

describe("context pipeline", () => {
  it("resolves provider adapter and scoped AGENTS files", () => {
    const files = resolveContextFilesForPlan({
      providerId: "openai",
      plan: samplePlan(["frontend/src/pages/DashboardPage.tsx", "backend/app/main.py"]),
    });

    expect(files).toEqual(
      expect.arrayContaining([
        "AGENTS.md",
        "CODEX.md",
        "llms.txt",
        ".ai-context.md",
        "docs/agents/policy.contract.yaml",
        "docs/agents/commands.md",
        "docs/agents/repo-index.json",
        "frontend/AGENTS.md",
        "backend/AGENTS.md",
      ]),
    );
  });

  it("fails when required context files are missing and skipCheck is false", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ralph-context-missing-"));

    await expect(
      assertContextPipeline({
        cwd: tempDir,
        contextFiles: ["AGENTS.md", "CODEX.md"],
        skipCheck: false,
      }),
    ).rejects.toThrow("Missing required context files");
  });

  it("warns and continues when context files are missing and skipCheck is true", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ralph-context-skip-"));
    const logWarning = vi.fn();

    await expect(
      assertContextPipeline({
        cwd: tempDir,
        contextFiles: ["AGENTS.md", "CODEX.md"],
        skipCheck: true,
        logWarning,
      }),
    ).resolves.toBeUndefined();

    expect(logWarning).toHaveBeenCalledTimes(1);
  });
});
