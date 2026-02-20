import { beforeEach, describe, expect, it, vi, type MockedFunction } from "vitest";

import type { ProviderAdapter } from "../src/providers/types.js";

vi.mock("../src/lib/process.js", () => ({
  runCommand: vi.fn(),
}));

import { runCommand } from "../src/lib/process.js";
import { probeProviderCapabilities } from "../src/providers/capabilities.js";

function provider(id: ProviderAdapter["id"]): ProviderAdapter {
  return {
    id,
    name: id.toUpperCase(),
    cliCommand: id === "openai" ? "codex" : id === "anthropic" ? "claude" : "gemini",
    models: [],
    thinkingOptions: [],
    defaultModel: "test-model",
    defaultThinking: "high",
    supportsResume: true,
    supportsOutputSchemaPath: id === "openai",
    supportsJsonSchema: id === "anthropic",
    supportsStreamJson: true,
    isInstalled: async () => true,
    buildCommand: () => ({ command: "noop", args: [] }),
    execute: async () => ({
      ok: true,
      exitCode: 0,
      timedOut: false,
      stdout: "",
      stderr: "",
      responseText: "",
      finalText: "",
      events: [],
      usedModel: "test-model",
      command: { command: "noop", args: [] },
      rawOutput: { stdout: "", stderr: "" },
    }),
  };
}

describe("provider capability probe", () => {
  const mockRunCommand = runCommand as MockedFunction<typeof runCommand>;

  beforeEach(() => {
    mockRunCommand.mockReset();
  });

  it("detects openai output schema and resume capabilities", async () => {
    mockRunCommand
      .mockResolvedValueOnce({
        exitCode: 0,
        timedOut: false,
        stdout: "codex exec --json --output-schema --dangerously-bypass-approvals-and-sandbox",
        stderr: "",
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        timedOut: false,
        stdout: "codex exec resume <session-id>",
        stderr: "",
      });

    const result = await probeProviderCapabilities({
      provider: provider("openai"),
      cwd: process.cwd(),
      strict: false,
    });

    expect(result.fatalMissing).toEqual([]);
    expect(result.supportsOutputSchemaPath).toBe(true);
    expect(result.supportsResume).toBe(true);
    expect(result.supportsStreamOutput).toBe(true);
  });

  it("fails in strict mode when required capabilities are missing", async () => {
    mockRunCommand.mockResolvedValue({
      exitCode: 0,
      timedOut: false,
      stdout: "claude --help",
      stderr: "",
    });

    await expect(
      probeProviderCapabilities({
        provider: provider("anthropic"),
        cwd: process.cwd(),
        strict: true,
      }),
    ).rejects.toThrow("capability probe failed");
  });

  it("falls back to adapter defaults when help output is unavailable", async () => {
    mockRunCommand.mockResolvedValue({
      exitCode: null,
      timedOut: true,
      stdout: "",
      stderr: "",
    });

    const result = await probeProviderCapabilities({
      provider: provider("google"),
      cwd: process.cwd(),
      strict: false,
    });

    expect(result.fatalMissing).toEqual([]);
    expect(result.supportsResume).toBe(true);
    expect(result.supportsStreamOutput).toBe(true);
    expect(result.warnings.some((warning) => warning.includes("help output unavailable"))).toBe(true);
  });
});
