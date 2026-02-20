import path from "node:path";

import { confirm, input, select } from "@inquirer/prompts";
import fs from "fs-extra";

import { CUSTOM_MODEL_VALUE, PROVIDER_LABELS } from "../config/models.js";
import type { RalphPreset } from "../config/preset.js";
import type { ProviderAdapter, ProviderId } from "../providers/types.js";

export interface PlanSelectionResult {
  action: "create" | "load";
  planPath?: string;
}

export async function askUsePreset(preset: RalphPreset): Promise<boolean> {
  return confirm({
    message: `Use last preset? (${preset.provider}, ${preset.model}, ${preset.maxIterations} iterations)`,
    default: true,
  });
}

export async function askProvider(): Promise<ProviderId> {
  return select<ProviderId>({
    message: "Provider:",
    choices: [
      { name: "Anthropic (Claude Code)", value: "anthropic" },
      { name: "Google (Gemini CLI)", value: "google" },
      { name: "Google (Native API via Key)", value: "google-api" },
      { name: "OpenAI (Codex CLI)", value: "openai" },
    ],
  });
}

export async function askModel(adapter: ProviderAdapter): Promise<string> {
  const selected = await select<string>({
    message: "Select model:",
    choices: [
      ...adapter.models.map((model) => ({
        value: model.value,
        name: model.tag ? `${model.label} (${model.tag})` : model.label,
      })),
      { value: CUSTOM_MODEL_VALUE, name: "Enter custom model" },
    ],
    default: adapter.defaultModel,
  });

  if (selected !== CUSTOM_MODEL_VALUE) {
    return selected;
  }

  return input({ message: "Custom Model:", validate: nonEmpty });
}

export async function askThinking(adapter: ProviderAdapter): Promise<string> {
  const selected = await select<string>({
    message: "Thinking/reasoning configuration:",
    choices: [
      ...adapter.thinkingOptions.map((option) => ({
        value: option.value,
        name: option.label,
      })),
      { value: "__custom__", name: "Enter custom value" },
    ],
    default: adapter.defaultThinking,
  });

  if (selected !== "__custom__") {
    return selected;
  }

  return input({ message: "Custom thinking value:", validate: nonEmpty });
}

export async function listPlanCandidates(cwd: string): Promise<string[]> {
  const entries = await fs.readdir(cwd);
  return entries
    .filter((entry) => /\.json$/i.test(entry))
    .filter((entry) => /(plan|prd|ralph|task|roadmap)/i.test(entry))
    .sort()
    .map((entry) => path.join(cwd, entry));
}

export async function askPlanSelection(cwd: string): Promise<PlanSelectionResult> {
  const candidates = await listPlanCandidates(cwd);

  if (candidates.length === 0) {
    return { action: "create" };
  }

  const selected = await select<string>({
    message:
      candidates.length > 1
        ? "Multiple plan files found. Which one do you want to use?"
        : "Plan file found. How do you want to proceed?",
    choices: [
      ...candidates.map((candidate) => ({
        value: candidate,
        name: path.basename(candidate),
      })),
      { value: "__create__", name: "Create new plan" },
      { value: "__manual__", name: "Enter path manually" },
    ],
    default: candidates[0],
  });

  if (selected === "__create__") {
    return { action: "create" };
  }

  if (selected === "__manual__") {
    return { action: "load", planPath: await askManualPlanPath() };
  }

  return { action: "load", planPath: selected };
}

export async function askGoal(): Promise<string> {
  return input({
    message: "Describe the goal:",
    validate: nonEmpty,
  });
}

export async function askPlanOutputPath(cwd: string): Promise<string> {
  const defaultPath = path.join(cwd, "ralph-plan.json");
  return input({
    message: "Path for new plan:",
    default: defaultPath,
    validate: nonEmpty,
  });
}

export async function askExistingPlanPath(cwd: string): Promise<string> {
  const candidates = (await listPlanCandidates(cwd)).map((candidate) => path.basename(candidate));

  const choices = candidates.map((candidate) => ({
    value: path.join(cwd, candidate),
    name: candidate,
  }));

  choices.push({
    value: "__manual__",
    name: "Enter path manually",
  });

  const selected = await select<string>({
    message: "Select plan file:",
    choices,
  });

  if (selected !== "__manual__") {
    return selected;
  }

  return input({
    message: "Plan path:",
    validate: nonEmpty,
  });
}

export async function askMaxIterations(defaultValue = 10): Promise<number> {
  const raw = await input({
    message: "Maximum iterations:",
    default: String(defaultValue),
    validate: (value) => {
      const num = Number(value);
      if (!Number.isInteger(num) || num < 1 || num > 100) {
        return "Please enter an integer between 1 and 100.";
      }
      return true;
    },
  });

  return Number(raw);
}

export async function askFinalConfirmation(): Promise<boolean> {
  return confirm({ message: "Everything correct? Start run?", default: true });
}

function nonEmpty(value: string): true | string {
  return value.trim().length > 0 ? true : "Value must not be empty.";
}

export async function askAuthMethod(
  providerName: string,
  hasStoredKey: boolean,
): Promise<"stored" | "new" | "skip"> {
  const choices = [];
  if (hasStoredKey) {
    choices.push({ value: "stored" as const, name: `Use saved API key for ${providerName}` });
  }
  choices.push({ value: "new" as const, name: "Enter a new API key" });
  choices.push({ value: "skip" as const, name: "Continue without API key (use CLI login/default)" });

  return select<"stored" | "new" | "skip">({
    message: `Authentication for ${providerName}:`,
    choices,
    default: hasStoredKey ? "stored" : "new",
  });
}

export async function askApiKey(providerName: string): Promise<string> {
  return input({
    message: `Enter API key for ${providerName}:`,
    validate: nonEmpty,
  });
}

async function askManualPlanPath(): Promise<string> {
  return input({
    message: "Plan path:",
    validate: nonEmpty,
  });
}
