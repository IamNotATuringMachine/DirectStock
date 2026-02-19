import { describe, expect, it } from "vitest";

import { parseClaudeResponse, anthropicAdapter } from "../src/providers/anthropic.js";
import { parseGeminiResponse, googleAdapter } from "../src/providers/google.js";
import { parseCodexResponse, openaiAdapter } from "../src/providers/openai.js";

describe("provider adapters", () => {
  it("builds codex command with schema + resume support", () => {
    const command = openaiAdapter.buildCommand({
      model: "gpt-5.3-codex",
      thinkingValue: "xhigh",
      prompt: "hello",
      cwd: process.cwd(),
      timeoutMs: 1000,
      sessionStrategy: "resume",
      resumeSessionId: "session-123",
      outputSchemaPath: "/tmp/schema.json",
    });

    expect(command.command).toBe("codex");
    expect(command.args.slice(0, 3)).toEqual(["exec", "resume", "session-123"]);
    expect(command.args).toContain("--output-schema");
    expect(command.args).toContain("/tmp/schema.json");
    expect(command.args).toContain("--json");
  });

  it("normalizes invalid codex reasoning effort to medium", () => {
    const command = openaiAdapter.buildCommand({
      model: "gpt-5.3-codex",
      thinkingValue: "low",
      prompt: "hello",
      cwd: process.cwd(),
      timeoutMs: 1000,
    });

    const configIndex = command.args.findIndex((arg) => arg === "-c");
    expect(configIndex).toBeGreaterThan(-1);
    expect(command.args[configIndex + 1]).toContain('model_reasoning_effort="medium"');
  });

  it("builds claude command with json schema + resume", () => {
    const command = anthropicAdapter.buildCommand({
      model: "claude-sonnet-4-6-20250217",
      thinkingValue: "25",
      prompt: "hello",
      cwd: process.cwd(),
      timeoutMs: 1000,
      sessionStrategy: "resume",
      resumeSessionId: "abc",
      outputSchema: { type: "object" },
    });

    expect(command.command).toBe("claude");
    expect(command.args).toContain("--resume");
    expect(command.args).toContain("abc");
    expect(command.args).toContain("--json-schema");
  });

  it("builds gemini command with resume", () => {
    const command = googleAdapter.buildCommand({
      model: "gemini-2.5-flash",
      thinkingValue: "high",
      prompt: "hello",
      cwd: process.cwd(),
      timeoutMs: 1000,
      sessionStrategy: "resume",
      resumeSessionId: "5",
    });

    expect(command.command).toBe("gemini");
    expect(command.args).toContain("--resume");
    expect(command.args).toContain("5");
  });

  it("includes gemini-3.1-pro-preview in fallback order", () => {
    const fallbacks = googleAdapter.fallbackModels?.("gemini-2.5-flash") ?? [];
    expect(fallbacks).toContain("gemini-3.1-pro-preview");
  });

  it("parses codex jsonl agent message + session", () => {
    const output = [
      '{"type":"thread.started","thread_id":"thread-1"}',
      '{"type":"item.completed","item":{"type":"agent_message","text":"OK"}}',
      '{"type":"turn.completed"}',
    ].join("\n");

    expect(parseCodexResponse(output)).toEqual({ text: "OK", sessionId: "thread-1" });
  });

  it("parses claude json response + session", () => {
    const output = '{"type":"result","result":"done","session_id":"sess"}';
    expect(parseClaudeResponse(output)).toEqual({ text: "done", sessionId: "sess" });
  });

  it("parses gemini json response + session", () => {
    const output = '{"session_id":"x","response":"done"}';
    expect(parseGeminiResponse(output)).toEqual({ text: "done", sessionId: "x" });
  });
});
