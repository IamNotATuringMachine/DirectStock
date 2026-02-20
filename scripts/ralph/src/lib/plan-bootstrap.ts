import { type Plan } from "../planner/plan-schema.js";
import { fileExists, resolveAbsolutePath } from "./io.js";
import { isGoalFilePath, readGoalFromFile, toJsonPlanPath } from "./plan-utils.js";

export interface PlanSelectionResult {
  action: "create" | "load";
  planPath?: string;
}

export interface PlanBootstrapInput {
  cwd: string;
  dryRun: boolean;
  initialPlanPath?: string;
  initialGoalFilePath?: string;
  askGoal: () => Promise<string>;
  askPlanOutputPath: (cwd: string) => Promise<string>;
  askPlanSelection: (cwd: string) => Promise<PlanSelectionResult>;
  createPlan: (goal: string, targetPlanPath: string) => Promise<Plan>;
  loadPlan: (planPath: string) => Promise<Plan>;
  savePlan: (planPath: string, plan: Plan) => Promise<void>;
  logInfo?: (message: string) => void;
  logWarning?: (message: string) => void;
}

export interface PlanBootstrapResult {
  plan: Plan;
  planPath: string;
  goalFilePath: string;
  goalFromFile: string;
  sanitizedCount: number;
}

export async function bootstrapPlan(input: PlanBootstrapInput): Promise<PlanBootstrapResult> {
  let planPath = input.initialPlanPath ? resolveAbsolutePath(input.initialPlanPath, input.cwd) : "";
  let goalFilePath = input.initialGoalFilePath
    ? resolveAbsolutePath(input.initialGoalFilePath, input.cwd)
    : "";

  if (planPath && isGoalFilePath(planPath)) {
    if (!goalFilePath) {
      goalFilePath = planPath;
    }
    planPath = toJsonPlanPath(planPath);
    input.logWarning?.(`[ralph] Markdown/TXT detected as goal. JSON plan path set to: ${planPath}`);
  }

  const goalFromFile = goalFilePath ? await readGoalFromFile(goalFilePath) : "";
  let plan: Plan | null = null;

  if (!planPath) {
    if (goalFromFile) {
      planPath = resolveAbsolutePath(await input.askPlanOutputPath(input.cwd), input.cwd);
      plan = await input.createPlan(goalFromFile, planPath);
    } else {
      const planSelection = await input.askPlanSelection(input.cwd);
      if (planSelection.action === "load") {
        if (!planSelection.planPath) {
          throw new Error("Plan selection invalid: no path for existing plan.");
        }
        planPath = resolveAbsolutePath(planSelection.planPath, input.cwd);
      } else {
        const goal = await input.askGoal();
        planPath = resolveAbsolutePath(await input.askPlanOutputPath(input.cwd), input.cwd);
        plan = await input.createPlan(goal, planPath);
      }
    }
  }

  if (!plan) {
    if (!(await fileExists(planPath))) {
      if (!goalFromFile) {
        throw new Error(`Plan file not found: ${planPath}`);
      }
      plan = await input.createPlan(goalFromFile, planPath);
    } else {
      plan = await input.loadPlan(planPath);
    }
  }

  let sanitizedCount = 0;
  for (const step of plan.steps) {
    if (step.status === "in_progress") {
      step.status = "pending";
      sanitizedCount += 1;
    }
  }

  if (sanitizedCount > 0) {
    input.logWarning?.(
      `[ralph] ${sanitizedCount} step(s) were left in_progress from a previous interrupted run. Reset to pending.`,
    );
    if (!input.dryRun) {
      await input.savePlan(planPath, plan);
    }
  }

  input.logInfo?.(`[ralph] Plan resolved: ${planPath}`);

  return {
    plan,
    planPath,
    goalFilePath,
    goalFromFile,
    sanitizedCount,
  };
}
