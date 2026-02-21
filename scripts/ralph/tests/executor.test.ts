import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";

import fs from "fs-extra";
import { describe, expect, it } from "vitest";

import { createRunLogger } from "../src/lib/run-log.js";
import { buildIterationPrompt, isThinkingUnsupportedError, runRalphLoop } from "../src/loop/executor.js";
import type { Plan } from "../src/planner/plan-schema.js";
import type { ProviderAdapter, ProviderExecutionInput } from "../src/providers/types.js";
import { vi } from "vitest";

vi.mock("../src/lib/process.js", async (importOriginal) => {
  const mod = await importOriginal<any>();
  return {
    ...mod,
    sleep: vi.fn().mockResolvedValue(undefined),
  };
});

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
    supportsStreamJson: true,
    isInstalled: async () => true,
    buildCommand: () => ({ command: "codex", args: ["exec"] }),
    execute: async (input) => ({
      ok,
      exitCode: ok ? 0 : 1,
      timedOut: false,
      stdout: "",
      stderr: ok ? "" : "error",
      responseText: ok ? "ok" : "",
      finalText: ok ? "ok" : "",
      events: ok
        ? [
          {
            type: "assistant_text",
            provider: "openai",
            timestamp: new Date().toISOString(),
            attempt: input.attempt ?? 1,
            payload: { text: "ok" },
          },
        ]
        : [],
      usedModel: input.model,
      command: { command: "codex", args: ["exec"] },
      sessionId: input.resumeSessionId ?? "session-1",
      rawOutput: { stdout: "", stderr: ok ? "" : "error" },
    }),
  };
}

describe("executor", () => {
  it("builds an iteration prompt with key sections", () => {
    const plan = samplePlan();
    const step = plan.steps[0];
    const prompt = buildIterationPrompt(plan, step, "git state", undefined, [
      "AGENTS.md",
      "CODEX.md",
    ]);

    expect(prompt).toContain("Current Task");
    expect(prompt).toContain(step.title);
    expect(prompt).toContain(step.successCriteria);
    expect(prompt).toContain("Context Files (Read First)");
    expect(prompt).toContain("AGENTS.md");
    expect(prompt).toContain("CODEX.md");
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
      providerStreamingEnabled: true,
      outputMode: "timeline",
      thinkingVisibility: "summary",
    });

    expect(summary.completedSteps).toBe(1);
    expect(plan.steps[0].status).toBe("done");
    expect(summary.analytics.providerAttempts).toBe(1);
    expect(summary.analytics.providerRetries).toBe(0);
    expect(summary.analytics.providerEvents.assistant_text).toBe(1);
    expect(summary.analytics.providerEvents.error).toBe(0);
    expect(summary.analytics.successCriteria.passed).toBe(1);
    expect(summary.analytics.successCriteria.failed).toBe(0);
    expect(summary.analytics.stepPostChecks.commandsRun).toBe(0);
  });

  it("allows no-op completion when baseline already passes", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ralph-exec-noop-allowed-"));
    const planPath = path.join(tempDir, "plan.json");
    const plan = samplePlan("true");
    plan.steps[0].files = ["frontend/src/pages/DashboardPage.tsx"];
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
      providerStreamingEnabled: true,
      outputMode: "timeline",
      thinkingVisibility: "summary",
    });

    expect(summary.completedSteps).toBe(1);
    expect(plan.steps[0].status).toBe("done");
    expect(plan.steps[0].attempts).toBe(0);
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
      providerStreamingEnabled: true,
      outputMode: "timeline",
      thinkingVisibility: "summary",
    });

    expect(summary.failedSteps).toBe(1);
    expect(plan.steps[0].status).toBe("failed");
    expect(plan.steps[0].attempts).toBe(1);
    expect(summary.analytics.successCriteria.failed).toBe(1);
  });

  it("interprets narrative success criteria via provider output and events", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ralph-exec-narrative-pass-"));
    const planPath = path.join(tempDir, "plan.json");
    const narrativeCriteria = `ralph_missing_cmd_${Date.now()} lengthy sentence produced and tool call triggered`;
    const plan = samplePlan(narrativeCriteria, 1);
    await fs.writeJson(planPath, plan, { spaces: 2 });

    const longText =
      "Black-hole geodesics in Schwarzschild spacetime force infalling trajectories to satisfy highly nonlinear curvature constraints while tidal tensors scale rapidly near the horizon, yielding extended analytical statements that remain mathematically dense and physically explicit.";
    const provider: ProviderAdapter = {
      ...fakeProvider(true),
      execute: async (input) => ({
        ok: true,
        exitCode: 0,
        timedOut: false,
        stdout: "",
        stderr: "",
        responseText: longText,
        finalText: longText,
        events: [
          {
            type: "assistant_text",
            provider: "openai",
            timestamp: new Date().toISOString(),
            attempt: input.attempt ?? 1,
            payload: { text: longText },
          },
          {
            type: "tool_call",
            provider: "openai",
            timestamp: new Date().toISOString(),
            attempt: input.attempt ?? 1,
            payload: { name: "write_file", command: "write blackhole.txt" },
          },
        ],
        usedModel: input.model,
        command: { command: "codex", args: ["exec"] },
        rawOutput: { stdout: "", stderr: "" },
      }),
    };

    const summary = await runRalphLoop({
      provider,
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
      providerStreamingEnabled: true,
      outputMode: "timeline",
      thinkingVisibility: "summary",
    });

    expect(summary.completedSteps).toBe(1);
    expect(plan.steps[0].status).toBe("done");
    expect(summary.analytics.successCriteria.passed).toBe(1);
  });

  it("fails narrative success criteria when required tool call is missing", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ralph-exec-narrative-fail-"));
    const planPath = path.join(tempDir, "plan.json");
    const narrativeCriteria = `ralph_missing_cmd_${Date.now()} lengthy sentence produced and tool call triggered`;
    const plan = samplePlan(narrativeCriteria, 1);
    await fs.writeJson(planPath, plan, { spaces: 2 });

    const longText =
      "Tensorial perturbation terms around compact horizons can be expressed with coupled equations whose asymptotic behavior remains long-form, mathematically detailed, and physically interpretable across multiple coordinate charts.";
    const provider: ProviderAdapter = {
      ...fakeProvider(true),
      execute: async (input) => ({
        ok: true,
        exitCode: 0,
        timedOut: false,
        stdout: "",
        stderr: "",
        responseText: longText,
        finalText: longText,
        events: [
          {
            type: "assistant_text",
            provider: "openai",
            timestamp: new Date().toISOString(),
            attempt: input.attempt ?? 1,
            payload: { text: longText },
          },
        ],
        usedModel: input.model,
        command: { command: "codex", args: ["exec"] },
        rawOutput: { stdout: "", stderr: "" },
      }),
    };

    const summary = await runRalphLoop({
      provider,
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
      providerStreamingEnabled: true,
      outputMode: "timeline",
      thinkingVisibility: "summary",
    });

    expect(summary.failedSteps).toBe(1);
    expect(plan.steps[0].status).toBe("failed");
    expect(plan.steps[0].lastError).toContain("FAIL tool call observed");
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
          finalText: "",
          events: [],
          usedModel: input.model,
          command: { command: "codex", args: ["exec"] },
          sessionId: input.resumeSessionId,
          rawOutput: { stdout: "", stderr: "Unknown model: gemini-3-pro-preview" },
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
      providerStreamingEnabled: true,
      outputMode: "timeline",
      thinkingVisibility: "summary",
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
      providerStreamingEnabled: true,
      outputMode: "timeline",
      thinkingVisibility: "summary",
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
          finalText: "ok",
          events: [],
          usedModel: input.model,
          command: { command: "codex", args: ["exec"] },
          sessionId: calls.length === 1 ? "session-alpha" : "session-beta",
          rawOutput: { stdout: "", stderr: "" },
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
      providerStreamingEnabled: true,
      outputMode: "timeline",
      thinkingVisibility: "summary",
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
      providerStreamingEnabled: true,
      outputMode: "timeline",
      thinkingVisibility: "summary",
    });

    expect(summary.failedSteps).toBe(1);
    expect(plan.steps[0].status).toBe("failed");
    expect(plan.steps[0].lastError).toContain("$ false");
    expect(summary.analytics.stepPostChecks.commandsRun).toBe(1);
    expect(summary.analytics.stepPostChecks.failed).toBe(1);
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
      providerStreamingEnabled: true,
      outputMode: "timeline",
      thinkingVisibility: "summary",
      runLogger: logger,
    });

    const lines = (await fs.readFile(runLogPath, "utf8"))
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { event: string });

    expect(lines.some((line) => line.event === "iteration_started")).toBe(true);
    expect(lines.some((line) => line.event === "provider_event")).toBe(true);
    expect(lines.some((line) => line.event === "step_done")).toBe(true);
  });

  it("logs streamed provider events once without duplicates", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ralph-exec-streamed-events-"));
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

    const eventA = {
      type: "tool_call" as const,
      provider: "openai",
      timestamp: new Date().toISOString(),
      attempt: 1,
      payload: { name: "ReadLive", command: "cat a.ts" },
    };
    const eventB = {
      type: "assistant_text" as const,
      provider: "openai",
      timestamp: new Date().toISOString(),
      attempt: 1,
      payload: { text: "streamed reply" },
    };

    const provider: ProviderAdapter = {
      ...fakeProvider(true),
      execute: async (input) => {
        input.onEvent?.(eventA);
        input.onEvent?.(eventB);
        return {
          ok: true,
          exitCode: 0,
          timedOut: false,
          stdout: "",
          stderr: "",
          responseText: "ok",
          finalText: "ok",
          events: [eventA, eventB],
          usedModel: input.model,
          command: { command: "codex", args: ["exec"] },
          sessionId: "session-live",
          rawOutput: { stdout: "", stderr: "" },
        };
      },
    };

    await runRalphLoop({
      provider,
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
      providerStreamingEnabled: true,
      outputMode: "timeline",
      liveProviderEvents: true,
      thinkingVisibility: "summary",
      runLogger: logger,
    });

    const providerEvents = (await fs.readFile(runLogPath, "utf8"))
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { event: string; providerEventType?: string; preview?: string })
      .filter((line) => line.event === "provider_event");

    expect(providerEvents).toHaveLength(2);
    expect(providerEvents.some((line) => line.providerEventType === "tool_call")).toBe(true);
    expect(providerEvents.some((line) => line.providerEventType === "assistant_text")).toBe(true);
  });

  it("prints live tool events before provider attempt completion", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ralph-exec-live-print-order-"));
    const planPath = path.join(tempDir, "plan.json");
    const plan = samplePlan("true");
    await fs.writeJson(planPath, plan, { spaces: 2 });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => { });
    const previousNoSpinner = process.env.RALPH_NO_SPINNER;
    process.env.RALPH_NO_SPINNER = "1";

    const toolEvent = {
      type: "tool_call" as const,
      provider: "openai",
      timestamp: new Date().toISOString(),
      attempt: 1,
      payload: { name: "ReadLive", command: "cat z.ts" },
    };
    const provider: ProviderAdapter = {
      ...fakeProvider(true),
      execute: async (input) => {
        input.onEvent?.(toolEvent);
        return {
          ok: true,
          exitCode: 0,
          timedOut: false,
          stdout: "",
          stderr: "",
          responseText: "ok",
          finalText: "ok",
          events: [toolEvent],
          usedModel: input.model,
          command: { command: "codex", args: ["exec"] },
          sessionId: "session-live-print",
          rawOutput: { stdout: "", stderr: "" },
        };
      },
    };

    try {
      await runRalphLoop({
        provider,
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
        providerStreamingEnabled: true,
        outputMode: "timeline",
        liveProviderEvents: true,
        thinkingVisibility: "summary",
      });
    } finally {
      if (previousNoSpinner === undefined) {
        delete process.env.RALPH_NO_SPINNER;
      } else {
        process.env.RALPH_NO_SPINNER = previousNoSpinner;
      }
    }

    const lines = logSpy.mock.calls.map((call) => String(call[0]));
    logSpy.mockRestore();
    const liveToolIndex = lines.findIndex((line) => line.includes("ReadLive"));
    const attemptDoneIndex = lines.findIndex((line) => line.includes("state=ok"));

    expect(liveToolIndex).toBeGreaterThanOrEqual(0);
    expect(attemptDoneIndex).toBeGreaterThanOrEqual(0);
    expect(liveToolIndex).toBeLessThan(attemptDoneIndex);
  });

  it("compacts provider failure details in timeline mode", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ralph-exec-compact-fail-"));
    const planPath = path.join(tempDir, "plan.json");
    const plan = samplePlan("true", 1);
    await fs.writeJson(planPath, plan, { spaces: 2 });

    const noisy = "x".repeat(5000);
    const provider: ProviderAdapter = {
      ...fakeProvider(false),
      execute: async (input) => ({
        ok: false,
        exitCode: 1,
        timedOut: false,
        stdout: noisy,
        stderr: noisy,
        responseText: noisy,
        finalText: noisy,
        events: [
          {
            type: "error",
            provider: "openai",
            timestamp: new Date().toISOString(),
            attempt: input.attempt ?? 1,
            payload: { error: noisy },
          },
        ],
        usedModel: input.model,
        command: { command: "codex", args: ["exec"] },
        sessionId: "session-compact",
        rawOutput: { stdout: noisy, stderr: noisy },
      }),
    };

    await runRalphLoop({
      provider,
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
      providerStreamingEnabled: true,
      outputMode: "timeline",
      thinkingVisibility: "summary",
    });

    expect(plan.steps[0].status).toBe("failed");
    expect((plan.steps[0].lastError ?? "").length).toBeLessThanOrEqual(1800);
  });

  it("treats in_progress steps as runnable (cancel-resume bug fix)", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ralph-exec-inprogress-"));
    const planPath = path.join(tempDir, "plan.json");
    const plan = samplePlan("true");
    plan.steps[0].status = "in_progress";
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
      providerStreamingEnabled: true,
      outputMode: "timeline",
      thinkingVisibility: "summary",
    });

    expect(summary.completedSteps).toBe(1);
    expect(plan.steps[0].status).toBe("done");
  });

  it("does not skip in_progress step when a second pending step exists", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ralph-exec-noskip-"));
    const planPath = path.join(tempDir, "plan.json");
    const plan = samplePlan("true");
    plan.steps[0].status = "in_progress";
    plan.steps.push({
      ...plan.steps[0],
      id: "step-02",
      title: "Second step",
      status: "pending",
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
          finalText: "ok",
          events: [],
          usedModel: input.model,
          command: { command: "codex", args: ["exec"] },
          rawOutput: { stdout: "", stderr: "" },
        };
      },
    };

    await runRalphLoop({
      provider,
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
      providerStreamingEnabled: true,
      outputMode: "timeline",
      thinkingVisibility: "summary",
    });

    // Must pick step-01 (in_progress) first, not skip to step-02
    expect(plan.steps[0].status).toBe("done");
    expect(plan.steps[1].status).toBe("pending");
  });

  it("caches pre-flight baseline checks on unchanged fingerprint", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ralph-exec-cache-preflight-"));
    const planPath = path.join(tempDir, "plan.json");
    const counterPath = path.join(tempDir, "preflight.count");
    const criteria = `n=$(cat '${counterPath}' 2>/dev/null || echo 0); n=$((n+1)); echo $n > '${counterPath}'; exit 1`;
    const plan = samplePlan(criteria, 4);
    await fs.writeJson(planPath, plan, { spaces: 2 });

    const summary = await runRalphLoop({
      provider: fakeProvider(false),
      model: "gpt-5.3-codex",
      thinkingValue: "high",
      planPath,
      plan,
      maxIterations: 2,
      workingDir: tempDir,
      timeoutMs: 2000,
      dryRun: false,
      autoCommit: false,
      sessionStrategy: "reset",
      providerStreamingEnabled: true,
      outputMode: "timeline",
      thinkingVisibility: "summary",
      efficiencyMode: "balanced",
    });

    expect((await fs.readFile(counterPath, "utf8")).trim()).toBe("1");
    expect(summary.analytics.cache.cache_hits_preflight).toBe(1);
    expect(summary.analytics.cache.cache_misses_preflight).toBe(1);
    expect(summary.analytics.cache.gitstate_cache_hits).toBe(1);
  });

  it("invalidates pre-flight cache when worktree hash changes", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ralph-exec-cache-invalidate-"));
    const planPath = path.join(tempDir, "plan.json");
    const counterPath = path.join(tempDir, "preflight.count");
    const trackedPath = path.join(tempDir, "tracked.txt");
    await fs.writeFile(trackedPath, "initial\n", "utf8");
    execSync("git init", { cwd: tempDir, stdio: "ignore" });
    execSync("git config user.email test@example.com", { cwd: tempDir, stdio: "ignore" });
    execSync("git config user.name 'Ralph Test'", { cwd: tempDir, stdio: "ignore" });
    execSync("git add tracked.txt", { cwd: tempDir, stdio: "ignore" });
    execSync("git commit -m 'init'", { cwd: tempDir, stdio: "ignore" });

    const criteria = `n=$(cat '${counterPath}' 2>/dev/null || echo 0); n=$((n+1)); echo $n > '${counterPath}'; echo $n > '${trackedPath}'; exit 1`;
    const plan = samplePlan(criteria, 4);
    await fs.writeJson(planPath, plan, { spaces: 2 });

    const summary = await runRalphLoop({
      provider: fakeProvider(false),
      model: "gpt-5.3-codex",
      thinkingValue: "high",
      planPath,
      plan,
      maxIterations: 2,
      workingDir: tempDir,
      timeoutMs: 2000,
      dryRun: false,
      autoCommit: false,
      sessionStrategy: "reset",
      providerStreamingEnabled: true,
      outputMode: "timeline",
      thinkingVisibility: "summary",
      efficiencyMode: "balanced",
    });

    expect((await fs.readFile(counterPath, "utf8")).trim()).toBe("2");
    expect(summary.analytics.cache.cache_hits_preflight).toBe(0);
    expect(summary.analytics.cache.cache_misses_preflight).toBe(2);
  });

  it("detects thinking-unsupported errors", () => {
    const cases = [
      { stderr: "Error: unsupported thinking budget for this model", expected: true },
      { stderr: "invalid reasoning_effort option", expected: true },
      { stderr: "unrecognized option --thinking-budget", expected: true },
      { stderr: "max-turns: invalid value", expected: true },
      { stderr: "thinking is not supported for this model", expected: true },
      { stderr: "model not available", expected: false },
      { stderr: "429 rate limit", expected: false },
      { stderr: "generic error", expected: false },
    ];

    for (const { stderr, expected } of cases) {
      const result = {
        ok: false,
        exitCode: 1,
        timedOut: false,
        stdout: "",
        stderr,
        responseText: "",
        finalText: "",
        events: [],
        usedModel: "test",
        command: { command: "test", args: [] },
        rawOutput: { stdout: "", stderr },
      };
    }
  });

  it("retries indefinitely on transient 503 errors (more than 3 times)", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ralph-exec-infinite-retry-"));
    const planPath = path.join(tempDir, "plan.json");
    const plan = samplePlan("true", 3);
    await fs.writeJson(planPath, plan, { spaces: 2 });

    let calls = 0;
    const provider: ProviderAdapter = {
      ...fakeProvider(true),
      execute: async (input) => {
        calls++;
        if (calls <= 5) {
          return {
            ok: false,
            exitCode: 1,
            timedOut: false,
            stdout: "",
            stderr: "503 Service Unavailable (High Demand)",
            responseText: "",
            finalText: "",
            events: [],
            usedModel: input.model,
            command: { command: "codex", args: [] },
            rawOutput: { stdout: "", stderr: "503" },
          };
        }
        return {
          ok: true,
          exitCode: 0,
          timedOut: false,
          stdout: "success",
          stderr: "",
          responseText: "ok",
          finalText: "ok",
          events: [],
          usedModel: input.model,
          command: { command: "codex", args: [] },
          rawOutput: { stdout: "success", stderr: "" },
        };
      },
    };

    const summary = await runRalphLoop({
      provider,
      model: "gpt-5.3-codex",
      thinkingValue: "high",
      planPath,
      plan,
      maxIterations: 1,
      workingDir: tempDir,
      timeoutMs: 1000,
      dryRun: false,
      autoCommit: false,
      sessionStrategy: "reset",
      providerStreamingEnabled: true,
      outputMode: "timeline",
      thinkingVisibility: "summary",
    });

    expect(summary.completedSteps).toBe(1);
    expect(plan.steps[0].status).toBe("done");
    expect(calls).toBe(6); // 5 fails + 1 success
  });
});
