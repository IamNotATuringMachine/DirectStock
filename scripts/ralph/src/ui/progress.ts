import chalk from "chalk";

import type { Plan, Step } from "../planner/plan-schema.js";
import type { SessionStrategy } from "../providers/types.js";

export function printIterationHeader(args: {
  iteration: number;
  maxIterations: number;
  step: Step;
  sessionStrategy: SessionStrategy;
  resumeSessionId?: string;
}): void {
  const timestamp = new Date().toISOString();
  console.log(chalk.cyan(`\n[RALPH] ${timestamp} | Iteration ${args.iteration}/${args.maxIterations}`));
  console.log(
    chalk.dim(
      `Session: ${args.sessionStrategy}${args.resumeSessionId ? ` (${args.resumeSessionId})` : ""}`,
    ),
  );
  console.log(chalk.white(`Step: ${args.step.id} - ${args.step.title}`));
}

export function printPlanProgress(plan: Plan, currentStepId?: string): void {
  for (const step of plan.steps) {
    const marker = step.status === "done" ? "x" : step.status === "in_progress" ? "/" : " ";
    const isCurrent = currentStepId && step.id === currentStepId ? " <- current" : "";
    console.log(`[${marker}] ${step.id}: ${step.title}${isCurrent}`);
  }
}

function classifyError(info: string): string {
  const text = info.toLowerCase();
  if (text.includes("timed out") || text.includes("timeout")) {
    return "timeout";
  }
  if (
    text.includes("429") ||
    text.includes("rate limit") ||
    text.includes("resource_exhausted") ||
    text.includes("model_capacity_exhausted")
  ) {
    return "rate_limit";
  }
  if (text.includes("post-check")) {
    return "post_check";
  }
  if (text.includes("parseable json") || text.includes("invalid json")) {
    return "planner_json";
  }
  if (text.includes("permission") || text.includes("approval")) {
    return "permissions";
  }
  return "provider_or_criteria";
}

export function printIterationResult(args: {
  step: Step;
  passed: boolean;
  attempts: number;
  maxAttempts: number;
  info?: string;
  durationMs?: number;
}): void {
  if (args.passed) {
    console.log(
      chalk.green(
        `PASS ${args.step.id}: ${args.step.title}${args.durationMs ? ` (${args.durationMs}ms)` : ""}`,
      ),
    );
  } else {
    const errorClass = args.info ? classifyError(args.info) : "unknown";
    console.log(
      chalk.red(
        `FAIL ${args.step.id}: ${args.step.title} (attempt ${args.attempts}/${args.maxAttempts}, class=${errorClass}${args.durationMs ? `, ${args.durationMs}ms` : ""})`,
      ),
    );
  }

  if (args.info) {
    console.log(chalk.dim(args.info));
  }
}
