import { MODEL_CATALOG, THINKING_CATALOG } from "../config/models.js";
import { runCommand, commandExists } from "../lib/process.js";
import type { ProviderAdapter, ProviderCommand, ProviderExecutionInput, ProviderExecutionResult } from "./types.js";

export interface ParsedCodexResponse {
  text: string;
  sessionId?: string;
}

const OPENAI_REASONING_TIERS = new Set(["medium", "high", "xhigh"]);

function normalizeReasoningEffort(value: string): string {
  return OPENAI_REASONING_TIERS.has(value) ? value : "medium";
}

export function parseCodexResponse(stdout: string): ParsedCodexResponse {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let lastAgentMessage = "";
  let sessionId: string | undefined;

  for (const line of lines) {
    try {
      const payload = JSON.parse(line) as {
        type?: string;
        thread_id?: string;
        item?: { type?: string; text?: string };
      };

      if (payload.type === "thread.started" && typeof payload.thread_id === "string") {
        sessionId = payload.thread_id;
      }

      if (payload.type === "item.completed" && payload.item?.type === "agent_message" && typeof payload.item.text === "string") {
        lastAgentMessage = payload.item.text;
      }
    } catch {
      // ignore non-JSON lines
    }
  }

  return {
    text: (lastAgentMessage || stdout).trim(),
    sessionId,
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

    const parsed = parseCodexResponse(result.stdout);

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
