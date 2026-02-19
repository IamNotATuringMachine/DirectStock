import path from "node:path";
import { fileURLToPath } from "node:url";

import chalk from "chalk";
import fs from "fs-extra";
import ora from "ora";

import { loadPreset, savePreset } from "./config/preset.js";
import { ensureCleanWorktree } from "./lib/git.js";
import { fileExists, resolveAbsolutePath } from "./lib/io.js";
import { createRunLogger, type RunLogFormat } from "./lib/run-log.js";
import { runRalphLoop } from "./loop/executor.js";
import { createPlanFromGoal } from "./planner/planner.js";
import { loadPlan, savePlan } from "./planner/plan-schema.js";
import { runPostChecks, type PostCheckProfile } from "./post-checks.js";
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
  noPreset?: boolean;
  dryRun?: boolean;
  noAutoCommit?: boolean;
  allowDirty?: boolean;
  maxIterations?: number;
  plan?: string;
  sessionStrategy?: SessionStrategy;
  postCheckProfile?: PostCheckProfile;
  planTemplate?: boolean;
  logFormat?: RunLogFormat;
  runLogPath?: string;
  strictProviderCapabilities?: boolean;
}

const DEFAULT_TIMEOUT_MS = 20 * 60 * 1000;
const DEFAULT_SESSION_STRATEGY: SessionStrategy = "reset";
const DEFAULT_POST_CHECK_PROFILE: PostCheckProfile = "fast";
const DEFAULT_LOG_FORMAT: RunLogFormat = "text";
const VALID_SESSION_STRATEGIES: SessionStrategy[] = ["reset", "resume"];
const VALID_POST_CHECK_PROFILES: PostCheckProfile[] = ["none", "fast", "governance", "full"];
const VALID_LOG_FORMATS: RunLogFormat[] = ["text", "jsonl"];
const PLAN_TEMPLATE_RELATIVE_PATH = path.join("docs", "guides", "ralph-plan-template.md");

export async function runRalph(options: RalphCliOptions): Promise<void> {
  const cwd = process.cwd();
  const dryRun = Boolean(options.dryRun);
  const autoCommit = !options.noAutoCommit;
  const requestedSessionStrategy = coerceSessionStrategy(options.sessionStrategy);
  const postCheckProfile = coercePostCheckProfile(options.postCheckProfile);
  const logFormat = coerceLogFormat(options.logFormat);
  const strictProviderCapabilities = Boolean(options.strictProviderCapabilities);

  if (options.planTemplate) {
    const templatePath = await resolvePlanTemplatePath(cwd);
    console.log(await fs.readFile(templatePath, "utf8"));
    return;
  }

  let providerId: ProviderId | null = null;
  let model = "";
  let thinkingValue = "";
  let maxIterations = options.maxIterations;
  let planPath = options.plan ? resolveAbsolutePath(options.plan, cwd) : "";

  const preset = !options.noPreset ? await loadPreset() : null;
  if (preset && (await askUsePreset(preset))) {
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

  if (!model) {
    model = await askModel(provider);
  }

  if (!thinkingValue) {
    thinkingValue = await askThinking(provider);
  }

  let plan = null;
  if (!planPath) {
    const planSelection = await askPlanSelection(cwd);
    if (planSelection.action === "load") {
      if (!planSelection.planPath) {
        throw new Error("Plan-Auswahl ungültig: kein Pfad für bestehenden Plan.");
      }
      planPath = resolveAbsolutePath(planSelection.planPath ?? "", cwd);
    } else {
      const goal = await askGoal();
      planPath = resolveAbsolutePath(await askPlanOutputPath(cwd), cwd);
      const spinner = ora("Erstelle Plan...").start();
      try {
        plan = await createPlanFromGoal({
          provider,
          model,
          thinkingValue,
          goal,
          planPath,
          cwd,
          timeoutMs: DEFAULT_TIMEOUT_MS,
          totalIterations: maxIterations ?? 10,
          dryRun: false,
          persist: !dryRun,
          runtimeCapabilities: capabilityProbe,
        });
        spinner.succeed(dryRun ? "Plan für Dry-Run im Speicher erzeugt" : `Plan gespeichert: ${planPath}`);
      } catch (error) {
        spinner.fail("Plan-Erstellung fehlgeschlagen");
        throw error;
      }
    }
  }

  if (!plan) {
    if (!(await fileExists(planPath))) {
      throw new Error(`Plan-Datei nicht gefunden: ${planPath}`);
    }
    plan = await loadPlan(planPath);
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
      autoCommit,
      sessionStrategy,
      postCheckProfile,
      logFormat,
      runLogPath: runLogger.filePath,
      strictProviderCapabilities,
    }),
  );

  if (!(await askFinalConfirmation())) {
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

  if (!options.allowDirty && !dryRun) {
    await ensureCleanWorktree(cwd);
  }

  await runLogger.log({
    event: "run_started",
    details: `plan=${planPath};dryRun=${dryRun};postCheckProfile=${postCheckProfile};sessionStrategy=${sessionStrategy}`,
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
    autoCommit,
    sessionStrategy,
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
