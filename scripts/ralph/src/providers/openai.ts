import { MODEL_CATALOG, THINKING_CATALOG } from "../config/models.js";
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

export interface ParsedCodexResponse {
  text: string;
  sessionId?: string;
  events: ProviderOutputEvent[];
  thinkingSummary?: string;
}

const OPENAI_REASONING_TIERS = new Set(["medium", "high", "xhigh"]);

function normalizeReasoningEffort(value: string): string {
  return OPENAI_REASONING_TIERS.has(value) ? value : "medium";
}

function extractAssistantText(payload: Record<string, unknown>, item: Record<string, unknown> | null): string | undefined {
  const candidates = [
    asString(item?.text),
    asString(payload.output_text),
    asString(payload.text),
    asString(payload.message),
  ];
  return candidates.find((candidate) => Boolean(candidate && candidate.trim().length > 0));
}

function extractThinkingText(payload: Record<string, unknown>, item: Record<string, unknown> | null): string | undefined {
  const reasoning = asRecord(payload.reasoning);
  const itemReasoning = asRecord(item?.reasoning);
  const candidates = [
    asString(item?.summary),
    asString(itemReasoning?.summary),
    asString(item?.text),
    asString(reasoning?.summary),
    asString(payload.summary),
    asString(payload.reasoning_summary),
  ];
  return candidates.find((candidate) => Boolean(candidate && candidate.trim().length > 0));
}

function isToolCall(typeValue: string): boolean {
  const value = typeValue.toLowerCase();
  return value.includes("tool_call") || value.includes("tool.call");
}

function isToolResult(typeValue: string): boolean {
  const value = typeValue.toLowerCase();
  return value.includes("tool_result") || value.includes("tool.result");
}

function looksLikeErrorText(text: string): boolean {
  const value = text.toLowerCase();
  return (
    value.includes("error") ||
    value.includes("unauthorized") ||
    value.includes("forbidden") ||
    value.includes("reconnecting") ||
    value.includes("invalid") ||
    value.includes("failed")
  );
}

function isReconnectMessage(text: string): boolean {
  return /^reconnecting\.\.\.\s*\d+\/\d+/i.test(text.trim());
}

function sanitizeOpenAiError(raw: string): string {
  let value = raw.trim();
  value = value
    .replace(/^\d{4}-\d{2}-\d{2}t[^\s]+\s+(error|warn)\s+[^\:]+:\s*/i, "")
    .replace(/^error=http\s*/i, "")
    .replace(/,?\s*cf-ray:\s*[^,\)]*/gi, "")
    .replace(/,?\s*request id:\s*[^,\)]*/gi, "")
    .trim();

  if (/missing bearer or basic authentication in header/i.test(value)) {
    return "401 Unauthorized: Missing bearer or basic authentication in header";
  }
  if (/missing bearer authentication in header/i.test(value)) {
    return "401 Unauthorized: Missing bearer authentication in header";
  }

  return value;
}

function compactErrorMessage(raw: string): string {
  return truncateText(
    sanitizeOpenAiError(
      raw
        .replace(/^reconnecting\.\.\.\s*\d+\/\d+\s*\(/i, "")
        .replace(/\)\s*$/, "")
        .trim(),
    ),
    240,
  );
}

function extractErrorFromLogLine(line: string): string | undefined {
  const trimmed = line.trim();
  if (!trimmed) {
    return undefined;
  }

  if (
    trimmed.startsWith("WARNING: proceeding, even though we could not update PATH") ||
    trimmed.toLowerCase().includes("model personality requested but model_messages is missing")
  ) {
    return undefined;
  }

  if (isReconnectMessage(trimmed)) {
    return compactErrorMessage(trimmed);
  }

  const bearerMatch = trimmed.match(
    /missing bearer(?: or basic)? authentication in header|missing bearer or basic authentication in header/i,
  );
  if (bearerMatch?.[0]) {
    return compactErrorMessage(bearerMatch[0]);
  }

  const statusMatch = trimmed.match(/unexpected status [^\n]+/i);
  if (statusMatch?.[0]) {
    return compactErrorMessage(statusMatch[0]);
  }

  if (looksLikeErrorText(trimmed)) {
    return compactErrorMessage(trimmed);
  }

  return undefined;
}

function fallbackFinalText(stdout: string, stderr: string): string {
  const lines = [stdout, stderr]
    .join("\n")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("{") && !line.startsWith("["));

  const candidate =
    lines.find((line) => extractErrorFromLogLine(line) !== undefined) ??
    lines.find((line) => !line.toLowerCase().startsWith("warning:")) ??
    lines[0] ??
    "";
  const compact = extractErrorFromLogLine(candidate) ?? truncateText(candidate, 260);
  return compact.trim();
}

export function parseCodexResponse(stdout: string, stderr = "", attempt = 1): ParsedCodexResponse {
  const records = parseJsonLines(stdout);
  const events: ProviderOutputEvent[] = [];

  let lastAssistantText = "";
  let sessionId: string | undefined;
  const errorMessages: string[] = [];
  const seenErrors = new Set<string>();

  for (const value of records) {
    const payload = asRecord(value);
    if (!payload) {
      continue;
    }

    const typeValue = asString(payload.type) ?? "";
    const item = asRecord(payload.item);
    const itemType = asString(item?.type) ?? "";

    if (typeValue === "thread.started" && typeof payload.thread_id === "string") {
      sessionId = payload.thread_id;
      events.push(
        createProviderEvent({
          type: "status",
          provider: "openai",
          attempt,
          payload: { status: "thread_started", sessionId },
        }),
      );
      continue;
    }

    if (typeValue === "error" || typeValue === "turn.failed" || itemType.toLowerCase().includes("error")) {
      const errorText =
        asString(payload.message) ??
        asString(asRecord(payload.error)?.message) ??
        asString(item?.message) ??
        asString(asRecord(item?.error)?.message);
      if (errorText) {
        const compact = compactErrorMessage(errorText);
        if (isReconnectMessage(errorText)) {
          events.push(
            createProviderEvent({
              type: "status",
              provider: "openai",
              attempt,
              payload: { status: `retrying: ${compact}`, sourceType: typeValue || itemType || "reconnect" },
            }),
          );
        } else {
          if (!seenErrors.has(compact)) {
            seenErrors.add(compact);
            errorMessages.push(compact);
          }
          events.push(
            createProviderEvent({
              type: "error",
              provider: "openai",
              attempt,
              payload: { error: compact, sourceType: typeValue || itemType || "error" },
            }),
          );
        }
      }
    }

    const thinkingText =
      itemType.toLowerCase().includes("reasoning") || typeValue.toLowerCase().includes("reasoning")
        ? extractThinkingText(payload, item)
        : undefined;
    if (thinkingText) {
      events.push(
        createProviderEvent({
          type: "thinking",
          provider: "openai",
          attempt,
          payload: { summary: truncateText(thinkingText, 240) },
        }),
      );
    }

    if (isToolCall(itemType) || isToolCall(typeValue)) {
      events.push(
        createProviderEvent({
          type: "tool_call",
          provider: "openai",
          attempt,
          payload: {
            name: asString(item?.name) ?? asString(payload.name) ?? "tool_call",
            command: asString(item?.command) ?? asString(payload.command),
            sourceType: itemType || typeValue || "tool_call",
          },
        }),
      );
    }

    if (isToolResult(itemType) || isToolResult(typeValue)) {
      events.push(
        createProviderEvent({
          type: "tool_result",
          provider: "openai",
          attempt,
          payload: {
            name: asString(item?.name) ?? asString(payload.name) ?? "tool_result",
            status: asString(item?.status) ?? asString(payload.status),
            sourceType: itemType || typeValue || "tool_result",
          },
        }),
      );
    }

    const assistantText =
      itemType === "agent_message" || itemType.toLowerCase().includes("assistant")
        ? extractAssistantText(payload, item)
        : undefined;
    if (assistantText) {
      lastAssistantText = assistantText.trim();
      events.push(
        createProviderEvent({
          type: "assistant_text",
          provider: "openai",
          attempt,
          payload: { text: lastAssistantText },
        }),
      );
    }

    if (typeValue === "turn.completed") {
      events.push(
        createProviderEvent({
          type: "status",
          provider: "openai",
          attempt,
          payload: { status: "turn_completed" },
        }),
      );
    }
  }

  const stderrLines = stderr.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (const line of stderrLines) {
    const compact = extractErrorFromLogLine(line);
    if (!compact || seenErrors.has(compact)) {
      continue;
    }
    seenErrors.add(compact);
    errorMessages.push(compact);
    events.push(
      createProviderEvent({
        type: "error",
        provider: "openai",
        attempt,
        payload: { error: compact, sourceType: "stderr" },
      }),
    );
    if (errorMessages.length >= 3) {
      break;
    }
  }

  if (errorMessages.length === 0) {
    const fallbackError = extractErrorFromLogLine(stdout) ?? extractErrorFromLogLine(stderr);
    if (fallbackError) {
      errorMessages.push(fallbackError);
      events.push(
        createProviderEvent({
          type: "error",
          provider: "openai",
          attempt,
          payload: { error: fallbackError, sourceType: "fallback" },
        }),
      );
    }
  }

  const finalText = lastAssistantText || errorMessages[0] || fallbackFinalText(stdout, stderr);

  return {
    text: finalText.trim(),
    sessionId,
    events,
    thinkingSummary: summarizeThinking(events),
  };
}

function buildCommand(input: ProviderExecutionInput): ProviderCommand {
  const prelude =
    input.sessionStrategy === "resume" && input.resumeSessionId
      ? ["exec", "resume", input.resumeSessionId]
      : ["exec"];

  const args = [
    ...prelude,
    "--json",
    "--dangerously-bypass-approvals-and-sandbox",
    "-s",
    "danger-full-access",
    "-m",
    input.model,
  ];

  if (input.outputSchemaPath) {
    args.push("--output-schema", input.outputSchemaPath);
  }

  if (input.thinkingValue) {
    const effort = normalizeReasoningEffort(input.thinkingValue);
    args.push("-c", `model_reasoning_effort=\"${effort}\"`);
  }

  args.push(input.prompt);

  return {
    command: "codex",
    args,
    env: input.env,
  };
}

export const openaiAdapter: ProviderAdapter = {
  id: "openai",
  name: "OpenAI",
  cliCommand: "codex",
  models: MODEL_CATALOG.openai,
  thinkingOptions: THINKING_CATALOG.openai,
  defaultModel: MODEL_CATALOG.openai[0].value,
  defaultThinking: "high",
  supportsResume: true,
  supportsOutputSchemaPath: true,
  supportsStreamJson: true,
  isInstalled: () => commandExists("codex"),
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
        responseText: "[dry-run] codex execution skipped",
        finalText: "[dry-run] codex execution skipped",
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

          const parsedChunk = parseCodexResponse(line, "", input.attempt ?? 1);
          for (const event of parsedChunk.events) {
            void input.onEvent(event);
          }
        }
      }
    });

    const parsed = parseCodexResponse(result.stdout, result.stderr, input.attempt ?? 1);

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
