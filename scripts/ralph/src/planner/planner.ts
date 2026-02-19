import os from "node:os";
import path from "node:path";

import fs from "fs-extra";

import { extractJsonFromText } from "../lib/io.js";
import type { ProviderRuntimeCapabilities } from "../providers/capabilities.js";
import type { ProviderAdapter } from "../providers/types.js";
import {
  PlannerDraftSchema,
  type Plan,
  normalizeDraftToPlan,
  savePlan,
} from "./plan-schema.js";

export interface CreatePlanInput {
  provider: ProviderAdapter;
  model: string;
  thinkingValue: string;
  goal: string;
  planPath: string;
  cwd: string;
  timeoutMs: number;
  totalIterations: number;
  dryRun?: boolean;
  persist?: boolean;
  runtimeCapabilities?: ProviderRuntimeCapabilities;
}

const PLANNER_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["goal", "steps"],
  properties: {
    goal: { type: "string", minLength: 1 },
    steps: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description", "successCriteria"],
        properties: {
          id: { type: "string" },
          title: { type: "string", minLength: 1 },
          description: { type: "string", minLength: 1 },
          successCriteria: { type: "string", minLength: 1 },
          maxAttempts: { type: "integer", minimum: 1 },
          type: { type: "string", enum: ["code", "docs", "test", "governance", "ops", "mixed"] },
          files: { type: "array", items: { type: "string", minLength: 1 } },
          riskLevel: { type: "string", enum: ["low", "medium", "high"] },
          owner: { type: "string" },
          postChecks: { type: "array", items: { type: "string", minLength: 1 } },
          rollbackHint: { type: "string" },
        },
      },
    },
  },
} as const;

function buildPlannerPrompt(goal: string): string {
  return [
    "Du bist ein Senior Engineer. Zerlege die folgende Aufgabe in kleine, messbare Einzelschritte.",
    "",
    "Jeder Schritt muss:",
    "1. Genau eine Datei oder ein klar abgegrenztes Modul betreffen",
    "2. Ein messbares Erfolgskriterium haben",
    "3. Unabhaengig genug sein, um in einer einzelnen Agent-Session abgeschlossen zu werden",
    "",
    `Aufgabe: ${goal}`,
    "",
    "Antworte NUR mit gueltigem JSON im Format:",
    "{",
    '  "goal": "string",',
    '  "steps": [',
    "    {",
    '      "id": "optional-string",',
    '      "title": "string",',
    '      "description": "string",',
    '      "successCriteria": "string",',
    '      "maxAttempts": 3,',
    '      "type": "code|docs|test|governance|ops|mixed",',
    '      "files": ["relative/path"],',
    '      "riskLevel": "low|medium|high",',
    '      "owner": "string",',
    '      "postChecks": ["shell command"],',
    '      "rollbackHint": "string"',
    "    }",
    "  ]",
    "}",
  ].join("\n");
}

async function createOutputSchemaTempFile(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "ralph-schema-"));
  const schemaPath = path.join(directory, "planner-draft.schema.json");
  await fs.writeJson(schemaPath, PLANNER_OUTPUT_SCHEMA, { spaces: 2 });
  return schemaPath;
}

export async function createPlanFromGoal(input: CreatePlanInput): Promise<Plan> {
  const persist = input.persist ?? true;
  const capabilityState = input.runtimeCapabilities ?? {
    supportsResume: input.provider.supportsResume,
    supportsOutputSchemaPath: Boolean(input.provider.supportsOutputSchemaPath),
    supportsJsonSchema: Boolean(input.provider.supportsJsonSchema),
    supportsStreamOutput: Boolean(input.provider.supportsStreamJson),
    warnings: [],
  };

  let outputSchemaPath: string | undefined;
  if (capabilityState.supportsOutputSchemaPath) {
    outputSchemaPath = await createOutputSchemaTempFile();
  }

  if (!outputSchemaPath && !capabilityState.supportsJsonSchema) {
    console.warn(
      `[ralph planner] ${input.provider.name} hat kein natives Schema-Enforcement. Verwende Prompt+Zod-Fallback.`,
    );
  }

  try {
    const execution = await input.provider.execute({
      model: input.model,
      thinkingValue: input.thinkingValue,
      prompt: buildPlannerPrompt(input.goal),
      cwd: input.cwd,
      timeoutMs: input.timeoutMs,
      dryRun: input.dryRun,
      outputSchema: capabilityState.supportsJsonSchema ? PLANNER_OUTPUT_SCHEMA : undefined,
      outputSchemaPath,
    });

    if (!execution.ok) {
      throw new Error(
        `Plan generation failed (${execution.usedModel}): ${execution.stderr || execution.stdout || "unknown error"}`,
      );
    }

    const primaryText = (execution.responseText || execution.stdout).trim();
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(primaryText);
    } catch {
      const fallbackJsonText = extractJsonFromText(primaryText);
      if (!fallbackJsonText) {
        throw new Error("Plan generation returned no parseable JSON.");
      }

      if (fallbackJsonText !== primaryText) {
        console.warn("[ralph planner] Falling back to heuristic JSON extraction.");
      }

      try {
        parsedJson = JSON.parse(fallbackJsonText);
      } catch {
        throw new Error("Plan generation returned invalid JSON.");
      }
    }

    const draft = PlannerDraftSchema.parse(parsedJson);
    const plan = normalizeDraftToPlan({
      draft,
      provider: input.provider.name,
      model: input.model,
      totalIterations: input.totalIterations,
    });

    if (persist) {
      await savePlan(input.planPath, plan);
    }

    return plan;
  } finally {
    if (outputSchemaPath) {
      await fs.remove(path.dirname(outputSchemaPath));
    }
  }
}

export function plannerOutputSchema(): unknown {
  return PLANNER_OUTPUT_SCHEMA;
}
