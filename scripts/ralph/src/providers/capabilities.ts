import type { ProviderAdapter, ProviderId } from "./types.js";
import { runCommand } from "../lib/process.js";

export interface ProviderRuntimeCapabilities {
  supportsResume: boolean;
  supportsOutputSchemaPath: boolean;
  supportsJsonSchema: boolean;
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
    },
    helpCommand: ["exec", "--help"],
    resumeHelpCommand: ["exec", "resume", "--help"],
  },
  anthropic: {
    requiredTokens: ["--output-format", "--max-turns"],
    optional: {
      resume: ["--resume"],
      jsonSchema: ["--json-schema"],
    },
    helpCommand: ["--help"],
  },
  google: {
    requiredTokens: ["--output-format", "--approval-mode"],
    optional: {
      resume: ["--resume"],
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

async function collectHelpText(command: string, args: string[], cwd: string): Promise<string> {
  const result = await runCommand({
    command,
    args,
    cwd,
    timeoutMs: 10_000,
  });

  return `${result.stdout}\n${result.stderr}`.toLowerCase();
}

export async function probeProviderCapabilities(
  input: ProviderCapabilityProbeInput,
): Promise<ProviderCapabilityProbeResult> {
  const spec = PROBE_SPECS[input.provider.id];
  const helpText = await collectHelpText(input.provider.cliCommand, spec.helpCommand, input.cwd);
  const resumeHelpText = spec.resumeHelpCommand
    ? await collectHelpText(input.provider.cliCommand, spec.resumeHelpCommand, input.cwd)
    : helpText;

  const fatalMissing = spec.requiredTokens.filter((token) => !helpText.includes(token.toLowerCase()));
  const warnings: string[] = [];

  if (fatalMissing.length > 0) {
    warnings.push(
      `${input.provider.name}: required CLI capabilities missing: ${fatalMissing.join(", ")}`,
    );
  }

  const supportsResume = spec.optional.resume
    ? hasAllTokens(resumeHelpText, spec.optional.resume) && !indicatesUnknownCommand(resumeHelpText)
    : false;
  const supportsOutputSchemaPath = spec.optional.outputSchemaPath
    ? hasAllTokens(helpText, spec.optional.outputSchemaPath)
    : false;
  const supportsJsonSchema = spec.optional.jsonSchema ? hasAllTokens(helpText, spec.optional.jsonSchema) : false;

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

  if (input.strict && fatalMissing.length > 0) {
    throw new Error(
      `${input.provider.name} capability probe failed in strict mode. Missing: ${fatalMissing.join(", ")}`,
    );
  }

  return {
    supportsResume,
    supportsOutputSchemaPath,
    supportsJsonSchema,
    warnings,
    fatalMissing,
  };
}
