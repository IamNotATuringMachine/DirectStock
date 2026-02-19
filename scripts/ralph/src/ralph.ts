import path from "node:path";
import { fileURLToPath } from "node:url";

import chalk from "chalk";
import fs from "fs-extra";
import ora from "ora";

import { loadPreset, savePreset } from "./config/preset.js";
import { readWorktreeState, type WorktreeState } from "./lib/git.js";
import { fileExists, resolveAbsolutePath } from "./lib/io.js";
import { createRunLogger, type RunLogFormat } from "./lib/run-log.js";
import { runRalphLoop } from "./loop/executor.js";
import { createPlanFromGoal } from "./planner/planner.js";
import { loadPlan, savePlan } from "./planner/plan-schema.js";
import { runPostChecks, type PostCheckProfile } from "./post-checks.js";
import { type OutputMode, type ThinkingVisibility } from "./providers/output-events.js";
import { probeProviderCapabilities } from "./providers/capabilities.js";
import { getProvider } from "./providers/index.js";
import type { ProviderId, SessionStrategy } from "./providers/types.js";
import { renderConfirmation } from "./ui/confirmation.js";
import {
  askFinalConfirmation,
  askGoal,
  askMaxIterations,
  askModel,
  askPlanSelection,
  askPlanOutputPath,
  askProvider,
  askThinking,
  askUsePreset,
} from "./ui/prompts.js";

export interface RalphCliOptions {
  provider?: ProviderId;
  model?: string;
  thinking?: string;
  yes?: boolean;
  noPreset?: boolean;
  dryRun?: boolean;
  noAutoCommit?: boolean;
  autoCommit?: boolean;
  allowDirty?: boolean;
  maxIterations?: number;
  plan?: string;
  goalFile?: string;
  sessionStrategy?: SessionStrategy;
  postCheckProfile?: PostCheckProfile;
  planTemplate?: boolean;
  logFormat?: RunLogFormat;
  runLogPath?: string;
  strictProviderCapabilities?: boolean;
  outputMode?: OutputMode;
  thinkingVisibility?: ThinkingVisibility;
}

const DEFAULT_TIMEOUT_MS = 20 * 60 * 1000;
const DEFAULT_SESSION_STRATEGY: SessionStrategy = "reset";
const DEFAULT_POST_CHECK_PROFILE: PostCheckProfile = "fast";
const DEFAULT_LOG_FORMAT: RunLogFormat = "text";
const DEFAULT_OUTPUT_MODE: OutputMode = "timeline";
const DEFAULT_THINKING_VISIBILITY: ThinkingVisibility = "summary";
const VALID_SESSION_STRATEGIES: SessionStrategy[] = ["reset", "resume"];
const VALID_POST_CHECK_PROFILES: PostCheckProfile[] = ["none", "fast", "governance", "full"];
const VALID_LOG_FORMATS: RunLogFormat[] = ["text", "jsonl"];
const VALID_OUTPUT_MODES: OutputMode[] = ["timeline", "final", "raw"];
const VALID_THINKING_VISIBILITY: ThinkingVisibility[] = ["summary", "hidden", "full"];
const PLAN_TEMPLATE_RELATIVE_PATH = path.join("docs", "guides", "ralph-plan-template.md");

export interface AutoCommitPolicyInput {
  requestedAutoCommit: boolean;
  dryRun: boolean;
  allowDirty: boolean;
  worktree: WorktreeState;
}

export interface AutoCommitPolicyOutput {
  autoCommit: boolean;
  warning?: string;
}

export function normalizeProviderModel(providerId: ProviderId, model: string): string {
  if (providerId === "google" && model === "gemini-3.0-flash-preview") {
    return "gemini-3-flash-preview";
  }
  return model;
}

export function resolveAutoCommitPolicy(input: AutoCommitPolicyInput): AutoCommitPolicyOutput {
  if (!input.requestedAutoCommit || input.dryRun) {
    return { autoCommit: input.requestedAutoCommit };
  }

  if (!input.worktree.available) {
    return {
      autoCommit: false,
      warning: `[ralph] git status fehlgeschlagen (${input.worktree.error || "unknown error"}). Auto-Commit wird deaktiviert.`,
    };
  }

  if (input.worktree.dirty && !input.allowDirty) {
    return {
      autoCommit: false,
      warning:
        "[ralph] Working tree is dirty. Loop läuft weiter, Auto-Commit wird deaktiviert. Nutze --allow-dirty, um trotzdem automatisch zu committen.",
    };
  }

  return { autoCommit: true };
}

export async function runRalph(options: RalphCliOptions): Promise<void> {
  const cwd = process.cwd();
  const dryRun = Boolean(options.dryRun);
  const allowDirty = Boolean(options.allowDirty);
  const autoCommit = options.autoCommit === false ? false : !options.noAutoCommit;
  const requestedSessionStrategy = coerceSessionStrategy(options.sessionStrategy);
  const postCheckProfile = coercePostCheckProfile(options.postCheckProfile);
  const logFormat = coerceLogFormat(options.logFormat);
  const outputMode = coerceOutputMode(options.outputMode);
  const thinkingVisibility = coerceThinkingVisibility(options.thinkingVisibility);
  const strictProviderCapabilities = Boolean(options.strictProviderCapabilities);

  if (options.planTemplate) {
    const templatePath = await resolvePlanTemplatePath(cwd);
    console.log(await fs.readFile(templatePath, "utf8"));
    return;
  }

  let providerId: ProviderId | null = coerceProviderId(options.provider);
  let model = options.model ?? "";
  let thinkingValue = options.thinking ?? "";
  let maxIterations = options.maxIterations;
  let planPath = options.plan ? resolveAbsolutePath(options.plan, cwd) : "";
  let goalFilePath = options.goalFile ? resolveAbsolutePath(options.goalFile, cwd) : "";

  if (planPath && isGoalFilePath(planPath)) {
    if (!goalFilePath) {
      goalFilePath = planPath;
    }
    planPath = toJsonPlanPath(planPath);
    console.log(
      chalk.yellow(`[ralph] Markdown/TXT als Ziel erkannt. JSON-Planpfad gesetzt auf: ${planPath}`),
    );
  }

  const preset = !options.noPreset ? await loadPreset() : null;
  if (preset && !providerId && !model && !thinkingValue && (await askUsePreset(preset))) {
    providerId = preset.provider;
    model = preset.model;
    thinkingValue = preset.thinkingValue;
    maxIterations = maxIterations ?? preset.maxIterations;
    if (!planPath) {
      planPath = preset.planPath;
    }
  }

  if (!providerId) {
    providerId = await askProvider();
  }

  const provider = getProvider(providerId);
  if (!(await provider.isInstalled())) {
    throw new Error(`${provider.cliCommand} CLI ist nicht installiert oder nicht im PATH verfügbar.`);
  }

  if (model) {
    const normalizedModel = normalizeProviderModel(providerId, model);
    if (normalizedModel !== model) {
      console.log(chalk.yellow(`[ralph] Modell-ID korrigiert: ${model} -> ${normalizedModel}`));
      model = normalizedModel;
    }
  }

  const capabilityProbe = await probeProviderCapabilities({
    provider,
    cwd,
    strict: strictProviderCapabilities,
  });
  for (const warning of capabilityProbe.warnings) {
    console.log(chalk.yellow(`[ralph capabilities] ${warning}`));
  }

  let sessionStrategy = requestedSessionStrategy;
  if (sessionStrategy === "resume" && (!provider.supportsResume || !capabilityProbe.supportsResume)) {
    if (strictProviderCapabilities) {
      throw new Error(`${provider.name} unterstützt Session-Resume in dieser Umgebung nicht.`);
    }
    console.log(chalk.yellow(`[ralph capabilities] Session-Resume deaktiviert. Fallback auf reset.`));
    sessionStrategy = "reset";
  }

  let providerStreamingEnabled = Boolean(provider.supportsStreamJson);
  if (providerStreamingEnabled && !capabilityProbe.supportsStreamOutput) {
    providerStreamingEnabled = false;
    console.log(
      chalk.yellow(`[ralph capabilities] Streaming output für ${provider.name} nicht verfügbar. Fallback aktiv.`),
    );
  }

  if (!model) {
    model = await askModel(provider);
    const normalizedModel = normalizeProviderModel(providerId, model);
    if (normalizedModel !== model) {
      console.log(chalk.yellow(`[ralph] Modell-ID korrigiert: ${model} -> ${normalizedModel}`));
      model = normalizedModel;
    }
  }

  if (!thinkingValue) {
    thinkingValue = await askThinking(provider);
  }

  const createPlan = async (goal: string, targetPlanPath: string) => {
    const spinner = ora("Erstelle Plan...").start();
    try {
      const generatedPlan = await createPlanFromGoal({
        provider,
        model,
        thinkingValue,
        goal,
        planPath: targetPlanPath,
        cwd,
        timeoutMs: DEFAULT_TIMEOUT_MS,
        totalIterations: maxIterations ?? 10,
        dryRun: false,
        persist: !dryRun,
        runtimeCapabilities: capabilityProbe,
      });
      spinner.succeed(
        dryRun ? "Plan für Dry-Run im Speicher erzeugt" : `Plan gespeichert: ${targetPlanPath}`,
      );
      return generatedPlan;
    } catch (error) {
      spinner.fail("Plan-Erstellung fehlgeschlagen");
      throw error;
    }
  };

  let plan = null;
  const goalFromFile = goalFilePath ? await readGoalFromFile(goalFilePath) : "";

  if (!planPath) {
    if (goalFromFile) {
      planPath = resolveAbsolutePath(await askPlanOutputPath(cwd), cwd);
      plan = await createPlan(goalFromFile, planPath);
    } else {
      const planSelection = await askPlanSelection(cwd);
      if (planSelection.action === "load") {
        if (!planSelection.planPath) {
          throw new Error("Plan-Auswahl ungültig: kein Pfad für bestehenden Plan.");
        }
        planPath = resolveAbsolutePath(planSelection.planPath ?? "", cwd);
      } else {
        const goal = await askGoal();
        planPath = resolveAbsolutePath(await askPlanOutputPath(cwd), cwd);
        plan = await createPlan(goal, planPath);
      }
    }
  }

  if (!plan) {
    if (!(await fileExists(planPath))) {
      if (!goalFromFile) {
        throw new Error(`Plan-Datei nicht gefunden: ${planPath}`);
      }
      plan = await createPlan(goalFromFile, planPath);
    } else {
      plan = await loadPlan(planPath);
    }
  }

  // Sanitize stale in_progress steps from interrupted runs
  let sanitizedCount = 0;
  for (const step of plan.steps) {
    if (step.status === "in_progress") {
      step.status = "pending";
      sanitizedCount += 1;
    }
  }
  if (sanitizedCount > 0) {
    console.log(
      chalk.yellow(
        `[ralph] ${sanitizedCount} step(s) were left in_progress from a previous interrupted run. Reset to pending.`,
      ),
    );
    if (!dryRun) {
      await savePlan(planPath, plan);
    }
  }

  if (!maxIterations) {
    maxIterations = await askMaxIterations(plan.metadata.totalIterations || 10);
  }

  if (!dryRun) {
    plan.metadata.totalIterations = maxIterations;
    await savePlan(planPath, plan);
  }

  const runLogger = await createRunLogger({
    cwd,
    provider: provider.name,
    model,
    format: logFormat,
    runLogPath: options.runLogPath,
  });

  let effectiveAutoCommit = autoCommit;
  if (!dryRun && autoCommit) {
    const policy = resolveAutoCommitPolicy({
      requestedAutoCommit: autoCommit,
      dryRun,
      allowDirty,
      worktree: await readWorktreeState(cwd),
    });
    effectiveAutoCommit = policy.autoCommit;
    if (policy.warning) {
      console.log(chalk.yellow(policy.warning));
    }
  }

  console.log(
    renderConfirmation({
      provider: provider.name,
      model,
      thinking: thinkingValue,
      planPath,
      stepCount: plan.steps.length,
      maxIterations,
      workingDir: cwd,
      dryRun,
      autoCommit: effectiveAutoCommit,
      sessionStrategy,
      postCheckProfile,
      logFormat,
      runLogPath: runLogger.filePath,
      strictProviderCapabilities,
      outputMode,
      thinkingVisibility,
    }),
  );

  const approved = options.yes ? true : await askFinalConfirmation();
  if (!approved) {
    await runLogger.log({
      event: "run_finished",
      details: "status=aborted_by_user",
    });
    console.log(chalk.yellow("Abgebrochen."));
    console.log(chalk.cyan(`Run log: ${path.relative(cwd, runLogger.filePath) || runLogger.filePath}`));
    return;
  }

  if (!dryRun) {
    await savePreset({
      provider: provider.id,
      model,
      thinkingValue,
      planPath,
      maxIterations,
      savedAt: new Date().toISOString(),
    });
  }

  await runLogger.log({
    event: "run_started",
    details: `plan=${planPath};dryRun=${dryRun};postCheckProfile=${postCheckProfile};sessionStrategy=${sessionStrategy};autoCommit=${effectiveAutoCommit};outputMode=${outputMode};thinkingVisibility=${thinkingVisibility}`,
    maxIterations,
    sessionId: sessionStrategy === "resume" ? plan.metadata.resumeSessionId : undefined,
  });

  const spinner = ora("Starte Ralph Loop...").start();
  spinner.stop();

  const summary = await runRalphLoop({
    provider,
    model,
    thinkingValue,
    planPath,
    plan,
    maxIterations,
    workingDir: cwd,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    dryRun,
    autoCommit: effectiveAutoCommit,
    sessionStrategy,
    providerStreamingEnabled,
    outputMode,
    thinkingVisibility,
    initialResumeSessionId:
      sessionStrategy === "resume" ? plan.metadata.resumeSessionId : undefined,
    runLogger,
  });

  console.log(chalk.green(`\nRalph Loop abgeschlossen. Iterationen: ${summary.iterationsRun}`));
  console.log(chalk.green(`Done steps: ${summary.completedSteps}`));
  if (summary.failedSteps > 0) {
    console.log(chalk.red(`Failed steps: ${summary.failedSteps}`));
  }

  try {
    await runPostChecks({
      profile: postCheckProfile,
      cwd,
      dryRun,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await runLogger.log({
      event: "post_check_failed",
      details: message,
    });
    await runLogger.log({
      event: "run_finished",
      details: `status=failed;completed=${summary.completedSteps};failed=${summary.failedSteps};iterations=${summary.iterationsRun}`,
    });
    throw error;
  }

  await runLogger.log({
    event: "run_finished",
    details: `status=success;completed=${summary.completedSteps};failed=${summary.failedSteps};iterations=${summary.iterationsRun}`,
  });

  console.log(chalk.cyan(`Plan: ${path.relative(cwd, planPath) || planPath}`));
  console.log(chalk.cyan(`Run log: ${path.relative(cwd, runLogger.filePath) || runLogger.filePath}`));
}

function coerceSessionStrategy(value?: string): SessionStrategy {
  if (!value) {
    return DEFAULT_SESSION_STRATEGY;
  }
  if (VALID_SESSION_STRATEGIES.includes(value as SessionStrategy)) {
    return value as SessionStrategy;
  }
  throw new Error(`Ungültige session strategy: ${value}`);
}

function coerceProviderId(value?: string): ProviderId | null {
  if (!value) {
    return null;
  }
  if (value === "openai" || value === "anthropic" || value === "google") {
    return value;
  }
  throw new Error(`Ungültiger provider: ${value}`);
}

function coercePostCheckProfile(value?: string): PostCheckProfile {
  if (!value) {
    return DEFAULT_POST_CHECK_PROFILE;
  }
  if (VALID_POST_CHECK_PROFILES.includes(value as PostCheckProfile)) {
    return value as PostCheckProfile;
  }
  throw new Error(`Ungültiges post-check profile: ${value}`);
}

function coerceLogFormat(value?: string): RunLogFormat {
  if (!value) {
    return DEFAULT_LOG_FORMAT;
  }
  if (VALID_LOG_FORMATS.includes(value as RunLogFormat)) {
    return value as RunLogFormat;
  }
  throw new Error(`Ungültiges log format: ${value}`);
}

function coerceOutputMode(value?: string): OutputMode {
  if (!value) {
    return DEFAULT_OUTPUT_MODE;
  }
  if (VALID_OUTPUT_MODES.includes(value as OutputMode)) {
    return value as OutputMode;
  }
  throw new Error(`Ungültiger output mode: ${value}`);
}

function coerceThinkingVisibility(value?: string): ThinkingVisibility {
  if (!value) {
    return DEFAULT_THINKING_VISIBILITY;
  }
  if (VALID_THINKING_VISIBILITY.includes(value as ThinkingVisibility)) {
    return value as ThinkingVisibility;
  }
  throw new Error(`Ungültige thinking visibility: ${value}`);
}

async function resolvePlanTemplatePath(cwd: string): Promise<string> {
  const candidates = new Set<string>();

  let cursor = path.resolve(cwd);
  while (true) {
    candidates.add(path.join(cursor, PLAN_TEMPLATE_RELATIVE_PATH));
    const parent = path.dirname(cursor);
    if (parent === cursor) {
      break;
    }
    cursor = parent;
  }

  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  cursor = moduleDir;
  while (true) {
    candidates.add(path.join(cursor, PLAN_TEMPLATE_RELATIVE_PATH));
    const parent = path.dirname(cursor);
    if (parent === cursor) {
      break;
    }
    cursor = parent;
  }

  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Template-Datei nicht gefunden. Erwarteter Pfad: ${PLAN_TEMPLATE_RELATIVE_PATH}`);
}

function isGoalFilePath(filePath: string): boolean {
  return /\.(md|markdown|txt)$/i.test(filePath);
}

function toJsonPlanPath(filePath: string): string {
  if (/\.[^./\\]+$/.test(filePath)) {
    return filePath.replace(/\.[^./\\]+$/, ".json");
  }
  return `${filePath}.json`;
}

async function readGoalFromFile(goalFilePath: string): Promise<string> {
  if (!(await fileExists(goalFilePath))) {
    throw new Error(`Goal-Datei nicht gefunden: ${goalFilePath}`);
  }

  const goal = (await fs.readFile(goalFilePath, "utf8")).trim();
  if (!goal) {
    throw new Error(`Goal-Datei ist leer: ${goalFilePath}`);
  }

  return goal;
}
