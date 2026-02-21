import os from "node:os";
import path from "node:path";

import fs from "fs-extra";
import { describe, expect, it, vi } from "vitest";

import { cleanupRunLogDirectory, createRunLogger } from "../src/lib/run-log.js";

describe("run logger", () => {
  it("writes valid jsonl events with required fields and trace correlation IDs", async () => {
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
    await logger.log({
      event: "step_done",
      stepId: "step-01",
      stepTitle: "Do work",
    });

    const lines = (await fs.readFile(runLogPath, "utf8"))
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) =>
        JSON.parse(line) as {
          event: string;
          timestamp: string;
          provider: string;
          model: string;
          trace_id: string;
          group_id: string;
          span_id: string;
        },
      );

    expect(lines).toHaveLength(3);
    expect(lines[0].event).toBe("run_started");
    expect(lines[0].timestamp).toBeTruthy();
    expect(lines[0].provider).toBe("OpenAI");
    expect(lines[0].model).toBe("gpt-5.3-codex");
    expect(lines[0].trace_id).toMatch(/^[a-f0-9]{32}$/);
    expect(lines[0].group_id).toBe("run");
    expect(lines[0].span_id).toMatch(/^[a-f0-9]{16}$/);
    expect(lines[1].event).toBe("run_finished");
    expect(lines[1].trace_id).toBe(lines[0].trace_id);
    expect(lines[1].span_id).not.toBe(lines[0].span_id);
    expect(lines[2].event).toBe("step_done");
    expect(lines[2].group_id).toBe("step:step-01");
  });

  it("exports OTLP logs when enabled without affecting file logging", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ralph-runlog-otel-"));
    const runLogPath = path.join(tempDir, "events.jsonl");
    const oldEnv = {
      RALPH_OTEL_EXPORT: process.env.RALPH_OTEL_EXPORT,
      RALPH_OTEL_ENDPOINT: process.env.RALPH_OTEL_ENDPOINT,
      RALPH_OTEL_SERVICE_NAME: process.env.RALPH_OTEL_SERVICE_NAME,
      OTEL_EXPORTER_OTLP_HEADERS: process.env.OTEL_EXPORTER_OTLP_HEADERS,
    };

    process.env.RALPH_OTEL_EXPORT = "1";
    process.env.RALPH_OTEL_ENDPOINT = "https://otel.example/v1/logs";
    process.env.RALPH_OTEL_SERVICE_NAME = "direct-ralph-test";
    process.env.OTEL_EXPORTER_OTLP_HEADERS = "authorization=Bearer token";

    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 })) as unknown as typeof fetch;
    const oldFetch = globalThis.fetch;
    vi.stubGlobal("fetch", fetchMock);

    try {
      const logger = await createRunLogger({
        cwd: tempDir,
        provider: "OpenAI",
        model: "gpt-5.3-codex",
        format: "text",
        runLogPath,
      });

      await logger.log({
        event: "run_started",
        maxIterations: 2,
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [endpoint, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(endpoint).toBe("https://otel.example/v1/logs");
      expect(init.method).toBe("POST");
      expect((init.headers as Record<string, string>)["authorization"]).toBe("Bearer token");
      const body = JSON.parse(String(init.body));
      const bodyEvent = JSON.parse(
        body.resourceLogs[0].scopeLogs[0].logRecords[0].body.stringValue,
      ) as { event: string; trace_id: string; span_id: string };
      expect(bodyEvent.event).toBe("run_started");
      expect(bodyEvent.trace_id).toMatch(/^[a-f0-9]{32}$/);
      expect(bodyEvent.span_id).toMatch(/^[a-f0-9]{16}$/);

      const lines = (await fs.readFile(runLogPath, "utf8"))
        .trim()
        .split("\n")
        .filter(Boolean);
      expect(lines).toHaveLength(1);
    } finally {
      if (oldFetch) {
        vi.stubGlobal("fetch", oldFetch);
      } else {
        vi.unstubAllGlobals();
      }
      process.env.RALPH_OTEL_EXPORT = oldEnv.RALPH_OTEL_EXPORT;
      process.env.RALPH_OTEL_ENDPOINT = oldEnv.RALPH_OTEL_ENDPOINT;
      process.env.RALPH_OTEL_SERVICE_NAME = oldEnv.RALPH_OTEL_SERVICE_NAME;
      process.env.OTEL_EXPORTER_OTLP_HEADERS = oldEnv.OTEL_EXPORTER_OTLP_HEADERS;
    }
  });

  it("redacts obvious secrets from details and preview fields", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ralph-runlog-redact-"));
    const runLogPath = path.join(tempDir, "events.jsonl");
    const logger = await createRunLogger({
      cwd: tempDir,
      provider: "OpenAI",
      model: "gpt-5.3-codex",
      format: "text",
      runLogPath,
      redactSecrets: true,
    });

    await logger.log({
      event: "provider_event",
      preview: "Bearer sk-proj-abcdefghijklmnopqrstuvwx1234567890",
      details: "api_key=AIzaSyD-pretend-secret-value-1234567890",
    });

    const [line] = (await fs.readFile(runLogPath, "utf8")).trim().split("\n");
    const payload = JSON.parse(line) as { preview?: string; details?: string };
    expect(payload.preview).toContain("Bearer [REDACTED]");
    expect(payload.preview).not.toContain("sk-proj-");
    expect(payload.details).toContain("api_key=[REDACTED]");
    expect(payload.details).not.toContain("AIza");
  });

  it("removes only expired log files during retention cleanup", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ralph-runlog-retention-"));
    const oldFile = path.join(tempDir, "old.jsonl");
    const freshFile = path.join(tempDir, "fresh.jsonl");
    await fs.writeFile(oldFile, "old\n", "utf8");
    await fs.writeFile(freshFile, "fresh\n", "utf8");

    const now = Date.now();
    const oldDate = new Date(now - 20 * 24 * 60 * 60 * 1000);
    const freshDate = new Date(now - 2 * 24 * 60 * 60 * 1000);
    await fs.utimes(oldFile, oldDate, oldDate);
    await fs.utimes(freshFile, freshDate, freshDate);

    const deleted = await cleanupRunLogDirectory({
      directoryPath: tempDir,
      retentionDays: 14,
      nowMs: now,
    });

    expect(deleted).toBe(1);
    expect(await fs.pathExists(oldFile)).toBe(false);
    expect(await fs.pathExists(freshFile)).toBe(true);
  });
});
