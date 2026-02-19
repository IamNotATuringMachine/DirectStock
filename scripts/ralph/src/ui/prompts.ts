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
    message: `Letztes Preset verwenden? (${preset.provider}, ${preset.model}, ${preset.maxIterations} Iterationen)`,
    default: true,
  });
}

export async function askProvider(): Promise<ProviderId> {
  return select<ProviderId>({
    message: "Provider & Agenten-CLI auswählen:",
    choices: [
      { value: "anthropic", name: PROVIDER_LABELS.anthropic },
      { value: "openai", name: PROVIDER_LABELS.openai },
      { value: "google", name: PROVIDER_LABELS.google },
    ],
  });
}

export async function askModel(adapter: ProviderAdapter): Promise<string> {
  const selected = await select<string>({
    message: "Modell auswählen:",
    choices: [
      ...adapter.models.map((model) => ({
        value: model.value,
        name: model.tag ? `${model.label} (${model.tag})` : model.label,
      })),
      { value: CUSTOM_MODEL_VALUE, name: "Custom Model eingeben" },
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
    message: "Thinking/Reasoning Konfiguration:",
    choices: [
      ...adapter.thinkingOptions.map((option) => ({
        value: option.value,
        name: option.label,
      })),
      { value: "__custom__", name: "Custom Wert eingeben" },
    ],
    default: adapter.defaultThinking,
  });

  if (selected !== "__custom__") {
    return selected;
  }

  return input({ message: "Custom Thinking-Wert:", validate: nonEmpty });
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
        ? "Mehrere Plan-Dateien gefunden. Welche möchtest du verwenden?"
        : "Plan-Datei gefunden. Wie möchtest du fortfahren?",
    choices: [
      ...candidates.map((candidate) => ({
        value: candidate,
        name: path.basename(candidate),
      })),
      { value: "__create__", name: "Neuen Plan erstellen" },
      { value: "__manual__", name: "Pfad manuell eingeben" },
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
    message: "Beschreibe das Ziel:",
    validate: nonEmpty,
  });
}

export async function askPlanOutputPath(cwd: string): Promise<string> {
  const defaultPath = path.join(cwd, "ralph-plan.json");
  return input({
    message: "Pfad für neuen Plan:",
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
    name: "Pfad manuell eingeben",
  });

  const selected = await select<string>({
    message: "Plan-Datei auswählen:",
    choices,
  });

  if (selected !== "__manual__") {
    return selected;
  }

  return input({
    message: "Plan-Pfad:",
    validate: nonEmpty,
  });
}

export async function askMaxIterations(defaultValue = 10): Promise<number> {
  const raw = await input({
    message: "Maximale Iterationen:",
    default: String(defaultValue),
    validate: (value) => {
      const num = Number(value);
      if (!Number.isInteger(num) || num < 1 || num > 100) {
        return "Bitte eine Ganzzahl zwischen 1 und 100 eingeben.";
      }
      return true;
    },
  });

  return Number(raw);
}

export async function askFinalConfirmation(): Promise<boolean> {
  return confirm({ message: "Alles korrekt? Starten?", default: true });
}

function nonEmpty(value: string): true | string {
  return value.trim().length > 0 ? true : "Wert darf nicht leer sein.";
}

async function askManualPlanPath(): Promise<string> {
  return input({
    message: "Plan-Pfad:",
    validate: nonEmpty,
  });
}
