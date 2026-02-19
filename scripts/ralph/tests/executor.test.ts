import os from "node:os";
import path from "node:path";

import fs from "fs-extra";
import { describe, expect, it } from "vitest";

import { createRunLogger } from "../src/lib/run-log.js";
import { buildIterationPrompt, runRalphLoop } from "../src/loop/executor.js";
import type { Plan } from "../src/planner/plan-schema.js";
import type { ProviderAdapter, ProviderExecutionInput } from "../src/providers/types.js";

function samplePlan(successCriteria = "true", maxAttempts = 3): Plan {
  return {
    schemaVersion: "1.1.0",
    goal: "Goal",
    createdAt: new Date().toISOString(),
    steps: [
      {
        id: "step-01",
        title: "Do work",
        description: "Implement feature",
        successCriteria,
        status: "pending",
        attempts: 0,
        maxAttempts,
        type: "code",
        files: [],
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

function fakeProvider(ok = true): ProviderAdapter {
  return {
    id: "openai",
    name: "OpenAI",
    cliCommand: "codex",
    models: [],
    thinkingOptions: [],
    defaultModel: "gpt-5.3-codex",
    defaultThinking: "high",
    supportsResume: true,
    isInstalled: async () => true,
    buildCommand: () => ({ command: "codex", args: ["exec"] }),
    execute: async (input) => ({
      ok,
      exitCode: ok ? 0 : 1,
      timedOut: false,
      stdout: "",
      stderr: ok ? "" : "error",
      responseText: ok ? "ok" : "",
      usedModel: input.model,
      command: { command: "codex", args: ["exec"] },
      sessionId: input.resumeSessionId ?? "session-1",
    }),
  };
}

describe("executor", () => {
  it("builds an iteration prompt with key sections", () => {
    const plan = samplePlan();
    const step = plan.steps[0];
    const prompt = buildIterationPrompt(plan, step, "git state");

    expect(prompt).toContain("Dein aktueller Task");
    expect(prompt).toContain(step.title);
    expect(prompt).toContain(step.successCriteria);
    expect(prompt).toContain("Affected Paths");
    expect(prompt).toContain("Risk Class");
    expect(prompt).toContain("Git State");
  });

  it("builds prompt only with current step context", () => {
    const plan = samplePlan();
    plan.steps.push({
      ...plan.steps[0],
      id: "step-02",
      title: "Other step that must not be in prompt",
    });
    const prompt = buildIterationPrompt(plan, plan.steps[0], "git state");

    expect(prompt).toContain(plan.steps[0].title);
    expect(prompt).not.toContain(plan.steps[1].title);
  });

  it("marks step done when provider + success criteria pass", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ralph-exec-pass-"));
    const planPath = path.join(tempDir, "plan.json");
    const plan = samplePlan("true");
    await fs.writeJson(planPath, plan, { spaces: 2 });

    const summary = await runRalphLoop({
      provider: fakeProvider(true),
      model: "gpt-5.3-codex",
      thinkingValue: "high",
      planPath,
      plan,
      maxIterations: 1,
      workingDir: tempDir,
      timeoutMs: 2000,
      dryRun: false,
      autoCommit: false,
      sessionStrategy: "reset",
    });

    expect(summary.completedSteps).toBe(1);
    expect(plan.steps[0].status).toBe("done");
  });

  it("increments attempts and fails step when criteria fail", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ralph-exec-fail-"));
    const planPath = path.join(tempDir, "plan.json");
    const plan = samplePlan("false", 1);
    await fs.writeJson(planPath, plan, { spaces: 2 });

    const summary = await runRalphLoop({
      provider: fakeProvider(true),
      model: "gpt-5.3-codex",
      thinkingValue: "high",
      planPath,
      plan,
      maxIterations: 1,
      workingDir: tempDir,
      timeoutMs: 2000,
      dryRun: false,
      autoCommit: false,
      sessionStrategy: "reset",
    });

    expect(summary.failedSteps).toBe(1);
    expect(plan.steps[0].status).toBe("failed");
    expect(plan.steps[0].attempts).toBe(1);
  });

  it("fails immediately when selected model is unavailable and does not fallback", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ralph-exec-model-unavailable-"));
    const planPath = path.join(tempDir, "plan.json");
    const plan = samplePlan("true", 3);
    await fs.writeJson(planPath, plan, { spaces: 2 });

    const calls: ProviderExecutionInput[] = [];
    const provider: ProviderAdapter = {
      ...fakeProvider(false),
      execute: async (input) => {
        calls.push(input);
        return {
          ok: false,
          exitCode: 1,
          timedOut: false,
          stdout: "",
          stderr: "Unknown model: gemini-3-pro-preview",
          responseText: "",
          usedModel: input.model,
          command: { command: "codex", args: ["exec"] },
          sessionId: input.resumeSessionId,
        };
      },
    };

    const summary = await runRalphLoop({
      provider,
      model: "gemini-3-pro-preview",
      thinkingValue: "high",
      planPath,
      plan,
      maxIterations: 1,
      workingDir: tempDir,
      timeoutMs: 2000,
      dryRun: false,
      autoCommit: false,
      sessionStrategy: "reset",
    });

    expect(summary.failedSteps).toBe(0);
    expect(plan.steps[0].status).toBe("pending");
    expect(plan.steps[0].attempts).toBe(1);
    expect(calls).toHaveLength(1);
    expect(calls[0].model).toBe("gemini-3-pro-preview");
    expect(plan.steps[0].lastError).toContain("No fallback models are configured");
  });

  it("does not mutate plan file in dry-run", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ralph-exec-dry-"));
    const planPath = path.join(tempDir, "plan.json");
    const plan = samplePlan("true", 3);
    await fs.writeJson(planPath, plan, { spaces: 2 });

    const before = await fs.readFile(planPath, "utf8");
    const beforeStat = await fs.stat(planPath);

    await runRalphLoop({
      provider: fakeProvider(true),
      model: "gpt-5.3-codex",
      thinkingValue: "high",
      planPath,
      plan,
      maxIterations: 1,
      workingDir: tempDir,
      timeoutMs: 2000,
      dryRun: true,
      autoCommit: false,
      sessionStrategy: "reset",
    });

    const after = await fs.readFile(planPath, "utf8");
    const afterStat = await fs.stat(planPath);
    expect(after).toBe(before);
    expect(afterStat.mtimeMs).toBe(beforeStat.mtimeMs);
  });

  it("propagates resume session id across iterations", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ralph-exec-resume-"));
    const planPath = path.join(tempDir, "plan.json");
    const plan = samplePlan("true");
    plan.steps.push({
      ...plan.steps[0],
      id: "step-02",
      title: "Do more work",
    });

    await fs.writeJson(planPath, plan, { spaces: 2 });

    const calls: ProviderExecutionInput[] = [];
    const provider: ProviderAdapter = {
      ...fakeProvider(true),
      execute: async (input) => {
        calls.push(input);
        return {
          ok: true,
          exitCode: 0,
          timedOut: false,
          stdout: "",
          stderr: "",
          responseText: "ok",
          usedModel: input.model,
          command: { command: "codex", args: ["exec"] },
          sessionId: calls.length === 1 ? "session-alpha" : "session-beta",
        };
      },
    };

    await runRalphLoop({
      provider,
      model: "gpt-5.3-codex",
      thinkingValue: "high",
      planPath,
      plan,
      maxIterations: 2,
      workingDir: tempDir,
      timeoutMs: 2000,
      dryRun: false,
      autoCommit: false,
      sessionStrategy: "resume",
      initialResumeSessionId: "session-persisted",
    });

    expect(calls).toHaveLength(2);
    expect(calls[0].resumeSessionId).toBe("session-persisted");
    expect(calls[1].resumeSessionId).toBe("session-alpha");
    expect(plan.metadata.resumeSessionId).toBe("session-beta");
  });

  it("fails step when step post-check fails", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ralph-exec-stepcheck-fail-"));
    const planPath = path.join(tempDir, "plan.json");
    const plan = samplePlan("true", 1);
    plan.steps[0].postChecks = ["false"];
    await fs.writeJson(planPath, plan, { spaces: 2 });

    const summary = await runRalphLoop({
      provider: fakeProvider(true),
      model: "gpt-5.3-codex",
      thinkingValue: "high",
      planPath,
      plan,
      maxIterations: 1,
      workingDir: tempDir,
      timeoutMs: 2000,
      dryRun: false,
      autoCommit: false,
      sessionStrategy: "reset",
    });

    expect(summary.failedSteps).toBe(1);
    expect(plan.steps[0].status).toBe("failed");
    expect(plan.steps[0].lastError).toContain("$ false");
  });

  it("writes jsonl run log events for iterations", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ralph-exec-log-"));
    const planPath = path.join(tempDir, "plan.json");
    const runLogPath = path.join(tempDir, "run.jsonl");
    const plan = samplePlan("true");
    await fs.writeJson(planPath, plan, { spaces: 2 });

    const logger = await createRunLogger({
      cwd: tempDir,
      provider: "OpenAI",
      model: "gpt-5.3-codex",
      format: "text",
      runLogPath,
    });

    await runRalphLoop({
      provider: fakeProvider(true),
      model: "gpt-5.3-codex",
      thinkingValue: "high",
      planPath,
      plan,
      maxIterations: 1,
      workingDir: tempDir,
      timeoutMs: 2000,
      dryRun: false,
      autoCommit: false,
      sessionStrategy: "reset",
      runLogger: logger,
    });

    const lines = (await fs.readFile(runLogPath, "utf8"))
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { event: string });

    expect(lines.some((line) => line.event === "iteration_started")).toBe(true);
    expect(lines.some((line) => line.event === "step_done")).toBe(true);
  });
});
