import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import {
  printIterationHeader,
  printIterationResult,
  printProviderAttemptDone,
  printProviderHeartbeat,
  printRetryScheduled,
} from "../src/ui/progress.js";

const step = {
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
} as const;

describe("progress output", () => {
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

  afterEach(() => {
    logSpy.mockClear();
  });

  afterAll(() => {
    logSpy.mockRestore();
  });

  it("prints iteration header with session info", () => {
    printIterationHeader({
      iteration: 1,
      maxIterations: 10,
      step: { ...step },
      sessionStrategy: "resume",
      resumeSessionId: "sess-123",
    });

    const output = logSpy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(output).toContain("Iteration 1/10");
    expect(output).toContain("Session: resume (sess-123)");
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
    expect(output).toContain("class=timeout");
  });

  it("prints provider heartbeat state", () => {
    printProviderHeartbeat({
      step: { ...step },
      model: "gemini-3-flash-preview",
      attempt: 1,
      elapsedMs: 15_000,
      timeoutMs: 20 * 60 * 1000,
    });

    const output = logSpy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(output).toContain("provider:thinking");
    expect(output).toContain("elapsed=15s");
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
    expect(output).toContain("provider:retry");
    expect(output).toContain("reason=429 rate limit reached");
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
    expect(output).toContain("state=model_unavailable");
  });
});
