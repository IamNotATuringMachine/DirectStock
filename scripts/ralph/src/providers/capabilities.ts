import type { ProviderAdapter, ProviderId } from "./types.js";
import { runCommand } from "../lib/process.js";

export interface ProviderRuntimeCapabilities {
  supportsResume: boolean;
  supportsOutputSchemaPath: boolean;
  supportsJsonSchema: boolean;
  supportsStreamOutput: boolean;
  warnings: string[];
}

export interface ProviderCapabilityProbeInput {
  provider: ProviderAdapter;
  cwd: string;
  strict: boolean;
}

export interface ProviderCapabilityProbeResult extends ProviderRuntimeCapabilities {
  fatalMissing: string[];
}

interface ProbeSpec {
  requiredTokens: string[];
  optional: {
    resume?: string[];
    outputSchemaPath?: string[];
    jsonSchema?: string[];
    streamJson?: string[];
  };
  helpCommand: string[];
  resumeHelpCommand?: string[];
}

const PROBE_SPECS: Record<ProviderId, ProbeSpec> = {
  openai: {
    requiredTokens: ["--json", "--dangerously-bypass-approvals-and-sandbox"],
    optional: {
      resume: ["resume"],
      outputSchemaPath: ["--output-schema"],
      streamJson: ["--json"],
    },
    helpCommand: ["exec", "--help"],
    resumeHelpCommand: ["exec", "resume", "--help"],
  },
  anthropic: {
    requiredTokens: ["--output-format", "--max-turns"],
    optional: {
      resume: ["--resume"],
      jsonSchema: ["--json-schema"],
      streamJson: ["stream-json"],
    },
    helpCommand: ["--help"],
  },
  google: {
    requiredTokens: ["--output-format", "--approval-mode"],
    optional: {
      resume: ["--resume"],
      streamJson: ["stream-json"],
    },
    helpCommand: ["--help"],
  },
};

function hasAllTokens(text: string, tokens: string[]): boolean {
  return tokens.every((token) => text.includes(token.toLowerCase()));
}

function indicatesUnknownCommand(text: string): boolean {
  return (
    text.includes("unknown command") ||
    text.includes("unknown option") ||
    text.includes("invalid option") ||
    text.includes("did you mean")
  );
}

interface HelpProbeResult {
  text: string;
  timedOut: boolean;
}

async function collectHelpText(command: string, args: string[], cwd: string): Promise<HelpProbeResult> {
  const result = await runCommand({
    command,
    args,
    cwd,
    timeoutMs: 10_000,
  });

  return {
    text: `${result.stdout}\n${result.stderr}`.toLowerCase(),
    timedOut: result.timedOut,
  };
}

export async function probeProviderCapabilities(
  input: ProviderCapabilityProbeInput,
): Promise<ProviderCapabilityProbeResult> {
  const spec = PROBE_SPECS[input.provider.id];
  const helpProbe = await collectHelpText(input.provider.cliCommand, spec.helpCommand, input.cwd);
  const resumeHelpProbe = spec.resumeHelpCommand
    ? await collectHelpText(input.provider.cliCommand, spec.resumeHelpCommand, input.cwd)
    : helpProbe;
  const helpText = helpProbe.text;
  const resumeHelpText = resumeHelpProbe.text;
  const helpUnavailable = helpProbe.timedOut || helpText.trim().length === 0;
  const resumeHelpUnavailable = resumeHelpProbe.timedOut || resumeHelpText.trim().length === 0;

  const fatalMissing = helpUnavailable
    ? []
    : spec.requiredTokens.filter((token) => !helpText.includes(token.toLowerCase()));
  const warnings: string[] = [];

  if (helpUnavailable) {
    warnings.push(
      `${input.provider.name}: capability probe help output unavailable (timeout/empty); using adapter defaults.`,
    );
  }

  if (fatalMissing.length > 0) {
    warnings.push(
      `${input.provider.name}: required CLI capabilities missing: ${fatalMissing.join(", ")}`,
    );
  }

  const supportsResume = spec.optional.resume
    ? resumeHelpUnavailable
      ? Boolean(input.provider.supportsResume)
      : hasAllTokens(resumeHelpText, spec.optional.resume) && !indicatesUnknownCommand(resumeHelpText)
    : false;
  const supportsOutputSchemaPath = spec.optional.outputSchemaPath
    ? helpUnavailable
      ? Boolean(input.provider.supportsOutputSchemaPath)
      : hasAllTokens(helpText, spec.optional.outputSchemaPath)
    : false;
  const supportsJsonSchema = spec.optional.jsonSchema
    ? helpUnavailable
      ? Boolean(input.provider.supportsJsonSchema)
      : hasAllTokens(helpText, spec.optional.jsonSchema)
    : false;
  const supportsStreamOutput = spec.optional.streamJson
    ? helpUnavailable
      ? Boolean(input.provider.supportsStreamJson)
      : hasAllTokens(helpText, spec.optional.streamJson)
    : false;

  if (input.provider.supportsResume && !supportsResume) {
    warnings.push(`${input.provider.name}: resume capability was not detected and will be disabled.`);
  }
  if (input.provider.supportsOutputSchemaPath && !supportsOutputSchemaPath) {
    warnings.push(
      `${input.provider.name}: --output-schema capability was not detected, planner uses fallback parsing.`,
    );
  }
  if (input.provider.supportsJsonSchema && !supportsJsonSchema) {
    warnings.push(
      `${input.provider.name}: --json-schema capability was not detected, planner uses fallback parsing.`,
    );
  }
  if (input.provider.supportsStreamJson && !supportsStreamOutput) {
    warnings.push(
      `${input.provider.name}: stream-json capability was not detected, provider falls back to non-stream parsing.`,
    );
  }

  if (input.strict && fatalMissing.length > 0) {
    throw new Error(
      `${input.provider.name} capability probe failed in strict mode. Missing: ${fatalMissing.join(", ")}`,
    );
  }

  return {
    supportsResume,
    supportsOutputSchemaPath,
    supportsJsonSchema,
    supportsStreamOutput,
    warnings,
    fatalMissing,
  };
}
