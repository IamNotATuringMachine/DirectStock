import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { MODEL_CATALOG, THINKING_CATALOG } from "../config/models.js";
import { extractJsonFromText } from "../lib/io.js";
import { commandExists, runCommand } from "../lib/process.js";
import {
  asRecord,
  asString,
  createProviderEvent,
  eventPreview,
  parseJsonLines,
  summarizeThinking,
  truncateText,
  type ProviderOutputEvent,
} from "./output-events.js";
import type { ProviderAdapter, ProviderCommand, ProviderExecutionInput, ProviderExecutionResult } from "./types.js";

export interface ParsedGeminiResponse {
  text: string;
  sessionId?: string;
  events: ProviderOutputEvent[];
  thinkingSummary?: string;
}

const GEMINI_NOISE_PATTERNS = [
  /^yolo mode is enabled/i,
  /^loaded cached credentials/i,
  /^server '.+' supports (tool|resource|prompt) updates/i,
  /^tools changed, updating gemini context/i,
  /^prompt with name ".+" is already registered/i,
  /^🔔 received (prompt|resource|tool) update notification/i,
];

function isNoiseLine(line: string): boolean {
  return GEMINI_NOISE_PATTERNS.some((pattern) => pattern.test(line));
}

function classifyLineType(line: string): "status" | "error" {
  const lower = line.toLowerCase();
  if (
    lower.includes("error") ||
    lower.includes("exception") ||
    lower.includes("modelnotfound") ||
    lower.includes("rate limit") ||
    lower.includes("resource_exhausted")
  ) {
    return "error";
  }
  return "status";
}

function looksLikeJsonStructureLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) {
    return false;
  }
  if (
    trimmed === "{" ||
    trimmed === "}" ||
    trimmed === "[" ||
    trimmed === "]" ||
    trimmed === "," ||
    trimmed === "],"
  ) {
    return true;
  }
  if (/^".+":\s*/.test(trimmed)) {
    return true;
  }
  return false;
}

function extractResponseTextFromRecord(payload: Record<string, unknown>): string | undefined {
  return (
    asString(payload.response) ??
    asString(payload.result) ??
    asString(payload.text) ??
    asString(asRecord(payload.message)?.content) ??
    asString(payload.content)
  );
}

function isAssistantContent(payload: Record<string, unknown>): boolean {
  const role = asString(payload.role);
  if (role && role !== "assistant") {
    return false;
  }
  return true;
}

function isToolUseType(typeValue: string): boolean {
  const lower = typeValue.toLowerCase();
  return lower.includes("tool_call") || lower.includes("tool.call") || lower === "tool_use";
}

function isToolResultType(typeValue: string): boolean {
  const lower = typeValue.toLowerCase();
  return lower.includes("tool_result") || lower.includes("tool.result");
}

function parseGeminiJsonPayload(
  payload: Record<string, unknown>,
  attempt: number,
  events: ProviderOutputEvent[],
  textAccumulator: string[],
): { sessionId?: string } {
  const sessionId = asString(payload.session_id) ?? asString(payload.sessionId);
  const maybeType = asString(payload.type) ?? "";

  // Handle tool_use events (gemini stream-json uses "tool_use" type)
  if (isToolUseType(maybeType)) {
    events.push(
      createProviderEvent({
        type: "tool_call",
        provider: "google",
        attempt,
        payload: {
          name: asString(payload.tool_name) ?? asString(payload.name) ?? "tool_call",
          command: asString(payload.command),
          sourceType: maybeType,
        },
      }),
    );
    return { sessionId };
  }

  // Handle tool_result events
  if (isToolResultType(maybeType)) {
    events.push(
      createProviderEvent({
        type: "tool_result",
        provider: "google",
        attempt,
        payload: {
          name: asString(payload.tool_name) ?? asString(payload.name) ?? "tool_result",
          status: asString(payload.status),
          sourceType: maybeType,
        },
      }),
    );
    return { sessionId };
  }

  // Skip non-assistant messages (user messages, init, result events without text)
  if (!isAssistantContent(payload)) {
    return { sessionId };
  }

  const responseText = extractResponseTextFromRecord(payload);

  if (responseText && responseText.trim().length > 0) {
    textAccumulator.push(responseText.trim());
    events.push(
      createProviderEvent({
        type: "assistant_text",
        provider: "google",
        attempt,
        payload: { text: responseText.trim() },
      }),
    );
  }

  const thinkingText =
    asString(payload.thinking) ??
    asString(payload.reasoning) ??
    asString(asRecord(payload.metadata)?.thinking_summary);
  if (thinkingText) {
    events.push(
      createProviderEvent({
        type: "thinking",
        provider: "google",
        attempt,
        payload: { summary: thinkingText },
      }),
    );
  }

  return { sessionId };
}

export function parseGeminiResponse(stdout: string, stderr = "", attempt = 1): ParsedGeminiResponse {
  const events: ProviderOutputEvent[] = [];
  const textAccumulator: string[] = [];

  let sessionId: string | undefined;
  let finalText = "";

  const mergedOutput = [stdout, stderr].filter(Boolean).join("\n");
  const parsedLines = parseJsonLines(mergedOutput);
  for (const parsed of parsedLines) {
    const payload = asRecord(parsed);
    if (!payload) {
      continue;
    }
    const parsedPayload = parseGeminiJsonPayload(payload, attempt, events, textAccumulator);
    if (parsedPayload.sessionId) {
      sessionId = parsedPayload.sessionId;
    }
  }

  // Concatenate all accumulated assistant text
  if (textAccumulator.length > 0) {
    finalText = textAccumulator.join(" ");
  }

  let extractedPayload: Record<string, unknown> | null = null;
  const jsonText = extractJsonFromText(mergedOutput);
  if (jsonText && parsedLines.length === 0) {
    try {
      extractedPayload = JSON.parse(jsonText) as Record<string, unknown>;
      const extractedAccumulator: string[] = [];
      const parsedPayload = parseGeminiJsonPayload(extractedPayload, attempt, events, extractedAccumulator);
      if (extractedAccumulator.length > 0 && !finalText) {
        finalText = extractedAccumulator.join(" ");
      }
      if (parsedPayload.sessionId && !sessionId) {
        sessionId = parsedPayload.sessionId;
      }
      const errorMessage =
        asString(asRecord(extractedPayload.error)?.message) ??
        asString(asRecord(extractedPayload.error)?.type);
      if (errorMessage) {
        events.push(
          createProviderEvent({
            type: "error",
            provider: "google",
            attempt,
            payload: { error: truncateText(errorMessage, 260), sourceType: "json_error" },
          }),
        );
        if (!finalText) {
          finalText = truncateText(errorMessage, 260);
        }
      }
    } catch {
      extractedPayload = null;
    }
  }

  const textLines = mergedOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      if (line.startsWith("{") || line.startsWith("[") || looksLikeJsonStructureLine(line)) {
        return false;
      }
      return true;
    });

  for (const line of textLines) {
    if (isNoiseLine(line)) {
      events.push(
        createProviderEvent({
          type: "status",
          provider: "google",
          attempt,
          payload: { line },
        }),
      );
      continue;
    }

    const lineType = classifyLineType(line);
    events.push(
      createProviderEvent({
        type: lineType,
        provider: "google",
        attempt,
        payload: lineType === "error" ? { error: line } : { status: line },
      }),
    );
  }

  if (!finalText && extractedPayload) {
    const fallbackError =
      asString(asRecord(extractedPayload.error)?.message) ?? asString(asRecord(extractedPayload.error)?.type);
    if (fallbackError) {
      finalText = truncateText(fallbackError, 260);
    }
  }

  if (!finalText) {
    const assistantEvent = [...events].reverse().find((event) => event.type === "assistant_text");
    finalText = assistantEvent ? eventPreview(assistantEvent, 300) : stdout.trim();
  }

  return {
    text: finalText.trim(),
    sessionId,
    events,
    thinkingSummary: summarizeThinking(events),
  };
}

function mergeUniqueEvents(primary: ProviderOutputEvent[], secondary: ProviderOutputEvent[]): ProviderOutputEvent[] {
  const seen = new Set<string>();
  const merged: ProviderOutputEvent[] = [];

  const pushUnique = (event: ProviderOutputEvent) => {
    const key = `${event.type}|${JSON.stringify(event.payload)}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    merged.push(event);
  };

  for (const event of primary) {
    pushUnique(event);
  }
  for (const event of secondary) {
    pushUnique(event);
  }

  return merged;
}

async function findSessionFile(shortId: string): Promise<string | undefined> {
  const tmpDir = path.join(os.homedir(), ".gemini", "tmp");
  try {
    const hashes = await fs.readdir(tmpDir);
    for (const hash of hashes) {
      const chatsDir = path.join(tmpDir, hash, "chats");
      try {
        const files = await fs.readdir(chatsDir);
        const match = files.find((f) => f.startsWith("session-") && f.endsWith(`${shortId}.json`));
        if (match) {
          return path.join(chatsDir, match);
        }
      } catch {
        // Ignore errors reading individual chat dirs
      }
    }
  } catch {
    // Ignore if tmp dir does not exist
  }
  return undefined;
}

async function watchGeminiSessionThoughts(
  sessionId: string,
  onEvent: (event: ProviderOutputEvent) => void,
  attempt: number,
  signal: AbortSignal,
): Promise<void> {
  const shortId = sessionId.slice(0, 8);
  let sessionFile: string | undefined;

  // Poll briefly to find the newly created session file
  for (let i = 0; i < 20; i++) {
    if (signal.aborted) return;
    sessionFile = await findSessionFile(shortId);
    if (sessionFile) break;
    await new Promise((r) => setTimeout(r, 250));
  }

  if (!sessionFile) return;

  let lastThoughtCount = 0;

  // Tail the session file while the command is running
  while (!signal.aborted) {
    try {
      const content = await fs.readFile(sessionFile, "utf8");
      const data = JSON.parse(content) as Record<string, unknown>;
      const messages = (data.messages as Record<string, unknown>[]) || [];
      const lastGeminiMessage = [...messages].reverse().find((m) => m.type === "gemini");

      if (lastGeminiMessage && Array.isArray(lastGeminiMessage.thoughts)) {
        const currentCount = lastGeminiMessage.thoughts.length;
        if (currentCount > lastThoughtCount) {
          for (let i = lastThoughtCount; i < currentCount; i++) {
            const thought = lastGeminiMessage.thoughts[i] as Record<string, unknown>;
            if (thought && (thought.subject || thought.description)) {
              const text = [asString(thought.subject), asString(thought.description)].filter(Boolean).join("\n");
              if (text) {
                onEvent(
                  createProviderEvent({
                    type: "thinking",
                    provider: "google",
                    attempt,
                    payload: { summary: text },
                  }),
                );
              }
            }
          }
          lastThoughtCount = currentCount;
        }
      }
    } catch {
      // Ignore JSON parse errors (file might be locked/mid-write)
    }

    await new Promise((r) => setTimeout(r, 250));
  }
}

function buildCommand(input: ProviderExecutionInput): ProviderCommand {
  const outputFormat = input.streamingEnabled !== false ? "stream-json" : "json";
  const args = [
    "-p",
    input.prompt,
    "--model",
    input.model,
    "--output-format",
    outputFormat,
    "--approval-mode",
    "default", // Note: yolo + stream-json currently crashes CLI v0.29.5 in some environments
  ];

  if (input.sessionStrategy === "resume" && input.resumeSessionId) {
    args.push("--resume", input.resumeSessionId);
  }

  // Note: gemini CLI does not expose --thinking-budget flag (thinking budget
  // is API-level only). thinkingValue is stored for logging/display but cannot
  // be forwarded to the CLI as of gemini CLI v0.29.x.

  return {
    command: "gemini",
    args,
    env: input.env,
  };
}

export const googleAdapter: ProviderAdapter = {
  id: "google",
  name: "Google",
  cliCommand: "gemini",
  models: MODEL_CATALOG.google,
  thinkingOptions: THINKING_CATALOG.google,
  defaultModel: MODEL_CATALOG.google[0].value,
  defaultThinking: THINKING_CATALOG.google[0].value,
  supportsResume: true,
  supportsStreamJson: true,
  isInstalled: () => commandExists("gemini"),
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
        responseText: "[dry-run] gemini execution skipped",
        finalText: "[dry-run] gemini execution skipped",
        events: [],
        usedModel: input.model,
        command,
        sessionId: input.resumeSessionId,
        rawOutput: { stdout: "", stderr: "" },
        attempt: input.attempt,
      };
    }

    const abortController = new AbortController();
    let watcherStartedForSessionId: string | undefined;
    let stdoutBuffer = "";
    const streamedEvents: ProviderOutputEvent[] = [];
    const emitEvent = (event: ProviderOutputEvent) => {
      streamedEvents.push(event);
      if (input.onEvent) {
        void input.onEvent(event);
      }
    };

    const result = await runCommand({
      command: command.command,
      args: command.args,
      cwd: input.cwd,
      timeoutMs: input.timeoutMs,
      env: command.env,
      onStdout: (chunk) => {
        stdoutBuffer += chunk;
        let newlineIndex;
        while ((newlineIndex = stdoutBuffer.indexOf("\n")) !== -1) {
          const line = stdoutBuffer.slice(0, newlineIndex);
          stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);

          if (!line.trim()) continue;

          const parsedChunk = parseGeminiResponse(line, "", input.attempt ?? 1);

          if (parsedChunk.sessionId && !watcherStartedForSessionId) {
            watcherStartedForSessionId = parsedChunk.sessionId;
            void watchGeminiSessionThoughts(
              watcherStartedForSessionId,
              emitEvent,
              input.attempt ?? 1,
              abortController.signal,
            );
          }

          for (const event of parsedChunk.events) {
            emitEvent(event);
          }
        }
      },
    });

    // Small grace period for the file watcher to pick up final thoughts
    if (watcherStartedForSessionId) {
      await new Promise((r) => setTimeout(r, 1000));
    }
    abortController.abort();

    const parsed = parseGeminiResponse(result.stdout, result.stderr, input.attempt ?? 1);
    const mergedEvents = mergeUniqueEvents(streamedEvents, parsed.events);

    return {
      ok: result.exitCode === 0 && !result.timedOut,
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      stdout: result.stdout,
      stderr: result.stderr,
      responseText: parsed.text,
      finalText: parsed.text,
      events: mergedEvents,
      thinkingSummary: summarizeThinking(mergedEvents),
      usedModel: input.model,
      command,
      sessionId: parsed.sessionId,
      rawOutput: { stdout: result.stdout, stderr: result.stderr },
      attempt: input.attempt,
    };
  },
};
