import chalk from "chalk";

import { createStepCommit } from "../lib/git.js";
import { runCommand, sleep } from "../lib/process.js";
import type { RalphRunLogger } from "../lib/run-log.js";
import type { Plan, Step } from "../planner/plan-schema.js";
import { savePlan } from "../planner/plan-schema.js";
import {
  eventPreview,
  normalizeInlineText,
  truncateText,
  asString,
  type OutputMode,
  type ProviderOutputEvent,
  type ThinkingVisibility,
} from "../providers/output-events.js";
import type { ProviderAdapter, ProviderExecutionResult, SessionStrategy } from "../providers/types.js";
import {
  printIterationHeader,
  printIterationResult,
  printPlanProgress,
  printProviderAttemptDone,
  printProviderAttemptStart,
  printProviderHeartbeat,
  printProviderOutput,
  printRetryScheduled,
  printStepPostCheckResult,
  printStepPostChecksStart,
  printSuccessCriteriaDone,
  printSuccessCriteriaStart,
} from "../ui/progress.js";
import { captureIterationContext } from "./context-reset.js";

export interface RalphLoopConfig {
  provider: ProviderAdapter;
  model: string;
  thinkingValue: string;
  planPath: string;
  plan: Plan;
  maxIterations: number;
  workingDir: string;
  timeoutMs: number;
  dryRun: boolean;
  autoCommit: boolean;
  sessionStrategy: SessionStrategy;
  providerStreamingEnabled: boolean;
  outputMode: OutputMode;
  thinkingVisibility: ThinkingVisibility;
  initialResumeSessionId?: string;
  runLogger?: RalphRunLogger;
}

export interface RalphLoopSummary {
  completedSteps: number;
  failedSteps: number;
  iterationsRun: number;
}

export function buildIterationPrompt(plan: Plan, step: Step, gitState: string): string {
  const affectedPaths = step.files.length > 0 ? step.files.map((file) => `- ${file}`).join("\n") : "- (nicht angegeben)";
  const postChecks = step.postChecks.length > 0 ? step.postChecks.map((command) => `- ${command}`).join("\n") : "- (keine)";

  return [
    "Du bist ein Senior Engineer. Du arbeitest an einem iterativen Refactoring-Plan.",
    "",
    "## Dein aktueller Task:",
    `${step.id}`,
    `**${step.title}**`,
    step.description,
    "",
    "## Affected Paths:",
    affectedPaths,
    "",
    "## Risk Class:",
    step.riskLevel,
    "",
    "## Erfolgskriterium:",
    step.successCriteria,
    "",
    "## Step Post-Checks:",
    postChecks,
    "",
    "## Regeln:",
    "1. Arbeite NUR an diesem einen Step",
    "2. Mache kleine, reviewbare Änderungen",
    "3. Folge AGENTS.md und dem nächsten nested AGENTS.md",
    "4. Führe das Erfolgskriterium selbst aus und prüfe das Ergebnis",
    "5. Committe NICHT selbst - das macht der Ralph Loop",
    "6. Wenn unklar, dokumentiere offene Punkte in .ralph-notes.md",
    "",
    "## Git State:",
    gitState,
  ].join("\n");
}

function nextRunnableStep(plan: Plan): Step | undefined {
  return plan.steps.find(
    (step) =>
      step.status === "pending" ||
      step.status === "in_progress" ||
      (step.status === "failed" && step.attempts < step.maxAttempts),
  );
}

function isTransientError(result: ProviderExecutionResult): boolean {
  const raw = `${result.stderr}\n${result.stdout}`.toLowerCase();
  return (
    raw.includes("429") ||
    raw.includes("rate limit") ||
    raw.includes("ratelimit") ||
    raw.includes("resource_exhausted") ||
    raw.includes("model_capacity_exhausted")
  );
}

function isModelUnavailableError(result: ProviderExecutionResult): boolean {
  const raw = `${result.stderr}\n${result.stdout}`.toLowerCase();
  return (
    raw.includes("model_unavailable") ||
    raw.includes("model unavailable") ||
    raw.includes("model not found") ||
    raw.includes("unknown model") ||
    raw.includes("invalid model") ||
    raw.includes("no such model") ||
    raw.includes("unsupported model") ||
    raw.includes("does not exist") ||
    raw.includes("is not available")
  );
}

export function isThinkingUnsupportedError(result: ProviderExecutionResult): boolean {
  const raw = `${result.stderr}\n${result.stdout}`.toLowerCase();
  const hasThinkingKeyword =
    raw.includes("thinking") || raw.includes("budget") || raw.includes("reasoning_effort") || raw.includes("max-turns");
  const hasRejection =
    raw.includes("unsupported") ||
    raw.includes("invalid") ||
    raw.includes("unrecognized option") ||
    raw.includes("unknown option") ||
    raw.includes("not supported") ||
    raw.includes("not available");
  return hasThinkingKeyword && hasRejection;
}

const PROVIDER_HEARTBEAT_INTERVAL_MS = 15_000;
const PROVIDER_STALL_WARNING_THRESHOLD_MS = 60_000;

function summarizeProviderFailure(args: {
  execution: ProviderExecutionResult;
  modelUnavailableHint?: string;
  thinkingUnsupportedHint?: string;
  includeRaw: boolean;
}): string {
  const eventErrors = (args.execution.events ?? [])
    .filter((event) => event.type === "error")
    .slice(0, 3)
    .map((event) => truncateText(eventPreview(event, 260), 260));

  const finalSummary = truncateText(args.execution.finalText ?? "", 320);

  const uniqueParts = Array.from(
    new Set(
      [
        args.modelUnavailableHint ?? "",
        args.thinkingUnsupportedHint ?? "",
        finalSummary,
        ...eventErrors,
      ]
        .filter(Boolean)
        .map((item) => normalizeInlineText(item)),
    ),
  );

  const parts = [...uniqueParts].filter(Boolean);

  if (args.includeRaw) {
    const raw = [args.execution.stderr, args.execution.stdout].filter(Boolean).join("\n").trim();
    if (raw) {
      parts.push(truncateText(raw, 700));
    }
  }

  return parts.join("\n").slice(0, 1800);
}

async function executeWithRetries(args: {
  provider: ProviderAdapter;
  model: string;
  thinkingValue: string;
  prompt: string;
  cwd: string;
  timeoutMs: number;
  dryRun: boolean;
  sessionStrategy: SessionStrategy;
  outputMode: OutputMode;
  thinkingVisibility: ThinkingVisibility;
  streamingEnabled: boolean;
  resumeSessionId?: string;
  onAttemptStart?: (input: {
    model: string;
    attempt: number;
    maxAttempts: number;
    timeoutMs: number;
  }) => Promise<void> | void;
  onHeartbeat?: (input: {
    model: string;
    attempt: number;
    elapsedMs: number;
    timeoutMs: number;
  }) => Promise<void> | void;
  onAttemptDone?: (input: {
    model: string;
    attempt: number;
    durationMs: number;
    ok: boolean;
    exitCode: number | null;
    timedOut: boolean;
    modelUnavailable: boolean;
    sessionId?: string;
    result: ProviderExecutionResult;
  }) => Promise<void> | void;
  onRetry?: (input: { model: string; attempt: number; delayMs: number; reason: string }) => Promise<void>;
  onEvent?: (event: ProviderOutputEvent) => Promise<void> | void;
}): Promise<ProviderExecutionResult> {
  const selectedModel = args.model;

  let lastResult: ProviderExecutionResult | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    await args.onAttemptStart?.({
      model: selectedModel,
      attempt,
      maxAttempts: 3,
      timeoutMs: args.timeoutMs,
    });

    const attemptStartedAt = Date.now();
    const heartbeatHandle =
      args.onHeartbeat &&
      setInterval(() => {
        void Promise.resolve(
          args.onHeartbeat?.({
            model: selectedModel,
            attempt,
            elapsedMs: Date.now() - attemptStartedAt,
            timeoutMs: args.timeoutMs,
          }),
        ).catch(() => undefined);
      }, PROVIDER_HEARTBEAT_INTERVAL_MS);

    let result: ProviderExecutionResult = {
      ok: false,
      exitCode: 1,
      timedOut: false,
      stdout: "",
      stderr: "Provider execution failed unexpectedly.",
      responseText: "",
      finalText: "",
      events: [],
      usedModel: selectedModel,
      command: { command: args.provider.cliCommand, args: [] },
      sessionId: args.resumeSessionId,
      rawOutput: { stdout: "", stderr: "Provider execution failed unexpectedly." },
      attempt,
    };
    try {
      result = await args.provider.execute({
        model: selectedModel,
        thinkingValue: args.thinkingValue,
        prompt: args.prompt,
        cwd: args.cwd,
        timeoutMs: args.timeoutMs,
        dryRun: args.dryRun,
        sessionStrategy: args.sessionStrategy,
        resumeSessionId: args.resumeSessionId,
        attempt,
        outputMode: args.outputMode,
        thinkingVisibility: args.thinkingVisibility,
        streamingEnabled: args.streamingEnabled,
        onEvent: args.onEvent,
      });
      result.attempt = attempt;
    } catch (error) {
      result = {
        ...result,
        stderr: error instanceof Error ? error.message : String(error),
        rawOutput: { stdout: "", stderr: error instanceof Error ? error.message : String(error) },
      };
    } finally {
      if (heartbeatHandle) {
        clearInterval(heartbeatHandle);
      }
    }

    const modelUnavailable = isModelUnavailableError(result);
    await args.onAttemptDone?.({
      model: selectedModel,
      attempt,
      durationMs: Date.now() - attemptStartedAt,
      ok: result.ok,
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      modelUnavailable,
      sessionId: result.sessionId,
      result,
    });

    if (result.ok) {
      return result;
    }

    lastResult = result;
    const thinkingUnsupported = isThinkingUnsupportedError(result);
    if (modelUnavailable || thinkingUnsupported || !isTransientError(result) || attempt === 3) {
      break;
    }

    const backoffMs = attempt * 2000;
    await args.onRetry?.({
      model: selectedModel,
      attempt,
      delayMs: backoffMs,
      reason: result.stderr || result.stdout || "transient provider failure",
    });
    await sleep(backoffMs);
  }

  return (
    lastResult ?? {
      ok: false,
      exitCode: 1,
      timedOut: false,
      stdout: "",
      stderr: "Provider execution failed before returning a result.",
      responseText: "",
      finalText: "",
      events: [],
      usedModel: args.model,
      command: { command: args.provider.cliCommand, args: [] },
      sessionId: args.resumeSessionId,
      rawOutput: { stdout: "", stderr: "Provider execution failed before returning a result." },
    }
  );
}

async function runSuccessCriteria(
  criteria: string,
  cwd: string,
): Promise<{ passed: boolean; output: string; durationMs: number }> {
  const startedAt = Date.now();
  const result = await runCommand({
    command: "bash",
    args: ["-lc", criteria],
    cwd,
  });

  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  return {
    passed: result.exitCode === 0,
    output,
    durationMs: Date.now() - startedAt,
  };
}

async function runStepPostChecks(
  commands: string[],
  cwd: string,
  onCommandResult?: (input: {
    index: number;
    total: number;
    command: string;
    passed: boolean;
    durationMs: number;
  }) => void,
): Promise<{ passed: boolean; output: string; failedCommand?: string }> {
  if (commands.length === 0) {
    return { passed: true, output: "" };
  }

  const outputChunks: string[] = [];

  for (const command of commands) {
    const startedAt = Date.now();
    const result = await runCommand({
      command: "bash",
      args: ["-lc", command],
      cwd,
    });
    const durationMs = Date.now() - startedAt;
    const passed = result.exitCode === 0;
    onCommandResult?.({
      index: outputChunks.length + 1,
      total: commands.length,
      command,
      passed,
      durationMs,
    });
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    outputChunks.push([`$ ${command}`, output].filter(Boolean).join("\n"));

    if (!passed) {
      return { passed: false, output: outputChunks.join("\n\n"), failedCommand: command };
    }
  }

  return { passed: true, output: outputChunks.join("\n\n") };
}

export async function runRalphLoop(config: RalphLoopConfig): Promise<RalphLoopSummary> {
  let iterationsRun = 0;
  let resumeSessionId: string | undefined = config.initialResumeSessionId;

  if (config.sessionStrategy === "resume" && resumeSessionId) {
    console.log(chalk.cyan(`Resuming provider session from plan metadata: ${resumeSessionId}`));
  }

  for (let iteration = 1; iteration <= config.maxIterations; iteration++) {
    const step = nextRunnableStep(config.plan);
    if (!step) {
      console.log(chalk.green("All runnable steps are complete."));
      break;
    }

    iterationsRun += 1;
    await config.runLogger?.log({
      event: "iteration_started",
      iteration,
      maxIterations: config.maxIterations,
      stepId: step.id,
      stepTitle: step.title,
      attempt: step.attempts + 1,
      maxAttempts: step.maxAttempts,
      sessionId: resumeSessionId,
    });

    printIterationHeader({
      iteration,
      maxIterations: config.maxIterations,
      step,
      sessionStrategy: config.sessionStrategy,
      resumeSessionId,
    });
    printPlanProgress(config.plan, step.id);

    if (config.dryRun) {
      const dryPrompt = buildIterationPrompt(config.plan, step, "[dry-run git state]");
      const command = config.provider.buildCommand({
        model: config.model,
        thinkingValue: config.thinkingValue,
        prompt: dryPrompt,
        cwd: config.workingDir,
        timeoutMs: config.timeoutMs,
        dryRun: true,
        sessionStrategy: config.sessionStrategy,
        resumeSessionId,
        outputMode: config.outputMode,
        thinkingVisibility: config.thinkingVisibility,
        streamingEnabled: config.providerStreamingEnabled,
      });

      console.log(chalk.dim(`Command: ${command.command} ${command.args.join(" ")}`));
      console.log(chalk.dim(`Success criteria: ${step.successCriteria}`));
      if (step.postChecks.length > 0) {
        console.log(chalk.dim(`Step post-checks: ${step.postChecks.join(" | ")}`));
      }
      continue;
    }

    step.status = "in_progress";
    await savePlan(config.planPath, config.plan);
    const startedAt = Date.now();

    const gitState = await captureIterationContext(config.workingDir);
    const prompt = buildIterationPrompt(config.plan, step, gitState);
    const stalledAttempts = new Set<number>();
    let latestThinkingChunk: string | undefined;

    const execution = await executeWithRetries({
      provider: config.provider,
      model: config.model,
      thinkingValue: config.thinkingValue,
      prompt,
      cwd: config.workingDir,
      timeoutMs: config.timeoutMs,
      dryRun: false,
      sessionStrategy: config.sessionStrategy,
      outputMode: config.outputMode,
      thinkingVisibility: config.thinkingVisibility,
      streamingEnabled: config.providerStreamingEnabled,
      resumeSessionId,
      onAttemptStart: ({ model, attempt, maxAttempts, timeoutMs }) => {
        if (attempt === 1) {
          stalledAttempts.clear();
        }
        printProviderAttemptStart({
          step,
          model,
          attempt,
          maxAttempts,
          timeoutMs,
          sessionStrategy: config.sessionStrategy,
          resumeSessionId,
        });
      },
      onHeartbeat: ({ model, attempt, elapsedMs, timeoutMs }) => {
        printProviderHeartbeat({
          step,
          model,
          attempt,
          elapsedMs,
          timeoutMs,
          thinkingChunk: latestThinkingChunk,
        });
        if (
          config.provider.id === "anthropic" &&
          elapsedMs >= PROVIDER_STALL_WARNING_THRESHOLD_MS &&
          !stalledAttempts.has(attempt)
        ) {
          stalledAttempts.add(attempt);
          console.log(
            chalk.yellow(
              `[status] ${step.id} provider:stall model=${model} attempt=${attempt} elapsed=${Math.round(
                elapsedMs / 1000,
              )}s hint=No completion event yet; check auth/network or reduce thinking/max-turns.`,
            ),
          );
          void config.runLogger?.log({
            event: "provider_event",
            iteration,
            stepId: step.id,
            stepTitle: step.title,
            attempt,
            sessionId: resumeSessionId,
            providerEventType: "status",
            preview: `stall_detected elapsedMs=${elapsedMs}`,
          });
        }
      },
      onEvent: (event) => {
        if (event.type === "thinking") {
          const text = asString(event.payload.summary);
          if (text && text.trim().length > 0) {
            const lines = text.split("\n").filter(Boolean);
            if (lines.length > 0) {
              latestThinkingChunk = lines[lines.length - 1].trim() || latestThinkingChunk;
            }
          }
        }
      },
      onAttemptDone: async ({
        model,
        attempt,
        durationMs,
        ok,
        exitCode,
        timedOut,
        modelUnavailable,
        sessionId,
        result,
      }) => {
        const providerEvents = Array.isArray(result.events) ? result.events : [];
        printProviderAttemptDone({
          step,
          model,
          attempt,
          durationMs,
          ok,
          exitCode,
          timedOut,
          modelUnavailable,
          sessionId,
        });

        printProviderOutput({
          step,
          outputMode: config.outputMode,
          thinkingVisibility: config.thinkingVisibility,
          events: providerEvents,
          finalText: result.finalText || result.responseText,
          thinkingSummary: result.thinkingSummary,
          rawOutput: result.rawOutput ?? { stdout: result.stdout, stderr: result.stderr },
        });

        for (const providerEvent of providerEvents) {
          await config.runLogger?.log({
            event: "provider_event",
            iteration,
            stepId: step.id,
            stepTitle: step.title,
            attempt,
            sessionId: result.sessionId ?? resumeSessionId,
            providerEventType: providerEvent.type,
            preview: eventPreview(providerEvent, 220),
          });
        }
      },
      onRetry: async ({ model, attempt, delayMs, reason }) => {
        printRetryScheduled({
          step,
          model,
          attempt,
          delayMs,
          reason,
        });
        await config.runLogger?.log({
          event: "provider_retry",
          iteration,
          stepId: step.id,
          stepTitle: step.title,
          attempt,
          sessionId: resumeSessionId,
          details: `model=${model};delayMs=${delayMs};reason=${reason.slice(0, 600)}`,
        });
      },
    });

    if (config.sessionStrategy === "resume" && execution.sessionId) {
      resumeSessionId = execution.sessionId;
      config.plan.metadata.resumeSessionId = execution.sessionId;
    }

    const durationMs = Date.now() - startedAt;

    if (!execution.ok) {
      step.attempts += 1;
      const modelUnavailableHint = isModelUnavailableError(execution)
        ? `Selected model unavailable: ${config.model}. No fallback models are configured.`
        : "";
      const thinkingUnsupportedHint = isThinkingUnsupportedError(execution)
        ? `Thinking/budget configuration rejected by provider. Check --thinking value "${config.thinkingValue}" compatibility with model "${config.model}".`
        : "";
      step.lastError = summarizeProviderFailure({
        execution,
        modelUnavailableHint,
        thinkingUnsupportedHint,
        includeRaw: config.outputMode === "raw",
      });
      step.status = step.attempts >= step.maxAttempts ? "failed" : "pending";

      printIterationResult({
        step,
        passed: false,
        attempts: step.attempts,
        maxAttempts: step.maxAttempts,
        durationMs,
        info: step.lastError,
      });

      await config.runLogger?.log({
        event: "step_failed",
        iteration,
        stepId: step.id,
        stepTitle: step.title,
        attempt: step.attempts,
        maxAttempts: step.maxAttempts,
        durationMs,
        exitCode: execution.exitCode,
        sessionId: execution.sessionId ?? resumeSessionId,
        details: step.lastError?.slice(0, 1000),
      });
    } else {
      printSuccessCriteriaStart({ step, command: step.successCriteria });
      const criteriaResult = await runSuccessCriteria(step.successCriteria, config.workingDir);
      printSuccessCriteriaDone({
        step,
        passed: criteriaResult.passed,
        durationMs: criteriaResult.durationMs,
      });

      const stepPostChecks =
        criteriaResult.passed
          ? await (() => {
            if (step.postChecks.length > 0) {
              printStepPostChecksStart({ step, total: step.postChecks.length });
            }
            return runStepPostChecks(step.postChecks, config.workingDir, (postCheck) => {
              printStepPostCheckResult({
                step,
                command: postCheck.command,
                index: postCheck.index,
                total: postCheck.total,
                passed: postCheck.passed,
                durationMs: postCheck.durationMs,
              });
            });
          })()
          : { passed: true, output: "" };

      if (criteriaResult.passed && stepPostChecks.passed) {
        step.status = "done";
        step.lastError = undefined;

        let commitInfo = "";
        if (config.autoCommit) {
          const committed = await createStepCommit(config.workingDir, `ralph(${step.id}): ${step.title}`);
          commitInfo = committed ? "Commit: created" : "Commit: skipped (no changes)";
        }

        printIterationResult({
          step,
          passed: true,
          attempts: step.attempts,
          maxAttempts: step.maxAttempts,
          durationMs,
          info: [
            `Model: ${execution.usedModel}`,
            config.sessionStrategy === "resume" && execution.sessionId ? `Session: ${execution.sessionId}` : "",
            commitInfo,
          ]
            .filter(Boolean)
            .join(" | "),
        });
        await config.runLogger?.log({
          event: "step_done",
          iteration,
          stepId: step.id,
          stepTitle: step.title,
          attempt: step.attempts,
          maxAttempts: step.maxAttempts,
          durationMs,
          exitCode: execution.exitCode,
          sessionId: execution.sessionId ?? resumeSessionId,
          details: `criteria=pass;postChecks=${step.postChecks.length}`,
        });
      } else {
        step.attempts += 1;
        step.lastError = [truncateText(execution.finalText ?? "", 320), criteriaResult.output, stepPostChecks.output]
          .filter(Boolean)
          .join("\n")
          .slice(0, 4000);
        step.status = step.attempts >= step.maxAttempts ? "failed" : "pending";

        printIterationResult({
          step,
          passed: false,
          attempts: step.attempts,
          maxAttempts: step.maxAttempts,
          durationMs,
          info: step.lastError,
        });

        await config.runLogger?.log({
          event: "step_failed",
          iteration,
          stepId: step.id,
          stepTitle: step.title,
          attempt: step.attempts,
          maxAttempts: step.maxAttempts,
          durationMs,
          exitCode: execution.exitCode,
          sessionId: execution.sessionId ?? resumeSessionId,
          details: step.lastError?.slice(0, 1000),
        });
        if (!stepPostChecks.passed) {
          await config.runLogger?.log({
            event: "post_check_failed",
            iteration,
            stepId: step.id,
            stepTitle: step.title,
            details: [
              stepPostChecks.failedCommand ? `command=${stepPostChecks.failedCommand}` : "",
              stepPostChecks.output.slice(0, 1000),
            ]
              .filter(Boolean)
              .join(" | "),
          });
        }
      }
    }

    config.plan.metadata.completedIterations += 1;
    await savePlan(config.planPath, config.plan);
  }

  const completedSteps = config.plan.steps.filter((step) => step.status === "done").length;
  const failedSteps = config.plan.steps.filter((step) => step.status === "failed").length;

  return {
    completedSteps,
    failedSteps,
    iterationsRun,
  };
}
