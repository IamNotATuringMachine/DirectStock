import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import {
  printIterationHeader,
  printIterationResult,
  printProviderAttemptDone,
  printProviderEventLive,
  printProviderHeartbeat,
  printProviderOutput,
  printRetryScheduled,
} from "../src/ui/progress.js";

import type { Step } from "../src/planner/plan-schema.js";

const step: Step = {
  id: "step-01",
  title: "Title",
  description: "Description",
  successCriteria: "true",
  status: "pending",
  attempts: 0,
  maxAttempts: 3,
  type: "code",
  files: [],
  riskLevel: "medium",
  owner: "agent",
  postChecks: [],
  rollbackHint: "git revert",
};

describe("progress output", () => {
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => { });

  afterEach(() => {
    logSpy.mockClear();
  });

  afterAll(() => {
    logSpy.mockRestore();
  });

  it("prints iteration header with box-drawn frame and session info", () => {
    printIterationHeader({
      iteration: 1,
      maxIterations: 10,
      step: { ...step },
      sessionStrategy: "resume",
      resumeSessionId: "sess-123",
    });

    const output = logSpy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(output).toContain("Iteration 1/10");
    expect(output).toContain("╭");
    expect(output).toContain("╰");
    expect(output).toContain("resume (sess-123)");
  });

  it("prints failure classification for timeout", () => {
    printIterationResult({
      step: { ...step },
      passed: false,
      attempts: 1,
      maxAttempts: 3,
      durationMs: 42,
      info: "request timeout after 30s",
    });

    const output = logSpy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(output).toContain("FAIL");
    expect(output).toContain("timeout");
  });

  it("prints provider heartbeat with thinking icon", () => {
    printProviderHeartbeat({
      step: { ...step },
      model: "gemini-3-flash-preview",
      attempt: 1,
      elapsedMs: 15_000,
      timeoutMs: 20 * 60 * 1000,
    });

    const output = logSpy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(output).toContain("💭");
    expect(output).toContain("15s");
  });

  it("prints provider heartbeat with live tool counters", () => {
    printProviderHeartbeat({
      step: { ...step },
      model: "gemini-3-flash-preview",
      attempt: 1,
      elapsedMs: 12_000,
      timeoutMs: 20 * 60 * 1000,
      toolCallCount: 7,
      toolResultCount: 6,
    });

    const output = logSpy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(output).toContain("tools calls=7");
    expect(output).toContain("results=6");
  });

  it("prints retry reason for transient failures", () => {
    printRetryScheduled({
      step: { ...step },
      model: "gemini-3-flash-preview",
      attempt: 1,
      delayMs: 2_000,
      reason: "429 rate limit reached",
    });

    const output = logSpy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(output).toContain("Retry");
    expect(output).toContain("429 rate limit reached");
  });

  it("prints explicit model_unavailable state", () => {
    printProviderAttemptDone({
      step: { ...step },
      model: "gemini-3-pro-preview",
      attempt: 1,
      ok: false,
      timedOut: false,
      modelUnavailable: true,
      exitCode: 1,
      durationMs: 1200,
      sessionId: undefined,
    });

    const output = logSpy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(output).toContain("model_unavailable");
  });

  it("prints timeline output with tool call icons and final text", () => {
    printProviderOutput({
      step: { ...step },
      outputMode: "timeline",
      thinkingVisibility: "summary",
      events: [
        {
          type: "thinking",
          provider: "openai",
          timestamp: new Date().toISOString(),
          attempt: 1,
          payload: { summary: "plan built" },
        },
        {
          type: "tool_call",
          provider: "openai",
          timestamp: new Date().toISOString(),
          attempt: 1,
          payload: { name: "Read", command: "cat file.ts" },
        },
      ],
      finalText: "done",
      thinkingSummary: "plan built",
      rawOutput: { stdout: "", stderr: "" },
    });

    const output = logSpy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(output).toContain("💭");
    expect(output).toContain("⚡");
    expect(output).toContain("Read");
    expect(output).toContain("✓");
  });

  it("renders full thinking block when thinkingVisibility=full", () => {
    printProviderOutput({
      step: { ...step },
      outputMode: "timeline",
      thinkingVisibility: "full",
      events: [
        {
          type: "thinking",
          provider: "openai",
          timestamp: new Date().toISOString(),
          attempt: 1,
          payload: { text: "I am analyzing the codebase structure carefully" },
        },
      ],
      finalText: "",
      rawOutput: { stdout: "", stderr: "" },
    });

    const output = logSpy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(output).toContain("Thinking");
    expect(output).toContain("┌");
    expect(output).toContain("└");
    expect(output).toContain("analyzing");
  });

  it("prints error events with error icon", () => {
    printProviderOutput({
      step: { ...step },
      outputMode: "timeline",
      thinkingVisibility: "summary",
      events: [
        {
          type: "error",
          provider: "openai",
          timestamp: new Date().toISOString(),
          attempt: 1,
          payload: { error: "authentication failed" },
        },
      ],
      finalText: "",
      rawOutput: { stdout: "", stderr: "" },
    });

    const output = logSpy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(output).toContain("✗");
    expect(output).toContain("authentication failed");
  });

  it("classifies thinking_unsupported errors", () => {
    printIterationResult({
      step: { ...step },
      passed: false,
      attempts: 1,
      maxAttempts: 3,
      info: "unsupported thinking budget for this model",
    });

    const output = logSpy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(output).toContain("thinking_unsupported");
  });

  it("prints live tool event lines immediately", () => {
    const rendered = printProviderEventLive({
      thinkingVisibility: "summary",
      toolCallCount: 3,
      event: {
        type: "tool_call",
        provider: "openai",
        timestamp: new Date().toISOString(),
        attempt: 1,
        payload: { name: "ReadLive", command: "cat live.ts" },
      },
    });

    const output = logSpy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(rendered).toBe(true);
    expect(output).toContain("⚡");
    expect(output).toContain("ReadLive");
    expect(output).toContain("call #3");
  });

  it("filters noisy live status events", () => {
    const rendered = printProviderEventLive({
      thinkingVisibility: "summary",
      event: {
        type: "status",
        provider: "openai",
        timestamp: new Date().toISOString(),
        attempt: 1,
        payload: { status: "thread heartbeat line" },
      },
    });

    expect(rendered).toBe(false);
    expect(logSpy.mock.calls).toHaveLength(0);
  });

  it("does not drop tool events when timeline output is truncated", () => {
    const events = [
      ...Array.from({ length: 20 }, (_, index) => ({
        type: "assistant_text" as const,
        provider: "openai",
        timestamp: new Date().toISOString(),
        attempt: 1,
        payload: { text: `assistant ${index}` },
      })),
      {
        type: "tool_call" as const,
        provider: "openai",
        timestamp: new Date().toISOString(),
        attempt: 1,
        payload: { name: "ToolA", command: "cmd-a" },
      },
      {
        type: "tool_result" as const,
        provider: "openai",
        timestamp: new Date().toISOString(),
        attempt: 1,
        payload: { name: "ToolA", status: "ok" },
      },
      ...Array.from({ length: 20 }, (_, index) => ({
        type: "status" as const,
        provider: "openai",
        timestamp: new Date().toISOString(),
        attempt: 1,
        payload: { status: `status ${index}` },
      })),
      {
        type: "tool_call" as const,
        provider: "openai",
        timestamp: new Date().toISOString(),
        attempt: 1,
        payload: { name: "ToolB", command: "cmd-b" },
      },
    ];

    printProviderOutput({
      step: { ...step },
      outputMode: "timeline",
      thinkingVisibility: "summary",
      events,
      finalText: "",
      rawOutput: { stdout: "", stderr: "" },
    });

    const output = logSpy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(output).toContain("ToolA");
    expect(output).toContain("ToolB");
    expect(output).toContain("event(s) omitted");
  });
});
