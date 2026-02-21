import os from "node:os";
import path from "node:path";

import { execa } from "execa";
import fs from "fs-extra";
import { describe, expect, it } from "vitest";

const liveProvidersRaw = process.env.RALPH_LIVE_PROVIDERS ?? "";
const LIVE_PROVIDERS = liveProvidersRaw
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean) as Array<"openai" | "anthropic" | "google">;
const LIVE_ENABLED = process.env.RALPH_LIVE_E2E === "1" && LIVE_PROVIDERS.length > 0;

function modelForProvider(provider: "openai" | "anthropic" | "google"): string {
  if (provider === "openai") {
    return process.env.RALPH_LIVE_OPENAI_MODEL ?? "gpt-5.3-codex";
  }
  if (provider === "anthropic") {
    return process.env.RALPH_LIVE_ANTHROPIC_MODEL ?? "claude-sonnet-4-6-20250217";
  }
  return process.env.RALPH_LIVE_GOOGLE_MODEL ?? "gemini-2.5-flash";
}

function thinkingForProvider(provider: "openai" | "anthropic" | "google"): string {
  if (provider === "openai") {
    return process.env.RALPH_LIVE_OPENAI_THINKING ?? "high";
  }
  if (provider === "anthropic") {
    return process.env.RALPH_LIVE_ANTHROPIC_THINKING ?? "10";
  }
  return process.env.RALPH_LIVE_GOOGLE_THINKING ?? "high";
}

function samplePlan(provider: string, model: string): Record<string, unknown> {
  return {
    schemaVersion: "1.1.0",
    goal: `Live smoke validation for ${provider}`,
    createdAt: new Date().toISOString(),
    steps: [
      {
        id: "step-01",
        title: "Run live provider smoke",
        description: "Validate one provider call and output normalization",
        successCriteria: "true",
        status: "pending",
        attempts: 0,
        maxAttempts: 1,
        type: "test",
        files: [],
        riskLevel: "low",
        owner: "agent",
        postChecks: [],
        rollbackHint: "none",
      },
    ],
    metadata: {
      provider,
      model,
      totalIterations: 1,
      completedIterations: 0,
    },
  };
}

if (!LIVE_ENABLED) {
  describe("ralph live smoke e2e (optional)", () => {
    it("is skipped unless RALPH_LIVE_PROVIDERS is configured", () => {
      expect(true).toBe(true);
    });
  });
} else {
  describe("ralph live smoke e2e (optional)", () => {
    it.each(LIVE_PROVIDERS)("runs live provider smoke for %s", async (provider) => {
      const checkBinary = await execa(
        "which",
        [provider === "openai" ? "codex" : provider === "anthropic" ? "claude" : "gemini"],
        {
          reject: false,
        },
      );
      if (checkBinary.exitCode !== 0) {
        return;
      }

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `ralph-live-${provider}-`));
      const planPath = path.join(tempDir, `${provider}.plan.json`);
      const runLogPath = path.join(tempDir, `${provider}.run.jsonl`);

      const model = modelForProvider(provider);
      const thinking = thinkingForProvider(provider);

      await fs.writeJson(planPath, samplePlan(provider, model), { spaces: 2 });

      const result = await execa(
        path.join(process.cwd(), "node_modules", ".bin", "tsx"),
        [
          "src/cli.ts",
          "ralph",
          "--no-preset",
          "--provider",
          provider,
          "--model",
          model,
          "--thinking",
          thinking,
          "--plan",
          planPath,
          "--max-iterations",
          "1",
          "--post-check-profile",
          "none",
          "--no-auto-commit",
          "--output-mode",
          "timeline",
          "--live-provider-events",
          "on",
          "--thinking-visibility",
          "summary",
          "--run-log-path",
          runLogPath,
          "--skip-context-pipeline-check",
          "--yes",
        ],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            HOME: tempDir,
          },
          reject: false,
          timeout: 120_000,
        },
      );

      const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
      expect(result.exitCode).toBe(0);
      expect(output).toContain("provider:final");

      const events = (await fs.readFile(runLogPath, "utf8"))
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as { event: string; providerEventType?: string });

      expect(events.some((event) => event.event === "provider_event")).toBe(true);
      expect(events.some((event) => event.providerEventType === "assistant_text")).toBe(true);
    });
  });
}
