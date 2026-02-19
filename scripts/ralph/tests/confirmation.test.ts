import { describe, expect, it } from "vitest";

import { renderConfirmation } from "../src/ui/confirmation.js";

describe("confirmation output", () => {
  it("renders compact grouped summary with relative paths", () => {
    const output = renderConfirmation({
      provider: "Google",
      model: "gemini-3.1-pro-preview",
      thinking: "high",
      planPath: "/repo/project/ui_ux_plan.json",
      stepCount: 26,
      maxIterations: 26,
      workingDir: "/repo/project",
      dryRun: false,
      autoCommit: true,
      sessionStrategy: "reset",
      postCheckProfile: "fast",
      logFormat: "text",
      runLogPath: "/repo/project/.ralph/runs/20260219T172849Z.jsonl",
      strictProviderCapabilities: false,
    });

    expect(output).toContain("RALPH LOOP - Configuration");
    expect(output).toContain("Runtime");
    expect(output).toContain("Plan");
    expect(output).toContain("Exec");
    expect(output).toContain("Log");
    expect(output).toContain("ui_ux_plan.json / 26 steps / iter=26");
    expect(output).toContain(".ralph/runs/20260219T172849Z.jsonl");
    expect(output).toContain("session=reset / post-check=fast");
  });
});
