import { MODEL_CATALOG, THINKING_CATALOG } from "../config/models.js";
import { extractJsonFromText } from "../lib/io.js";
import { runCommand, commandExists } from "../lib/process.js";
import type { ProviderAdapter, ProviderCommand, ProviderExecutionInput, ProviderExecutionResult } from "./types.js";

export interface ParsedClaudeResponse {
  text: string;
  sessionId?: string;
}

export function parseClaudeResponse(stdout: string): ParsedClaudeResponse {
  const jsonText = extractJsonFromText(stdout);
  if (jsonText) {
    try {
      const payload = JSON.parse(jsonText) as { result?: string; session_id?: string };
      return {
        text: typeof payload.result === "string" ? payload.result.trim() : stdout.trim(),
        sessionId: typeof payload.session_id === "string" ? payload.session_id : undefined,
      };
    } catch {
      // ignore parse error
    }
  }

  return { text: stdout.trim() };
}

function buildCommand(input: ProviderExecutionInput): ProviderCommand {
  const args = ["-p", "--output-format", "json"];

  if (input.sessionStrategy === "resume" && input.resumeSessionId) {
    args.push("--resume", input.resumeSessionId);
  }

  if (input.outputSchema) {
    args.push("--json-schema", JSON.stringify(input.outputSchema));
  }

  args.push(
    "--model",
    input.model,
    "--max-turns",
    input.thinkingValue || "10",
    "--dangerously-skip-permissions",
    input.prompt,
  );

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

    const parsed = parseClaudeResponse(result.stdout);

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
};
