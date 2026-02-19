import os from "node:os";
import path from "node:path";

import fs from "fs-extra";
import { describe, expect, it } from "vitest";

import { createRunLogger } from "../src/lib/run-log.js";

describe("run logger", () => {
  it("writes valid jsonl events with required fields", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ralph-runlog-"));
    const runLogPath = path.join(tempDir, "events.jsonl");

    const logger = await createRunLogger({
      cwd: tempDir,
      provider: "OpenAI",
      model: "gpt-5.3-codex",
      format: "text",
      runLogPath,
    });

    await logger.log({
      event: "run_started",
      maxIterations: 5,
      details: "test",
    });
    await logger.log({
      event: "run_finished",
      details: "status=success",
    });

    const lines = (await fs.readFile(runLogPath, "utf8"))
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { event: string; timestamp: string; provider: string; model: string });

    expect(lines).toHaveLength(2);
    expect(lines[0].event).toBe("run_started");
    expect(lines[0].timestamp).toBeTruthy();
    expect(lines[0].provider).toBe("OpenAI");
    expect(lines[0].model).toBe("gpt-5.3-codex");
    expect(lines[1].event).toBe("run_finished");
  });
});
