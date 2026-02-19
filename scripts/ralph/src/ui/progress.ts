import chalk from "chalk";

import type { Plan, Step } from "../planner/plan-schema.js";
import type { SessionStrategy } from "../providers/types.js";

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function normalizeInline(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function truncateInline(text: string, maxLen = 160): string {
  const normalized = normalizeInline(text);
  return normalized.length > maxLen ? `${normalized.slice(0, maxLen - 3)}...` : normalized;
}

function printRuntimeState(line: string, tone: "info" | "ok" | "warn" | "error" = "info"): void {
  if (tone === "ok") {
    console.log(chalk.green(line));
    return;
  }
  if (tone === "warn") {
    console.log(chalk.yellow(line));
    return;
  }
  if (tone === "error") {
    console.log(chalk.red(line));
    return;
  }
  console.log(chalk.blue(line));
}

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
  if (
    text.includes("model_unavailable") ||
    text.includes("model unavailable") ||
    text.includes("model not found") ||
    text.includes("unknown model") ||
    text.includes("invalid model")
  ) {
    return "model_unavailable";
  }
  if (text.includes("parseable json") || text.includes("invalid json")) {
    return "planner_json";
  }
  if (text.includes("permission") || text.includes("approval")) {
    return "permissions";
  }
  return "provider_or_criteria";
}

export function printProviderAttemptStart(args: {
  step: Step;
  model: string;
  attempt: number;
  maxAttempts: number;
  timeoutMs: number;
  sessionStrategy: SessionStrategy;
  resumeSessionId?: string;
}): void {
  printRuntimeState(
    `[status] ${args.step.id} provider:start model=${args.model} attempt=${args.attempt}/${args.maxAttempts} timeout=${formatDuration(args.timeoutMs)} session=${args.sessionStrategy}${args.resumeSessionId ? `(${args.resumeSessionId})` : ""}`,
  );
}

export function printProviderHeartbeat(args: {
  step: Step;
  model: string;
  attempt: number;
  elapsedMs: number;
  timeoutMs: number;
}): void {
  printRuntimeState(
    `[status] ${args.step.id} provider:thinking model=${args.model} attempt=${args.attempt} elapsed=${formatDuration(args.elapsedMs)} timeout=${formatDuration(args.timeoutMs)}`,
  );
}

export function printProviderAttemptDone(args: {
  step: Step;
  model: string;
  attempt: number;
  ok: boolean;
  timedOut: boolean;
  modelUnavailable?: boolean;
  exitCode: number | null;
  durationMs: number;
  sessionId?: string;
}): void {
  const state = args.ok
    ? "ok"
    : args.modelUnavailable
      ? "model_unavailable"
      : args.timedOut
        ? "timeout"
        : "error";
  const exit = args.exitCode === null ? "unknown" : String(args.exitCode);
  printRuntimeState(
    `[status] ${args.step.id} provider:done model=${args.model} attempt=${args.attempt} state=${state} exit=${exit} elapsed=${formatDuration(args.durationMs)}${args.sessionId ? ` session=${args.sessionId}` : ""}`,
    args.ok ? "ok" : "error",
  );
}

export function printRetryScheduled(args: {
  step: Step;
  model: string;
  attempt: number;
  delayMs: number;
  reason: string;
}): void {
  printRuntimeState(
    `[status] ${args.step.id} provider:retry model=${args.model} attempt=${args.attempt} delay=${formatDuration(args.delayMs)} reason=${truncateInline(args.reason)}`,
    "warn",
  );
}

export function printSuccessCriteriaStart(args: { step: Step; command: string }): void {
  printRuntimeState(
    `[status] ${args.step.id} check:start success_criteria command="${truncateInline(args.command, 180)}"`,
  );
}

export function printSuccessCriteriaDone(args: {
  step: Step;
  passed: boolean;
  durationMs: number;
}): void {
  printRuntimeState(
    `[status] ${args.step.id} check:done success_criteria result=${args.passed ? "pass" : "fail"} elapsed=${formatDuration(args.durationMs)}`,
    args.passed ? "ok" : "error",
  );
}

export function printStepPostChecksStart(args: { step: Step; total: number }): void {
  printRuntimeState(`[status] ${args.step.id} post_checks:start total=${args.total}`);
}

export function printStepPostCheckResult(args: {
  step: Step;
  command: string;
  index: number;
  total: number;
  passed: boolean;
  durationMs: number;
}): void {
  printRuntimeState(
    `[status] ${args.step.id} post_checks:command index=${args.index}/${args.total} result=${args.passed ? "pass" : "fail"} elapsed=${formatDuration(args.durationMs)} command="${truncateInline(args.command, 160)}"`,
    args.passed ? "ok" : "error",
  );
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
