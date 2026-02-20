import { z } from "zod";

import { readJsonFile, writeJsonFile } from "../lib/io.js";

export const PLAN_SCHEMA_VERSION = "1.1.0" as const;

export const StepStatusSchema = z.enum(["pending", "in_progress", "done", "failed"]);
export const StepTypeSchema = z.enum(["code", "docs", "test", "governance", "ops", "mixed"]);
export const StepRiskLevelSchema = z.enum(["low", "medium", "high"]);

export const StepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  successCriteria: z.string().min(1),
  status: StepStatusSchema,
  attempts: z.number().int().min(0).default(0),
  maxAttempts: z.number().int().min(1).default(3),
  lastError: z.string().optional(),
  type: StepTypeSchema,
  files: z.array(z.string().min(1)),
  riskLevel: StepRiskLevelSchema,
  owner: z.string().min(1),
  postChecks: z.array(z.string().min(1)),
  rollbackHint: z.string(),
});

export const PlanMetadataSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  totalIterations: z.number().int().min(1),
  completedIterations: z.number().int().min(0).default(0),
  resumeSessionId: z.string().min(1).optional(),
});

export const PlanSchema = z.object({
  schemaVersion: z.literal(PLAN_SCHEMA_VERSION),
  goal: z.string().min(1),
  createdAt: z.string().min(1),
  systemPrompt: z.string().min(1).optional(),
  steps: z.array(StepSchema).min(1),
  metadata: PlanMetadataSchema,
});

export const PlannerDraftStepSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  successCriteria: z.string().min(1),
  maxAttempts: z.number().int().min(1).optional(),
  type: StepTypeSchema.optional(),
  files: z.array(z.string().min(1)).optional(),
  riskLevel: StepRiskLevelSchema.optional(),
  owner: z.string().min(1).optional(),
  postChecks: z.array(z.string().min(1)).optional(),
  rollbackHint: z.string().optional(),
});

export const PlannerDraftSchema = z.object({
  goal: z.string().min(1),
  steps: z.array(PlannerDraftStepSchema).min(1),
});

const LegacyStepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  successCriteria: z.string().min(1),
  status: StepStatusSchema,
  attempts: z.number().int().min(0).default(0),
  maxAttempts: z.number().int().min(1).default(3),
  lastError: z.string().optional(),
});

const LegacyPlanSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  goal: z.string().min(1),
  createdAt: z.string().min(1),
  steps: z.array(LegacyStepSchema).min(1),
  metadata: PlanMetadataSchema,
});

export type Step = z.infer<typeof StepSchema>;
export type Plan = z.infer<typeof PlanSchema>;
export type PlannerDraft = z.infer<typeof PlannerDraftSchema>;

function defaultStepExtensions(): Pick<Step, "type" | "files" | "riskLevel" | "owner" | "postChecks" | "rollbackHint"> {
  return {
    type: "code",
    files: [],
    riskLevel: "medium",
    owner: "unassigned",
    postChecks: [],
    rollbackHint: "Revert the commit for this step.",
  };
}

function migrateLegacyPlan(raw: z.infer<typeof LegacyPlanSchema>): Plan {
  return {
    schemaVersion: PLAN_SCHEMA_VERSION,
    goal: raw.goal,
    createdAt: raw.createdAt,
    metadata: raw.metadata,
    steps: raw.steps.map((step) => ({
      ...step,
      ...defaultStepExtensions(),
    })),
  };
}

export function parsePlan(raw: unknown): Plan {
  const current = PlanSchema.safeParse(raw);
  if (current.success) {
    return current.data;
  }

  const legacy = LegacyPlanSchema.safeParse(raw);
  if (legacy.success) {
    return migrateLegacyPlan(legacy.data);
  }

  throw current.error;
}

export async function loadPlan(planPath: string): Promise<Plan> {
  const payload = await readJsonFile<unknown>(planPath);
  return parsePlan(payload);
}

export async function savePlan(planPath: string, plan: Plan): Promise<void> {
  const parsed = PlanSchema.parse(plan);
  await writeJsonFile(planPath, parsed);
}

export function normalizeDraftToPlan(args: {
  draft: PlannerDraft;
  provider: string;
  model: string;
  totalIterations: number;
  createdAt?: string;
}): Plan {
  const createdAt = args.createdAt ?? new Date().toISOString();

  return {
    schemaVersion: PLAN_SCHEMA_VERSION,
    goal: args.draft.goal,
    createdAt,
    steps: args.draft.steps.map((step, index) => ({
      id: step.id?.trim() ? step.id : `step-${String(index + 1).padStart(2, "0")}`,
      title: step.title,
      description: step.description,
      successCriteria: step.successCriteria,
      status: "pending",
      attempts: 0,
      maxAttempts: step.maxAttempts ?? 3,
      lastError: undefined,
      type: step.type ?? "code",
      files: step.files ?? [],
      riskLevel: step.riskLevel ?? "medium",
      owner: step.owner ?? "unassigned",
      postChecks: step.postChecks ?? [],
      rollbackHint: step.rollbackHint ?? "Revert the commit for this step.",
    })),
    metadata: {
      provider: args.provider,
      model: args.model,
      totalIterations: args.totalIterations,
      completedIterations: 0,
    },
  };
}
