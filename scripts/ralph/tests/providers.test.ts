import { describe, expect, it } from "vitest";

import { anthropicAdapter, parseClaudeResponse } from "../src/providers/anthropic.js";
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
    expect(command.args).toContain("json");
  });

  it("builds claude stream-json command when schema is absent", () => {
    const command = anthropicAdapter.buildCommand({
      model: "claude-sonnet-4-6-20250217",
      thinkingValue: "25",
      prompt: "hello",
      cwd: process.cwd(),
      timeoutMs: 1000,
      sessionStrategy: "reset",
      streamingEnabled: true,
    });

    expect(command.args).toContain("stream-json");
    expect(command.args).toContain("--include-partial-messages");
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

  it("parses codex jsonl and emits normalized events", () => {
    const output = [
      '{"type":"thread.started","thread_id":"thread-1"}',
      '{"type":"item.completed","item":{"type":"reasoning","summary":"check files"}}',
      '{"type":"item.completed","item":{"type":"tool_call","name":"Read"}}',
      '{"type":"item.completed","item":{"type":"tool_result","name":"Read","status":"ok"}}',
      '{"type":"item.completed","item":{"type":"agent_message","text":"OK"}}',
      '{"type":"turn.completed"}',
    ].join("\n");

    const parsed = parseCodexResponse(output);
    expect(parsed.text).toBe("OK");
    expect(parsed.sessionId).toBe("thread-1");
    expect(parsed.events.some((event) => event.type === "thinking")).toBe(true);
    expect(parsed.events.some((event) => event.type === "tool_call")).toBe(true);
    expect(parsed.events.some((event) => event.type === "tool_result")).toBe(true);
    expect(parsed.events.some((event) => event.type === "assistant_text")).toBe(true);
  });

  it("parses codex error events and returns compact final error text", () => {
    const output = [
      '{"type":"thread.started","thread_id":"thread-1"}',
      '{"type":"error","message":"Reconnecting... 1/5 (unexpected status 401 Unauthorized: Missing bearer authentication in header)"}',
      '{"type":"turn.failed","error":{"message":"unexpected status 401 Unauthorized"}}',
    ].join("\n");
    const parsed = parseCodexResponse(output);
    expect(parsed.events.some((event) => event.type === "error")).toBe(true);
    expect(parsed.text.toLowerCase()).toContain("unauthorized");
    expect(parsed.text).not.toContain("thread.started");
  });

  it("keeps openai reconnect logs as status events and avoids raw stdout fallback", () => {
    const output = [
      '{"type":"thread.started","thread_id":"thread-1"}',
      '{"type":"error","message":"Reconnecting... 1/5 (unexpected status 401 Unauthorized: Missing bearer or basic authentication in header, request id: req_123)"}',
      '{"type":"turn.failed","error":{"message":"unexpected status 401 Unauthorized: Missing bearer or basic authentication in header"}}',
    ].join("\n");
    const stderr =
      '2026-02-19T19:10:17.076509Z ERROR codex_api::endpoint::responses: error=http 401 Unauthorized: Some("{\\"error\\":{\\"message\\":\\"Missing bearer or basic authentication in header\\"}}")';
    const parsed = parseCodexResponse(output, stderr);

    expect(parsed.events.some((event) => event.type === "status")).toBe(true);
    expect(parsed.events.some((event) => event.type === "error")).toBe(true);
    expect(parsed.text).toContain("401 Unauthorized");
    expect(parsed.text).not.toContain("thread.started");
    expect(parsed.text).not.toContain("request id");
  });

  it("parses claude stream-json output + session", () => {
    const output = [
      '{"type":"message_start","session_id":"sess"}',
      '{"type":"content_block_delta","delta":{"thinking":"reasoning chunk"}}',
      '{"type":"content_block_delta","delta":{"text":"done"}}',
      '{"type":"result","result":"done","session_id":"sess"}',
    ].join("\n");

    const parsed = parseClaudeResponse(output);
    expect(parsed.text).toBe("done");
    expect(parsed.sessionId).toBe("sess");
    expect(parsed.events.some((event) => event.type === "thinking")).toBe(true);
    expect(parsed.events.some((event) => event.type === "assistant_text")).toBe(true);
  });

  it("parses gemini json response + noisy status lines", () => {
    const output = [
      "YOLO mode is enabled. All tool calls will be automatically approved.",
      '{"session_id":"x","response":"done"}',
      "Error when talking to Gemini API ModelNotFoundError: Requested entity was not found.",
    ].join("\n");

    const parsed = parseGeminiResponse(output);
    expect(parsed.text).toBe("done");
    expect(parsed.sessionId).toBe("x");
    expect(parsed.events.some((event) => event.type === "status")).toBe(true);
    expect(parsed.events.some((event) => event.type === "assistant_text")).toBe(true);
    expect(parsed.events.some((event) => event.type === "error")).toBe(true);
  });

  it("parses gemini pretty-json error payload from stderr", () => {
    const stderr = [
      "YOLO mode is enabled. All tool calls will be automatically approved.",
      "{",
      '  "session_id": "sess-err",',
      '  "error": {',
      '    "type": "Error",',
      '    "message": "ModelNotFoundError: Requested entity was not found.",',
      '    "code": 41',
      "  }",
      "}",
    ].join("\n");
    const parsed = parseGeminiResponse("", stderr);
    expect(parsed.text).toContain("ModelNotFoundError");
    expect(parsed.events.some((event) => event.type === "error")).toBe(true);
  });

  it("parses gemini stream-json with deltas, tool_use, and tool_result", () => {
    const output = [
      '{"type":"init","session_id":"sess-stream","model":"gemini-3-flash-preview"}',
      '{"type":"message","role":"user","content":"Create a file"}',
      '{"type":"message","role":"assistant","content":"I will create the file.","delta":true}',
      '{"type":"tool_use","tool_name":"run_shell_command","tool_id":"tool_1","parameters":{"command":"echo hello"}}',
      '{"type":"tool_result","tool_id":"tool_1","status":"success","output":"hello"}',
      '{"type":"message","role":"assistant","content":"File created successfully.","delta":true}',
      '{"type":"result","status":"success","stats":{"total_tokens":100}}',
    ].join("\n");

    const parsed = parseGeminiResponse(output);
    expect(parsed.sessionId).toBe("sess-stream");
    expect(parsed.text).toContain("I will create the file.");
    expect(parsed.text).toContain("File created successfully.");
    expect(parsed.events.some((e) => e.type === "tool_call")).toBe(true);
    expect(parsed.events.some((e) => e.type === "tool_result")).toBe(true);
    expect(parsed.events.filter((e) => e.type === "assistant_text")).toHaveLength(2);
    // user message should NOT produce an assistant_text event
    const userTextEvent = parsed.events.find(
      (e) => e.type === "assistant_text" && (e.payload.text as string).includes("Create a file"),
    );
    expect(userTextEvent).toBeUndefined();
  });

  it("extracts tool_name from gemini stream-json tool_use events", () => {
    const output = [
      '{"type":"tool_use","tool_name":"read_file","tool_id":"rf_1","parameters":{"file_path":"/tmp/x"}}',
    ].join("\n");

    const parsed = parseGeminiResponse(output);
    const toolCall = parsed.events.find((e) => e.type === "tool_call");
    expect(toolCall).toBeDefined();
    expect(toolCall!.payload.name).toBe("read_file");
  });

  it("filters user messages from gemini stream-json response text", () => {
    const output = [
      '{"type":"message","role":"user","content":"This is the user prompt"}',
      '{"type":"message","role":"assistant","content":"This is the response","delta":true}',
    ].join("\n");

    const parsed = parseGeminiResponse(output);
    expect(parsed.text).toBe("This is the response");
    expect(parsed.text).not.toContain("user prompt");
  });

  it("concatenates multiple gemini stream-json assistant deltas", () => {
    const output = [
      '{"type":"message","role":"assistant","content":"First chunk.","delta":true}',
      '{"type":"message","role":"assistant","content":"Second chunk.","delta":true}',
      '{"type":"message","role":"assistant","content":"Third chunk.","delta":true}',
    ].join("\n");

    const parsed = parseGeminiResponse(output);
    expect(parsed.text).toContain("First chunk.");
    expect(parsed.text).toContain("Second chunk.");
    expect(parsed.text).toContain("Third chunk.");
  });
});
