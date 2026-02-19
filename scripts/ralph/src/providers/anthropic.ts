import { MODEL_CATALOG, THINKING_CATALOG } from "../config/models.js";
import { extractJsonFromText } from "../lib/io.js";
import { commandExists, runCommand } from "../lib/process.js";
import {
  asRecord,
  asString,
  createProviderEvent,
  parseJsonLines,
  summarizeThinking,
  truncateText,
  type ProviderOutputEvent,
} from "./output-events.js";
import type { ProviderAdapter, ProviderCommand, ProviderExecutionInput, ProviderExecutionResult } from "./types.js";

export interface ParsedClaudeResponse {
  text: string;
  sessionId?: string;
  events: ProviderOutputEvent[];
  thinkingSummary?: string;
}

function extractResultText(payload: Record<string, unknown>): string | undefined {
  return (
    asString(payload.result) ??
    asString(payload.text) ??
    asString(payload.output_text) ??
    asString(asRecord(payload.message)?.content)
  );
}

function parseClaudeStream(stdout: string, attempt: number): ParsedClaudeResponse {
  const events: ProviderOutputEvent[] = [];
  let sessionId: string | undefined;
  let finalText = "";

  const records = parseJsonLines(stdout);
  for (const value of records) {
    const payload = asRecord(value);
    if (!payload) {
      continue;
    }

    const typeValue = asString(payload.type) ?? "";
    const delta = asRecord(payload.delta);
    const contentBlock = asRecord(payload.content_block);

    const maybeSessionId = asString(payload.session_id) ?? asString(payload.sessionId);
    if (maybeSessionId) {
      sessionId = maybeSessionId;
    }

    const thinkingText = asString(delta?.thinking) ?? asString(payload.thinking) ?? asString(payload.reasoning);
    if (thinkingText) {
      events.push(
        createProviderEvent({
          type: "thinking",
          provider: "anthropic",
          attempt,
          payload: { summary: truncateText(thinkingText, 240), sourceType: typeValue || "thinking" },
        }),
      );
    }

    const textDelta = asString(delta?.text) ?? asString(payload.text);
    if (textDelta && textDelta.trim().length > 0) {
      finalText = `${finalText}${textDelta}`;
      events.push(
        createProviderEvent({
          type: "assistant_text",
          provider: "anthropic",
          attempt,
          payload: { text: textDelta, sourceType: typeValue || "text_delta" },
        }),
      );
    }

    const blockType = asString(contentBlock?.type) ?? asString(payload.content_block_type) ?? "";
    if (blockType === "tool_use") {
      events.push(
        createProviderEvent({
          type: "tool_call",
          provider: "anthropic",
          attempt,
          payload: {
            name: asString(contentBlock?.name) ?? asString(payload.name) ?? "tool_use",
            sourceType: typeValue || blockType,
          },
        }),
      );
    }
    if (typeValue.includes("tool_result") || blockType === "tool_result") {
      events.push(
        createProviderEvent({
          type: "tool_result",
          provider: "anthropic",
          attempt,
          payload: {
            name: asString(contentBlock?.name) ?? asString(payload.name) ?? "tool_result",
            status: asString(payload.status),
            sourceType: typeValue || blockType || "tool_result",
          },
        }),
      );
    }

    if (typeValue === "result") {
      const resultText = extractResultText(payload);
      if (resultText && resultText.trim().length > 0) {
        finalText = resultText.trim();
      }
      events.push(
        createProviderEvent({
          type: "status",
          provider: "anthropic",
          attempt,
          payload: { status: "result", sourceType: typeValue },
        }),
      );
    }
  }

  return {
    text: finalText.trim() || stdout.trim(),
    sessionId,
    events,
    thinkingSummary: summarizeThinking(events),
  };
}

export function parseClaudeResponse(stdout: string, attempt = 1): ParsedClaudeResponse {
  const streamParsed = parseClaudeStream(stdout, attempt);
  if (streamParsed.events.length > 0 || streamParsed.text.length > 0) {
    return streamParsed;
  }

  const jsonText = extractJsonFromText(stdout);
  if (jsonText) {
    try {
      const payload = JSON.parse(jsonText) as { result?: string; session_id?: string };
      const text = typeof payload.result === "string" ? payload.result.trim() : stdout.trim();
      return {
        text,
        sessionId: typeof payload.session_id === "string" ? payload.session_id : undefined,
        events: text
          ? [
            createProviderEvent({
              type: "assistant_text",
              provider: "anthropic",
              attempt,
              payload: { text },
            }),
          ]
          : [],
      };
    } catch {
      // ignore parse error
    }
  }

  return { text: stdout.trim(), events: [] };
}

function buildCommand(input: ProviderExecutionInput): ProviderCommand {
  const outputFormat = input.outputSchema || input.streamingEnabled === false ? "json" : "stream-json";
  const args = ["-p", "--output-format", outputFormat];

  if (outputFormat === "stream-json") {
    args.push("--include-partial-messages");
  }

  if (input.sessionStrategy === "resume" && input.resumeSessionId) {
    args.push("--resume", input.resumeSessionId);
  }

  if (input.outputSchema) {
    args.push("--json-schema", JSON.stringify(input.outputSchema));
  }

  args.push("--model", input.model);

  if (input.thinkingValue) {
    args.push("--max-turns", input.thinkingValue);
  }

  args.push("--dangerously-skip-permissions", input.prompt);

  return {
    command: "claude",
    args,
  };
}

export const anthropicAdapter: ProviderAdapter = {
  id: "anthropic",
  name: "Anthropic",
  cliCommand: "claude",
  models: MODEL_CATALOG.anthropic,
  thinkingOptions: THINKING_CATALOG.anthropic,
  defaultModel: MODEL_CATALOG.anthropic[0].value,
  defaultThinking: THINKING_CATALOG.anthropic[1].value,
  supportsResume: true,
  supportsJsonSchema: true,
  supportsStreamJson: true,
  isInstalled: () => commandExists("claude"),
  buildCommand,
  async execute(input: ProviderExecutionInput): Promise<ProviderExecutionResult> {
    const command = buildCommand(input);

    if (input.dryRun) {
      return {
        ok: true,
        exitCode: 0,
        timedOut: false,
        stdout: "",
        stderr: "",
        responseText: "[dry-run] claude execution skipped",
        finalText: "[dry-run] claude execution skipped",
        events: [],
        usedModel: input.model,
        command,
        sessionId: input.resumeSessionId,
        rawOutput: { stdout: "", stderr: "" },
        attempt: input.attempt,
      };
    }

    let stdoutBuffer = "";
    const result = await runCommand({
      command: command.command,
      args: command.args,
      cwd: input.cwd,
      timeoutMs: input.timeoutMs,
      env: command.env,
      onStdout: (chunk) => {
        if (!input.onEvent) return;
        stdoutBuffer += chunk;
        let newlineIndex;
        while ((newlineIndex = stdoutBuffer.indexOf("\n")) !== -1) {
          const line = stdoutBuffer.slice(0, newlineIndex);
          stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);

          if (!line.trim()) continue;

          const parsedChunk = parseClaudeResponse(line, input.attempt ?? 1);
          for (const event of parsedChunk.events) {
            void input.onEvent(event);
          }
        }
      }
    });

    const parsed = parseClaudeResponse(result.stdout, input.attempt ?? 1);

    return {
      ok: result.exitCode === 0 && !result.timedOut,
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      stdout: result.stdout,
      stderr: result.stderr,
      responseText: parsed.text,
      finalText: parsed.text,
      events: parsed.events,
      thinkingSummary: parsed.thinkingSummary,
      usedModel: input.model,
      command,
      sessionId: parsed.sessionId,
      rawOutput: { stdout: result.stdout, stderr: result.stderr },
      attempt: input.attempt,
    };
  },
};
