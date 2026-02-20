import path from "node:path";

import chalk from "chalk";
import fs from "fs-extra";
import ora from "ora";

import { loadPreset, savePreset } from "./config/preset.js";
import { readWorktreeState } from "./lib/git.js";
import { bootstrapPlan } from "./lib/plan-bootstrap.js";
import { createRunLogger, type RunLogFormat } from "./lib/run-log.js";
import { resolveAutoCommitPolicy } from "./lib/auto-commit-policy.js";
import {
  coerceSessionStrategy,
  coerceProviderId,
  coercePostCheckProfile,
  coerceLogFormat,
  coerceOutputMode,
  coerceThinkingVisibility,
} from "./lib/coerce.js";
import { normalizeProviderModel } from "./lib/model-normalization.js";
import { resolvePlanTemplatePath } from "./lib/plan-utils.js";
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

export {
  resolveAutoCommitPolicy,
  type AutoCommitPolicyInput,
  type AutoCommitPolicyOutput,
} from "./lib/auto-commit-policy.js";
export { normalizeProviderModel } from "./lib/model-normalization.js";

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
  let planPath = options.plan ?? "";
  let goalFilePath = options.goalFile ?? "";

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
    throw new Error(`${provider.cliCommand} CLI is not installed or not available in PATH.`);
  }

  if (model) {
    const normalizedModel = normalizeProviderModel(providerId, model);
    if (normalizedModel !== model) {
      console.log(chalk.yellow(`[ralph] Model ID corrected: ${model} -> ${normalizedModel}`));
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
      throw new Error(`${provider.name} does not support session resume in this environment.`);
    }
    console.log(chalk.yellow(`[ralph capabilities] Session resume disabled. Falling back to reset.`));
    sessionStrategy = "reset";
  }

  let providerStreamingEnabled = Boolean(provider.supportsStreamJson);
  if (providerStreamingEnabled && !capabilityProbe.supportsStreamOutput) {
    providerStreamingEnabled = false;
    console.log(
      chalk.yellow(`[ralph capabilities] Streaming output for ${provider.name} not available. Fallback active.`),
    );
  }

  if (!model) {
    model = await askModel(provider);
    const normalizedModel = normalizeProviderModel(providerId, model);
    if (normalizedModel !== model) {
      console.log(chalk.yellow(`[ralph] Model ID corrected: ${model} -> ${normalizedModel}`));
      model = normalizedModel;
    }
  }

  if (!thinkingValue) {
    thinkingValue = await askThinking(provider);
  }

  const createPlan = async (goal: string, targetPlanPath: string) => {
    const spinner = ora("Creating plan...").start();
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
        dryRun ? "Plan created in memory for dry run" : `Plan saved: ${targetPlanPath}`,
      );
      return generatedPlan;
    } catch (error) {
      spinner.fail("Plan creation failed");
      throw error;
    }
  };

  const bootstrapResult = await bootstrapPlan({
    cwd,
    dryRun,
    initialPlanPath: planPath,
    initialGoalFilePath: goalFilePath,
    askGoal,
    askPlanOutputPath,
    askPlanSelection: async (selectionCwd) => {
      const selected = await askPlanSelection(selectionCwd);
      return { action: selected.action, planPath: selected.planPath };
    },
    createPlan,
    loadPlan,
    savePlan,
    logWarning: (message) => console.log(chalk.yellow(message)),
  });
  const plan = bootstrapResult.plan;
  planPath = bootstrapResult.planPath;

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
    console.log(chalk.yellow("Aborted."));
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

  const spinner = ora("Starting Ralph Loop...").start();
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

  console.log(chalk.green(`\nRalph Loop completed. Iterations: ${summary.iterationsRun}`));
  console.log(chalk.green(`Done steps: ${summary.completedSteps}`));
  console.log(chalk.cyan(`Provider attempts: ${summary.analytics.providerAttempts}`));
  console.log(chalk.cyan(`Provider retries: ${summary.analytics.providerRetries}`));
  console.log(
    chalk.cyan(
      `Success criteria: pass=${summary.analytics.successCriteria.passed} fail=${summary.analytics.successCriteria.failed} duration=${summary.analytics.successCriteria.totalDurationMs}ms`,
    ),
  );
  console.log(
    chalk.cyan(
      `Step post-checks: run=${summary.analytics.stepPostChecks.commandsRun} pass=${summary.analytics.stepPostChecks.passed} fail=${summary.analytics.stepPostChecks.failed} duration=${summary.analytics.stepPostChecks.totalDurationMs}ms`,
    ),
  );
  console.log(
    chalk.cyan(
      `Provider events: thinking=${summary.analytics.providerEvents.thinking}, tool_call=${summary.analytics.providerEvents.tool_call}, tool_result=${summary.analytics.providerEvents.tool_result}, assistant_text=${summary.analytics.providerEvents.assistant_text}, status=${summary.analytics.providerEvents.status}, error=${summary.analytics.providerEvents.error}`,
    ),
  );
  if (summary.failedSteps > 0) {
    console.log(chalk.red(`Failed steps: ${summary.failedSteps}`));
    for (const step of plan.steps) {
      if (step.status === "failed") {
        console.log(chalk.red(`\n[${step.id}] ${step.title} failed:`));
        if (step.lastError) {
          console.log(chalk.redBright(step.lastError));
        } else {
          console.log(chalk.redBright("Unknown error."));
        }
      }
    }
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
