import { MODEL_CATALOG, THINKING_CATALOG } from "../config/models.js";
import { extractJsonFromText } from "../lib/io.js";
import { runCommand, commandExists } from "../lib/process.js";
import type { ProviderAdapter, ProviderCommand, ProviderExecutionInput, ProviderExecutionResult } from "./types.js";

export interface ParsedGeminiResponse {
  text: string;
  sessionId?: string;
}

export function parseGeminiResponse(stdout: string): ParsedGeminiResponse {
  const jsonText = extractJsonFromText(stdout);
  if (jsonText) {
    try {
      const payload = JSON.parse(jsonText) as { response?: string; session_id?: string };
      return {
        text: typeof payload.response === "string" ? payload.response.trim() : stdout.trim(),
        sessionId: typeof payload.session_id === "string" ? payload.session_id : undefined,
      };
    } catch {
      // ignore parse error
    }
  }

  return { text: stdout.trim() };
}

function buildCommand(input: ProviderExecutionInput): ProviderCommand {
  const args = [
    "-p",
    input.prompt,
    "--model",
    input.model,
    "--output-format",
    "json",
    "--approval-mode",
    "yolo",
  ];

  if (input.sessionStrategy === "resume" && input.resumeSessionId) {
    args.push("--resume", input.resumeSessionId);
  }

  return {
    command: "gemini",
    args,
  };
}

const GEMINI_FALLBACK_ORDER = [
  "gemini-3-pro-preview",
  "gemini-3.1-pro-preview",
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
];

export const googleAdapter: ProviderAdapter = {
  id: "google",
  name: "Google",
  cliCommand: "gemini",
  models: MODEL_CATALOG.google,
  thinkingOptions: THINKING_CATALOG.google,
  defaultModel: MODEL_CATALOG.google[0].value,
  defaultThinking: THINKING_CATALOG.google[0].value,
  supportsResume: true,
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
        usedModel: input.model,
        command,
        sessionId: input.resumeSessionId,
      };
    }

    const result = await runCommand({
      command: command.command,
      args: command.args,
      cwd: input.cwd,
      timeoutMs: input.timeoutMs,
      env: command.env,
    });

    const parsed = parseGeminiResponse(result.stdout);

    return {
      ok: result.exitCode === 0 && !result.timedOut,
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      stdout: result.stdout,
      stderr: result.stderr,
      responseText: parsed.text,
      usedModel: input.model,
      command,
      sessionId: parsed.sessionId,
    };
  },
  fallbackModels(requestedModel: string): string[] {
    const ordered = [requestedModel, ...GEMINI_FALLBACK_ORDER];
    return [...new Set(ordered)];
  },
};
