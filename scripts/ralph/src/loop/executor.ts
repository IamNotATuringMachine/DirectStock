import chalk from "chalk";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

import { createStepCommit, readGitWorktreeFingerprint } from "../lib/git.js";
import { runCommand, sleep } from "../lib/process.js";
import type { EfficiencyMode } from "../lib/coerce.js";
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
  printProviderEventLive,
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
  contextFiles?: string[];
  providerMaxTurns?: number;
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
  liveProviderEvents?: boolean;
  thinkingVisibility: ThinkingVisibility;
  initialResumeSessionId?: string;
  runLogger?: RalphRunLogger;
  providerEnv?: Record<string, string>;
  efficiencyMode?: EfficiencyMode;
  iterationCache?: RalphIterationCache;
}

export interface RalphLoopSummary {
  completedSteps: number;
  failedSteps: number;
  iterationsRun: number;
  analytics: RalphLoopAnalytics;
}

export type RalphAnalyticsEventType =
  | "thinking"
  | "tool_call"
  | "tool_result"
  | "error"
  | "assistant_text"
  | "status";

export interface RalphLoopAnalytics {
  providerAttempts: number;
  providerRetries: number;
  providerEvents: Record<RalphAnalyticsEventType, number>;
  successCriteria: {
    passed: number;
    failed: number;
    totalDurationMs: number;
  };
  stepPostChecks: {
    commandsRun: number;
    passed: number;
    failed: number;
    totalDurationMs: number;
  };
  cache: {
    cache_hits_preflight: number;
    cache_misses_preflight: number;
    gitstate_cache_hits: number;
  };
}

export interface StepExecutionFingerprint {
  stepId: string;
  criteriaHash: string;
  worktreeHash: string;
  filesHash: string;
}

export interface RalphIterationCache {
  preflightByFingerprint: Map<string, { passed: boolean; output: string }>;
  gitStateByWorktreeHash: Map<string, string>;
}

export function buildIterationPrompt(
  plan: Plan,
  step: Step,
  gitState: string,
  baselineFailures?: string,
  contextFiles: string[] = [],
): string {
  const contextFileLines =
    contextFiles.length > 0 ? contextFiles.map((file) => `- ${file}`).join("\n") : "- (none)";
  const affectedPaths = step.files.length > 0 ? step.files.map((file) => `- ${file}`).join("\n") : "- (not specified)";
  const postChecks = step.postChecks.length > 0 ? step.postChecks.map((command) => `- ${command}`).join("\n") : "- (none)";

  const roleLine = plan.systemPrompt
    ? plan.systemPrompt
    : "You are a senior engineer working on an iterative refactoring plan.";

  const sections: string[] = [
    roleLine,
    "",
    "## Current Task:",
    `${step.id}`,
    `**${step.title}**`,
    step.description,
    "",
    "## Context Files (Read First):",
    contextFileLines,
    "",
    "## Affected Paths:",
    affectedPaths,
    "",
    "## Risk Class:",
    step.riskLevel,
    "",
    "## Success Criteria:",
    step.successCriteria,
    "",
    "## Step Post-Checks:",
    postChecks,
    "",
  ];

  // Inject pre-flight baseline failures so the agent knows exactly what to fix
  if (baselineFailures) {
    sections.push(
      "## ⚠️ Baseline Failures (Fix These First):",
      "The success criteria already fail BEFORE your changes. You MUST fix these errors as part of this task:",
      "```",
      baselineFailures.slice(0, 3000),
      "```",
      "",
    );
  }

  // Inject frontend design constraints when the step touches frontend files
  const touchesFrontend = step.files.some((f) => f.startsWith("frontend/"));
  if (touchesFrontend) {
    sections.push(
      "## Design Constraints:",
      "- Use Tailwind 4 utility classes with the Zinc color palette",
      "- Follow the layout and pattern established in InventoryCountPage.tsx as the reference page",
      "- Keep each page file under 350 LOC; extract complex logic to custom hooks",
      "- Use data-testid attributes following naming pattern: <page>-<element>-<action>",
      "- Typography: consistent hierarchy using text-sm / text-base / text-lg",
      "- Interactive elements must have hover states and smooth transitions",
      "- Prefer existing shared components from frontend/src/components/",
      "- All text content must use truncate / line-clamp for overflow prevention",
      "- Responsive: must work on desktop and mobile viewports",
      "- Ensure visual consistency with pages already modernized in this plan",
      "",
    );
  }

  sections.push(
    "## Rules:",
    "1. Work ONLY on this single step",
    "2. Make small, reviewable changes",
    "3. Follow AGENTS.md and the nearest nested AGENTS.md",
    "4. Execute the success criteria yourself and verify the result",
    "5. Do NOT commit manually - Ralph Loop handles commits",
    "6. If anything is unclear, document open points in .ralph-notes.md",
    "7. Before finishing, run the success criteria yourself using the bash tool and confirm it exits 0. Do NOT stop until it passes.",
    "8. If the step is already complete, explicitly say so and explain why. Otherwise, write the minimal relevant file changes required to satisfy success criteria.",
    "",
    "## Git State:",
    gitState,
  );

  return sections.join("\n");
}

const ANALYTICS_EVENT_TYPES: RalphAnalyticsEventType[] = [
  "thinking",
  "tool_call",
  "tool_result",
  "error",
  "assistant_text",
  "status",
];

function createInitialAnalytics(): RalphLoopAnalytics {
  return {
    providerAttempts: 0,
    providerRetries: 0,
    providerEvents: {
      thinking: 0,
      tool_call: 0,
      tool_result: 0,
      error: 0,
      assistant_text: 0,
      status: 0,
    },
    successCriteria: {
      passed: 0,
      failed: 0,
      totalDurationMs: 0,
    },
    stepPostChecks: {
      commandsRun: 0,
      passed: 0,
      failed: 0,
      totalDurationMs: 0,
    },
    cache: {
      cache_hits_preflight: 0,
      cache_misses_preflight: 0,
      gitstate_cache_hits: 0,
    },
  };
}

function nextRunnableStep(plan: Plan): Step | undefined {
  return plan.steps.find(
    (step) =>
      step.status === "pending" ||
      step.status === "in_progress" ||
      (step.status === "failed" && step.attempts < step.maxAttempts),
  );
}

function createIterationCache(): RalphIterationCache {
  return {
    preflightByFingerprint: new Map<string, { passed: boolean; output: string }>(),
    gitStateByWorktreeHash: new Map<string, string>(),
  };
}

function hashString(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function buildStepExecutionFingerprint(input: {
  step: Step;
  criteria: string;
  worktreeHash: string;
}): StepExecutionFingerprint {
  const normalizedFiles = [...input.step.files].sort().join("\n");
  return {
    stepId: input.step.id,
    criteriaHash: hashString(input.criteria),
    worktreeHash: input.worktreeHash,
    filesHash: hashString(normalizedFiles),
  };
}

function fingerprintKey(fingerprint: StepExecutionFingerprint): string {
  return [
    fingerprint.stepId,
    fingerprint.criteriaHash,
    fingerprint.worktreeHash,
    fingerprint.filesHash,
  ].join(":");
}

function isTransientError(result: ProviderExecutionResult): boolean {
  const raw = `${result.stderr}\n${result.stdout}\n${result.responseText || ""}`.toLowerCase();
  return (
    raw.includes("429") ||
    raw.includes("rate limit") ||
    raw.includes("ratelimit") ||
    raw.includes("resource_exhausted") ||
    raw.includes("model_capacity_exhausted") ||
    raw.includes("503") ||
    raw.includes("service unavailable") ||
    raw.includes("high demand") ||
    raw.includes("403") ||
    raw.includes("blocked") ||
    raw.includes("socket hang up") ||
    raw.includes("econnreset") ||
    raw.includes("etimedout")
  );
}

function isModelUnavailableError(result: ProviderExecutionResult): boolean {
  const raw = `${result.stderr}\n${result.stdout}\n${result.responseText || ""}`.toLowerCase();
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

const PROVIDER_HEARTBEAT_INTERVAL_MS = 1_000;
const PROVIDER_STALL_WARNING_THRESHOLD_MS = 60_000;
const SHELL_COMMAND_NOT_FOUND_PATTERN = /(command not found|is not recognized as an internal or external command)/i;
const SHELL_CONTROL_TOKENS_PATTERN = /(\|\||&&|[;|<>]|`\S*`|\$\()/;
const CLI_OPTION_TOKEN_PATTERN = /(^|\s)-{1,2}[a-z0-9]/i;

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
  providerMaxTurns?: number;
  prompt: string;
  cwd: string;
  timeoutMs: number;
  dryRun: boolean;
  sessionStrategy: SessionStrategy;
  outputMode: OutputMode;
  thinkingVisibility: ThinkingVisibility;
  streamingEnabled: boolean;
  resumeSessionId?: string;
  env?: Record<string, string>;
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
  let logicAttempt = 1;
  let transientRetryCount = 0;

  while (logicAttempt <= 3) {
    await args.onAttemptStart?.({
      model: selectedModel,
      attempt: logicAttempt,
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
            attempt: logicAttempt,
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
      attempt: logicAttempt,
    };

    try {
      result = await args.provider.execute({
        model: selectedModel,
        thinkingValue: args.thinkingValue,
        providerMaxTurns: args.providerMaxTurns,
        prompt: args.prompt,
        cwd: args.cwd,
        timeoutMs: args.timeoutMs,
        dryRun: args.dryRun,
        sessionStrategy: args.sessionStrategy,
        resumeSessionId: args.resumeSessionId,
        attempt: logicAttempt,
        outputMode: args.outputMode,
        thinkingVisibility: args.thinkingVisibility,
        streamingEnabled: args.streamingEnabled,
        onEvent: args.onEvent,
        env: args.env,
      });
      result.attempt = logicAttempt;
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

    if (result.ok) {
      // Success — report attempt done and return
      await args.onAttemptDone?.({
        model: selectedModel,
        attempt: logicAttempt,
        durationMs: Date.now() - attemptStartedAt,
        ok: true,
        exitCode: result.exitCode,
        timedOut: result.timedOut,
        modelUnavailable: false,
        sessionId: result.sessionId,
        result,
      });
      return result;
    }

    lastResult = result;

    if (isTransientError(result)) {
      // Transient error (503, rate-limit, stream stall) — do NOT call onAttemptDone.
      // This keeps the spinner and heartbeat timer running uninterrupted so the user
      // sees continuous elapsed time rather than a reset counter each retry.
      transientRetryCount++;
      // Exponential backoff: 2s, 4s, 8s, 16s, 32s, 64s, 120s max
      const backoffMs = Math.min(Math.pow(2, Math.min(transientRetryCount, 7)) * 1000, 120000);
      await args.onRetry?.({
        model: selectedModel,
        attempt: logicAttempt,
        delayMs: backoffMs,
        reason: `[Transient] ${result.stderr || result.stdout || "connection/capacity issue"}`,
      });
      await sleep(backoffMs);
      // Continue WITHOUT incrementing logicAttempt — infinite transient retries
      continue;
    }

    // Non-transient failure — report attempt done
    await args.onAttemptDone?.({
      model: selectedModel,
      attempt: logicAttempt,
      durationMs: Date.now() - attemptStartedAt,
      ok: false,
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      modelUnavailable,
      sessionId: result.sessionId,
      result,
    });

    const thinkingUnsupported = isThinkingUnsupportedError(result);
    if (modelUnavailable || thinkingUnsupported || logicAttempt === 3) {
      break;
    }

    // For non-transient, non-terminal errors, we increment logicAttempt and retry (up to 3)
    // This maintains the existing behavior for "other" failures if we choose to use it,
    // although currently isTransientError is the main driver for retries.
    logicAttempt++;
    const backoffMs = logicAttempt * 2000;
    await args.onRetry?.({
      model: selectedModel,
      attempt: logicAttempt - 1,
      delayMs: backoffMs,
      reason: result.stderr || result.stdout || "non-transient failure",
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

/**
 * Run the step's success criteria BEFORE calling the provider.
 * Returns whether it already passes (skip context injection) or fails (inject errors).
 */
async function checkBaseline(
  criteria: string,
  cwd: string,
): Promise<{ passed: boolean; output: string }> {
  const result = await runCommand({ command: "bash", args: ["-lc", criteria], cwd });
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  return { passed: result.exitCode === 0, output };
}

/**
 * Detect whether the provider made zero file writes by comparing git diff
 * against the step's affected file patterns. Returns true when no matching
 * files were modified — meaning the provider is a no-op for this step.
 */
async function detectNoOp(stepFiles: string[], cwd: string): Promise<boolean> {
  if (stepFiles.length === 0) {
    // No file constraints — can't determine no-op; give the agent the benefit of the doubt
    return false;
  }
  const diffResult = await runCommand({
    command: "bash",
    args: ["-lc", "git diff --name-only HEAD"],
    cwd,
  });
  const changedFiles = (diffResult.stdout || "")
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean);

  if (changedFiles.length === 0) {
    return true; // Nothing changed at all
  }

  // Check whether any changed file matches the step's affected paths
  // We do a simple prefix / glob match: strip trailing /** globs and check prefix
  const normalizedPatterns = stepFiles.map((p) => p.replace(/\/\*\*\/.*$/, "").replace(/\/\*$/, ""));
  const anyMatch = changedFiles.some((changed) =>
    normalizedPatterns.some((pattern) => changed.startsWith(pattern) || changed === pattern),
  );
  return !anyMatch; // no-op if nothing relevant changed
}

async function runSuccessCriteria(
  criteria: string,
  cwd: string,
  execution: ProviderExecutionResult,
): Promise<{ passed: boolean; output: string; durationMs: number }> {
  const startedAt = Date.now();
  const shellResult = await runCommand({
    command: "bash",
    args: ["-lc", criteria],
    cwd,
  });

  const shellOutput = [shellResult.stdout, shellResult.stderr].filter(Boolean).join("\n").trim();
  if (
    shellResult.exitCode === 127 &&
    SHELL_COMMAND_NOT_FOUND_PATTERN.test(shellOutput) &&
    isLikelyNarrativeCriteria(criteria)
  ) {
    const semantic = await evaluateNarrativeSuccessCriteria(criteria, cwd, execution);
    return {
      passed: semantic.passed,
      output: [
        "[ralph] successCriteria treated as narrative assertions (shell command not found fallback).",
        shellOutput ? `shell: ${truncateText(shellOutput, 260)}` : "",
        ...semantic.details,
      ]
        .filter(Boolean)
        .join("\n"),
      durationMs: Date.now() - startedAt,
    };
  }

  return {
    passed: shellResult.exitCode === 0,
    output: shellOutput,
    durationMs: Date.now() - startedAt,
  };
}

function isLikelyNarrativeCriteria(criteria: string): boolean {
  const normalized = normalizeInlineText(criteria);
  if (!normalized || SHELL_CONTROL_TOKENS_PATTERN.test(normalized)) {
    return false;
  }
  if (CLI_OPTION_TOKEN_PATTERN.test(normalized) || /[\\/]/.test(normalized)) {
    return false;
  }
  const words = normalized.split(" ").filter(Boolean);
  return words.length >= 5;
}

function hasToolCallRequirement(criteria: string): boolean {
  const value = criteria.toLowerCase();
  return /\btool[-\s_]?call\b/.test(value) || /\btool\b.*\btrigger(?:ed)?\b/.test(value);
}

function hasToolResultRequirement(criteria: string): boolean {
  return /\btool[-\s_]?result\b/.test(criteria.toLowerCase());
}

function hasLengthRequirement(criteria: string): boolean {
  return /\b(lengthy|long|complex|mathematically|detailed)\b/i.test(criteria);
}

function hasStreamingRequirement(criteria: string): boolean {
  return /\bstream(?:ing)?\b/i.test(criteria);
}

function extractMentionedFiles(criteria: string): string[] {
  const matches = criteria.match(/\b[a-z0-9_.-]+\.[a-z0-9]{1,8}\b/gi) ?? [];
  return Array.from(new Set(matches));
}

async function evaluateNarrativeSuccessCriteria(
  criteria: string,
  cwd: string,
  execution: ProviderExecutionResult,
): Promise<{ passed: boolean; details: string[] }> {
  const checks: Array<{ label: string; passed: boolean; detail: string }> = [];
  const events = Array.isArray(execution.events) ? execution.events : [];
  const toolCallCount = events.filter((event) => event.type === "tool_call").length;
  const toolResultCount = events.filter((event) => event.type === "tool_result").length;
  const streamSignalCount = events.filter((event) => event.type !== "error").length;
  const assistantText = normalizeInlineText(
    [
      execution.finalText,
      execution.responseText,
      ...events
        .filter((event) => event.type === "assistant_text")
        .map((event) => asString(event.payload.text) ?? "")
        .filter(Boolean),
    ].join(" "),
  );
  const assistantWordCount = assistantText ? assistantText.split(/\s+/).filter(Boolean).length : 0;

  checks.push({
    label: "assistant output",
    passed: assistantText.length > 0,
    detail: `chars=${assistantText.length}, words=${assistantWordCount}`,
  });

  if (hasToolCallRequirement(criteria)) {
    checks.push({
      label: "tool call observed",
      passed: toolCallCount > 0,
      detail: `tool_call_events=${toolCallCount}`,
    });
  }

  if (hasToolResultRequirement(criteria)) {
    checks.push({
      label: "tool result observed",
      passed: toolResultCount > 0,
      detail: `tool_result_events=${toolResultCount}`,
    });
  }

  if (hasStreamingRequirement(criteria)) {
    checks.push({
      label: "streaming signal observed",
      passed: streamSignalCount > 0,
      detail: `non_error_events=${streamSignalCount}`,
    });
  }

  if (hasLengthRequirement(criteria)) {
    checks.push({
      label: "long-form output",
      passed: assistantWordCount >= 20 || assistantText.length >= 160,
      detail: `chars=${assistantText.length}, words=${assistantWordCount} (target: >=20 words or >=160 chars)`,
    });
  }

  const mentionedFiles = extractMentionedFiles(criteria);
  for (const file of mentionedFiles) {
    const absolutePath = path.join(cwd, file);
    let exists = false;
    try {
      await fs.access(absolutePath);
      exists = true;
    } catch {
      exists = false;
    }
    checks.push({
      label: `file exists: ${file}`,
      passed: exists,
      detail: exists ? "present" : "missing",
    });
  }

  const passed = checks.every((check) => check.passed);
  const details = checks.map((check) => `${check.passed ? "PASS" : "FAIL"} ${check.label} (${check.detail})`);
  return { passed, details };
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
  const analytics = createInitialAnalytics();
  const efficiencyMode: EfficiencyMode = config.efficiencyMode ?? "balanced";
  const cacheEnabled = efficiencyMode !== "forensic";
  const iterationCache = config.iterationCache ?? createIterationCache();

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
      const dryPrompt = buildIterationPrompt(
        config.plan,
        step,
        "[dry-run git state]",
        undefined,
        config.contextFiles ?? [],
      );
      const command = config.provider.buildCommand({
        model: config.model,
        thinkingValue: config.thinkingValue,
        providerMaxTurns: config.providerMaxTurns,
        prompt: dryPrompt,
        cwd: config.workingDir,
        timeoutMs: config.timeoutMs,
        dryRun: true,
        sessionStrategy: config.sessionStrategy,
        resumeSessionId,
        outputMode: config.outputMode,
        thinkingVisibility: config.thinkingVisibility,
        streamingEnabled: config.providerStreamingEnabled,
        env: config.providerEnv,
      });

      console.log(chalk.dim(`Command: ${command.command} ${command.args.join(" ")}`));
      if ((config.contextFiles ?? []).length > 0) {
        console.log(chalk.dim(`Context files: ${(config.contextFiles ?? []).join(", ")}`));
      }
      console.log(chalk.dim(`Success criteria: ${step.successCriteria}`));
      if (step.postChecks.length > 0) {
        console.log(chalk.dim(`Step post-checks: ${step.postChecks.join(" | ")}`));
      }
      continue;
    }

    step.status = "in_progress";
    await savePlan(config.planPath, config.plan);
    const startedAt = Date.now();

    const worktreeFingerprint = await readGitWorktreeFingerprint(config.workingDir);
    const cachedGitState = cacheEnabled
      ? iterationCache.gitStateByWorktreeHash.get(worktreeFingerprint.worktreeHash)
      : undefined;
    let gitState: string;
    if (cachedGitState) {
      analytics.cache.gitstate_cache_hits += 1;
      gitState = cachedGitState;
    } else {
      gitState = await captureIterationContext(config.workingDir, {
        statusShort: worktreeFingerprint.statusShort,
      });
      if (cacheEnabled) {
        iterationCache.gitStateByWorktreeHash.set(worktreeFingerprint.worktreeHash, gitState);
      }
    }

    // Pre-flight: check if criteria already fail before we call the provider.
    // Inject failure context into the prompt so the agent knows what to fix.
    let baselineFailures: string | undefined;
    const stepFingerprint = buildStepExecutionFingerprint({
      step,
      criteria: step.successCriteria,
      worktreeHash: worktreeFingerprint.worktreeHash,
    });
    const preFlightCacheKey = fingerprintKey(stepFingerprint);
    const cachedPreFlight = cacheEnabled
      ? iterationCache.preflightByFingerprint.get(preFlightCacheKey)
      : undefined;
    let preFlightResult: { passed: boolean; output: string };
    if (cachedPreFlight) {
      analytics.cache.cache_hits_preflight += 1;
      preFlightResult = cachedPreFlight;
      console.log(chalk.dim(`[cache] pre-flight hit for ${step.id}`));
    } else {
      analytics.cache.cache_misses_preflight += 1;
      preFlightResult = await checkBaseline(step.successCriteria, config.workingDir);
      if (cacheEnabled) {
        iterationCache.preflightByFingerprint.set(preFlightCacheKey, preFlightResult);
      }
    }
    if (!preFlightResult.passed) {
      baselineFailures = preFlightResult.output;
      console.log(
        chalk.yellow(`[pre-flight] ${step.id} baseline is failing — injecting error context into prompt`),
      );
    } else {
      console.log(chalk.dim(`[pre-flight] ${step.id} baseline passes — proceeding normally`));
    }

    const prompt = buildIterationPrompt(
      config.plan,
      step,
      gitState,
      baselineFailures,
      config.contextFiles ?? [],
    );
    const stalledAttempts = new Set<number>();
    let latestThinkingChunk: string = "";
    const recentThinkingChunks: string[] = [];
    let liveRenderedEventCount = 0;
    const seenLiveEventKeys = new Set<string>();
    const loggedProviderEventKeys = new Set<string>();
    const countedToolCallEventKeys = new Set<string>();
    const countedToolResultEventKeys = new Set<string>();
    let liveToolCallCount = 0;
    let liveToolResultCount = 0;
    /** Set during transient-retry backoff so the spinner shows the real state. */
    let heartbeatStatusHint: string = "";

    const providerEventKey = (event: ProviderOutputEvent): string => {
      const payload = typeof event.payload === "object" && event.payload !== null ? JSON.stringify(event.payload) : "";
      return `${event.type}|${event.attempt}|${event.provider}|${payload}`;
    };

    const logProviderEvent = async (input: { event: ProviderOutputEvent; attempt: number; sessionId?: string }): Promise<void> => {
      const key = providerEventKey(input.event);
      if (loggedProviderEventKeys.has(key)) {
        return;
      }
      loggedProviderEventKeys.add(key);
      await config.runLogger?.log({
        event: "provider_event",
        iteration,
        stepId: step.id,
        stepTitle: step.title,
        attempt: input.attempt,
        sessionId: input.sessionId ?? resumeSessionId,
        providerEventType: input.event.type,
        preview: eventPreview(input.event, 220),
      });
    };

    const execution = await executeWithRetries({
      provider: config.provider,
      model: config.model,
      thinkingValue: config.thinkingValue,
      providerMaxTurns: config.providerMaxTurns,
      prompt,
      cwd: config.workingDir,
      timeoutMs: config.timeoutMs,
      dryRun: false,
      sessionStrategy: config.sessionStrategy,
      outputMode: config.outputMode,
      thinkingVisibility: config.thinkingVisibility,
      streamingEnabled: config.providerStreamingEnabled,
      resumeSessionId,
      env: config.providerEnv,
      onAttemptStart: ({ model, attempt, maxAttempts, timeoutMs }) => {
        analytics.providerAttempts += 1;
        if (attempt === 1) {
          stalledAttempts.clear();
        }
        // Clear 503-waiting hint — we're now in a real attempt
        heartbeatStatusHint = "";
        latestThinkingChunk = "";
        recentThinkingChunks.length = 0;
        liveRenderedEventCount = 0;
        seenLiveEventKeys.clear();
        loggedProviderEventKeys.clear();
        countedToolCallEventKeys.clear();
        countedToolResultEventKeys.clear();
        liveToolCallCount = 0;
        liveToolResultCount = 0;
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
          toolCallCount: liveToolCallCount,
          toolResultCount: liveToolResultCount,
          statusHint: heartbeatStatusHint,
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
        const eventKey = providerEventKey(event);
        const eventSessionId = asString(event.payload.sessionId) ?? resumeSessionId;
        void logProviderEvent({ event, attempt: event.attempt ?? 1, sessionId: eventSessionId });

        if (event.type === "tool_call" && !countedToolCallEventKeys.has(eventKey)) {
          countedToolCallEventKeys.add(eventKey);
          liveToolCallCount += 1;
        }
        if (event.type === "tool_result" && !countedToolResultEventKeys.has(eventKey)) {
          countedToolResultEventKeys.add(eventKey);
          liveToolResultCount += 1;
        }

        if (Boolean(config.liveProviderEvents) && !seenLiveEventKeys.has(eventKey)) {
          const rendered = printProviderEventLive({
            event,
            thinkingVisibility: config.thinkingVisibility,
            toolCallCount: liveToolCallCount,
            toolResultCount: liveToolResultCount,
          });
          if (rendered) {
            seenLiveEventKeys.add(eventKey);
            liveRenderedEventCount += 1;
          }
        }

        if (event.type === "thinking") {
          const text = asString(event.payload.summary);
          if (text) {
            const normalized = text.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
            if (normalized.length > 0) {
              if (
                recentThinkingChunks.length === 0 ||
                recentThinkingChunks[recentThinkingChunks.length - 1] !== normalized
              ) {
                recentThinkingChunks.push(normalized);
              }
              // Only display the most recent thought in the spinner so it isn't pushed off-screen
              latestThinkingChunk = `(${recentThinkingChunks.length}) ${normalized}`;
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
        for (const providerEvent of providerEvents) {
          if (ANALYTICS_EVENT_TYPES.includes(providerEvent.type as RalphAnalyticsEventType)) {
            analytics.providerEvents[providerEvent.type as RalphAnalyticsEventType] += 1;
          }
        }
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
          suppressEventTimeline: Boolean(config.liveProviderEvents) && liveRenderedEventCount > 0,
          finalText: result.finalText || result.responseText,
          thinkingSummary: result.thinkingSummary,
          rawOutput: result.rawOutput ?? { stdout: result.stdout, stderr: result.stderr },
        });

        for (const providerEvent of providerEvents) {
          await logProviderEvent({
            event: providerEvent,
            attempt,
            sessionId: result.sessionId ?? resumeSessionId,
          });
        }
      },
      onRetry: async ({ model, attempt, delayMs, reason }) => {
        analytics.providerRetries += 1;
        // Update the spinner hint so the heartbeat shows the real state
        // instead of 'thinking...' during a 503/transient backoff wait.
        const lowReason = reason.toLowerCase();
        if (
          lowReason.includes("503") ||
          lowReason.includes("capacity") ||
          lowReason.includes("service unavailable") ||
          lowReason.includes("high demand")
        ) {
          heartbeatStatusHint = "waiting for capacity (503)...";
        } else if (
          lowReason.includes("429") ||
          lowReason.includes("rate limit") ||
          lowReason.includes("ratelimit") ||
          lowReason.includes("resource_exhausted")
        ) {
          heartbeatStatusHint = "rate-limited, waiting...";
        } else if (
          lowReason.includes("timeout") ||
          lowReason.includes("stall") ||
          lowReason.includes("socket") ||
          lowReason.includes("hang up") ||
          lowReason.includes("reset")
        ) {
          heartbeatStatusHint = "reconnecting...";
        }
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
    let criteriaResultOverride: { passed: boolean; output: string; durationMs: number } | undefined;

    // No-op guard:
    // - If baseline already passes, allow no-change attempts to continue to criteria.
    // - If baseline fails, require relevant file writes and retry without burning attempt.
    if (execution.ok) {
      const noOp = await detectNoOp(step.files, config.workingDir);
      if (noOp) {
        if (preFlightResult.passed) {
          console.log(
            chalk.dim(
              `[no-op] ${step.id} baseline already passed and provider made no relevant writes — validating criteria as-is.`,
            ),
          );
          await config.runLogger?.log({
            event: "provider_event",
            iteration,
            stepId: step.id,
            stepTitle: step.title,
            attempt: step.attempts + 1,
            sessionId: execution.sessionId ?? resumeSessionId,
            providerEventType: "status",
            preview: "no-op accepted (baseline already passed)",
          });
        } else {
          // Guard against false negatives from the affected-path matcher:
          // if criteria now pass, accept completion even without a matched write.
          const criteriaAfterNoOp = await runSuccessCriteria(step.successCriteria, config.workingDir, execution);
          if (criteriaAfterNoOp.passed) {
            criteriaResultOverride = criteriaAfterNoOp;
            console.log(
              chalk.dim(
                `[no-op] ${step.id} unmatched writes detected, but success criteria now pass — accepting completion.`,
              ),
            );
            await config.runLogger?.log({
              event: "provider_event",
              iteration,
              stepId: step.id,
              stepTitle: step.title,
              attempt: step.attempts + 1,
              sessionId: execution.sessionId ?? resumeSessionId,
              providerEventType: "status",
              preview: "no-op accepted (criteria passed after execution)",
            });
          } else {
            step.lastError =
              "[no-op] Provider made 0 file writes matching step's affected paths. Retrying without burning an attempt.";
            step.status = "pending";
            console.log(
              chalk.yellow(
                `[no-op] ${step.id} provider wrote nothing relevant — retrying without burning attempt ${step.attempts + 1}/${step.maxAttempts}`,
              ),
            );
            await config.runLogger?.log({
              event: "step_failed",
              iteration,
              stepId: step.id,
              stepTitle: step.title,
              attempt: step.attempts,
              maxAttempts: step.maxAttempts,
              durationMs,
              exitCode: 0,
              sessionId: execution.sessionId ?? resumeSessionId,
              details: step.lastError,
            });
            config.plan.metadata.completedIterations += 1;
            await savePlan(config.planPath, config.plan);
            continue;
          }
        }
      }
    }

    if (!execution.ok) {
      const wasTransient = isTransientError(execution);

      if (wasTransient) {
        // Transient errors (503, rate-limit, stream stall, etc.) do NOT burn a
        // step attempt — the step goes back to pending so the next iteration
        // can retry it with the full attempt budget intact.
        step.lastError = summarizeProviderFailure({
          execution,
          includeRaw: config.outputMode === "raw",
        });
        step.status = "pending";

        printIterationResult({
          step,
          passed: false,
          attempts: step.attempts,
          maxAttempts: step.maxAttempts,
          durationMs,
          info: `[transient — attempt not counted] ${step.lastError}`,
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
          details: `[transient] ${step.lastError?.slice(0, 1000)}`,
        });
      } else {
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
      }
    } else {
      printSuccessCriteriaStart({ step, command: step.successCriteria });
      const criteriaResult =
        criteriaResultOverride ?? (await runSuccessCriteria(step.successCriteria, config.workingDir, execution));
      printSuccessCriteriaDone({
        step,
        passed: criteriaResult.passed,
        durationMs: criteriaResult.durationMs,
      });
      analytics.successCriteria.totalDurationMs += criteriaResult.durationMs;
      if (criteriaResult.passed) {
        analytics.successCriteria.passed += 1;
      } else {
        analytics.successCriteria.failed += 1;
      }

      const stepPostChecks =
        criteriaResult.passed
          ? await (() => {
            if (step.postChecks.length > 0) {
              printStepPostChecksStart({ step, total: step.postChecks.length });
            }
            return runStepPostChecks(step.postChecks, config.workingDir, (postCheck) => {
              analytics.stepPostChecks.commandsRun += 1;
              analytics.stepPostChecks.totalDurationMs += postCheck.durationMs;
              if (postCheck.passed) {
                analytics.stepPostChecks.passed += 1;
              } else {
                analytics.stepPostChecks.failed += 1;
              }
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
        if (!criteriaResult.passed) {
          step.lastError = [truncateText(execution.finalText ?? "", 320), criteriaResult.output, stepPostChecks.output]
            .filter(Boolean)
            .join("\n")
            .slice(0, 4000);
        } else {
          step.lastError = [
            stepPostChecks.failedCommand ? `[post-check failed] ${stepPostChecks.failedCommand}` : "[post-check failed]",
            stepPostChecks.output,
          ]
            .filter(Boolean)
            .join("\n")
            .slice(0, 4000);
        }
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
    analytics,
  };
}
