import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { printIterationHeader, printIterationResult } from "../src/ui/progress.js";

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
});
