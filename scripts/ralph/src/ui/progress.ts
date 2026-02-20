import chalk from "chalk";
import ora from "ora";

import type { Plan, Step } from "../planner/plan-schema.js";
import { asString, eventPreview, truncateText, type OutputMode, type ProviderOutputEvent, type ThinkingVisibility } from "../providers/output-events.js";
import type { SessionStrategy } from "../providers/types.js";

let currentSpinner: ReturnType<typeof ora> | null = null;

// ── Formatting helpers ────────────────────────────────────────────────

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

function truncateInlineEnd(text: string, maxLen = 160): string {
  const normalized = normalizeInline(text);
  return normalized.length > maxLen ? `...${normalized.slice(-(maxLen - 3))}` : normalized;
}

function termWidth(): number {
  return Math.max(60, Math.min(process.stdout.columns ?? 100, 120));
}

// ── Box-drawing primitives ────────────────────────────────────────────

function boxTop(width: number): string {
  return `╭${"─".repeat(width - 2)}╮`;
}

function boxBottom(width: number): string {
  return `╰${"─".repeat(width - 2)}╯`;
}

function boxLine(text: string, width: number): string {
  const stripped = stripAnsi(text);
  const pad = Math.max(0, width - 4 - stripped.length);
  return `│ ${text}${" ".repeat(pad)} │`;
}

function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

function boxDivider(width: number): string {
  return `├${"─".repeat(width - 2)}┤`;
}

// ── Icons ─────────────────────────────────────────────────────────────

const ICON = {
  thinking: "💭",
  tool: "⚡",
  toolOk: "✓",
  toolFail: "✗",
  error: "✗",
  pass: "✓",
  fail: "✗",
  pending: "○",
  active: "◉",
  done: "●",
  arrow: "→",
} as const;

// ── Iteration Header (box-drawn) ─────────────────────────────────────

export function printIterationHeader(args: {
  iteration: number;
  maxIterations: number;
  step: Step;
  sessionStrategy: SessionStrategy;
  resumeSessionId?: string;
}): void {
  const w = termWidth();
  const title = `⚙ Iteration ${args.iteration}/${args.maxIterations} · ${args.step.id}: ${args.step.title}`;
  const session = `Session: ${args.sessionStrategy}${args.resumeSessionId ? ` (${args.resumeSessionId})` : ""} · Attempt ${args.step.attempts + 1}/${args.step.maxAttempts}`;
  const time = new Date().toLocaleTimeString();

  console.log("");
  console.log(chalk.cyan(boxTop(w)));
  console.log(chalk.cyan(boxLine(`${chalk.bold(truncateInline(title, w - 6))}`, w)));
  console.log(chalk.cyan(boxLine(`${chalk.dim(session)}  ${chalk.dim(time)}`, w)));
  console.log(chalk.cyan(boxBottom(w)));
}

// ── Plan Progress (compact bar) ──────────────────────────────────────

export function printPlanProgress(plan: Plan, currentStepId?: string): void {
  const done = plan.steps.filter((s) => s.status === "done").length;
  const active = plan.steps.filter((s) => s.status === "in_progress").length;
  const failed = plan.steps.filter((s) => s.status === "failed").length;
  const total = plan.steps.length;

  const barWidth = Math.min(20, total);
  const filledWidth = Math.round((done / total) * barWidth);
  const bar = `${chalk.green("█".repeat(filledWidth))}${chalk.dim("░".repeat(barWidth - filledWidth))}`;

  const parts = [
    `${chalk.bold("Progress")} [${bar}] ${done}/${total} steps`,
    done > 0 ? chalk.green(`${ICON.done} ${done} done`) : "",
    active > 0 ? chalk.cyan(`${ICON.active} ${active} active`) : "",
    failed > 0 ? chalk.red(`${ICON.fail} ${failed} failed`) : "",
    total - done - active - failed > 0 ? chalk.dim(`${ICON.pending} ${total - done - active - failed} pending`) : "",
  ].filter(Boolean);

  console.log(parts.join("  "));

  // Compact step list
  for (const step of plan.steps) {
    const icon =
      step.status === "done" ? chalk.green(ICON.done)
        : step.status === "in_progress" ? chalk.cyan(ICON.active)
          : step.status === "failed" ? chalk.red(ICON.fail)
            : chalk.dim(ICON.pending);
    const isCurrent = currentStepId && step.id === currentStepId;
    const label = isCurrent
      ? chalk.bold.white(`${step.id}: ${step.title}`)
      : chalk.dim(`${step.id}: ${step.title}`);
    const pointer = isCurrent ? chalk.cyan(` ${ICON.arrow} current`) : "";
    console.log(`  ${icon} ${label}${pointer}`);
  }
}

// ── Provider Events (Claude Code-style) ──────────────────────────────

function renderThinkingBlock(text: string): void {
  const w = Math.min(termWidth(), 80);
  const header = `─ ${ICON.thinking} Thinking `;
  const headerPad = Math.max(0, w - 4 - stripAnsi(header).length);

  console.log(chalk.dim(`┌${header}${"─".repeat(headerPad)}┐`));

  const maxLineLen = w - 6;
  const lines = text.split(/\n/).flatMap((line) => {
    const trimmed = normalizeInline(line);
    if (trimmed.length <= maxLineLen) {
      return [trimmed];
    }
    // Word-wrap
    const words = trimmed.split(" ");
    const wrapped: string[] = [];
    let current = "";
    for (const word of words) {
      if (current.length + word.length + 1 > maxLineLen) {
        wrapped.push(current);
        current = word;
      } else {
        current = current ? `${current} ${word}` : word;
      }
    }
    if (current) {
      wrapped.push(current);
    }
    return wrapped;
  });

  for (const line of lines.slice(0, 6)) {
    const pad = Math.max(0, maxLineLen - line.length);
    console.log(chalk.dim(`│ ${line}${" ".repeat(pad)} │`));
  }
  if (lines.length > 6) {
    const moreMsg = `... ${lines.length - 6} more lines`;
    const pad = Math.max(0, maxLineLen - moreMsg.length);
    console.log(chalk.dim(`│ ${moreMsg}${" ".repeat(pad)} │`));
  }
  console.log(chalk.dim(`└${"─".repeat(w - 2)}┘`));
}

function renderToolCall(event: ProviderOutputEvent): void {
  const name = asString(event.payload.name) ?? asString(event.payload.command) ?? "tool";
  const command = asString(event.payload.command);
  const detail = command ? chalk.dim(` ${truncateInline(command, 60)}`) : "";
  console.log(`  ${chalk.yellow(ICON.tool)} ${chalk.bold(name)}${detail}`);
}

function renderToolResult(event: ProviderOutputEvent): void {
  const name = asString(event.payload.name) ?? "tool";
  const status = asString(event.payload.status) ?? "ok";
  const icon = status === "error" || status === "fail" ? chalk.red(ICON.toolFail) : chalk.green(ICON.toolOk);
  console.log(`  ${icon} ${chalk.dim(name)} ${chalk.dim(status)}`);
}

function renderErrorEvent(event: ProviderOutputEvent): void {
  const message = asString(event.payload.error) ?? asString(event.payload.message) ?? eventPreview(event, 200);
  console.log(`  ${chalk.red(ICON.error)} ${chalk.red(truncateInline(message, 120))}`);
}

function renderAssistantText(text: string): void {
  console.log(chalk.dim(`  ${ICON.arrow} ${truncateInline(text, 120)}`));
}

const MAX_TIMELINE_EVENTS = 16;

export function printProviderOutput(args: {
  step: Step;
  outputMode: OutputMode;
  thinkingVisibility: ThinkingVisibility;
  events: ProviderOutputEvent[];
  finalText: string;
  thinkingSummary?: string;
  rawOutput?: { stdout: string; stderr: string };
}): void {
  if (args.outputMode === "raw") {
    const rawOut = [args.rawOutput?.stdout, args.rawOutput?.stderr].filter(Boolean).join("\n").trim();
    if (rawOut) {
      console.log(chalk.dim(truncateText(rawOut, 360)));
    }
    return;
  }

  if (args.outputMode === "timeline") {
    // Group thinking events
    const thinkingTexts: string[] = [];
    const nonThinkingEvents: ProviderOutputEvent[] = [];

    for (const event of args.events) {
      if (event.type === "thinking") {
        if (args.thinkingVisibility === "hidden") {
          continue;
        }
        const text = asString(event.payload.text) ?? asString(event.payload.summary) ?? "";
        if (text.trim()) {
          thinkingTexts.push(text.trim());
        }
      } else {
        nonThinkingEvents.push(event);
      }
    }

    // Render thinking block
    if (thinkingTexts.length > 0) {
      if (args.thinkingVisibility === "full") {
        renderThinkingBlock(thinkingTexts.join("\n"));
      } else {
        const summary = args.thinkingSummary ?? truncateInline(thinkingTexts.join(" | "), 200);
        console.log(chalk.dim(`  ${ICON.thinking} ${summary}`));
        if (thinkingTexts.length > 1) {
          const recent = thinkingTexts.slice(-3);
          for (const [index, text] of recent.entries()) {
            const ordinal = thinkingTexts.length - recent.length + index + 1;
            console.log(chalk.dim(`  ${ICON.thinking} [${ordinal}/${thinkingTexts.length}] ${truncateInline(text, 140)}`));
          }
        }
      }
    }

    // Render tool/assistant/error events
    let rendered = 0;
    for (const event of nonThinkingEvents) {
      if (rendered >= MAX_TIMELINE_EVENTS) {
        console.log(chalk.dim(`  ... ${nonThinkingEvents.length - rendered} more events`));
        break;
      }

      switch (event.type) {
        case "tool_call":
          renderToolCall(event);
          rendered++;
          break;
        case "tool_result":
          renderToolResult(event);
          rendered++;
          break;
        case "error":
          renderErrorEvent(event);
          rendered++;
          break;
        case "assistant_text": {
          const text = asString(event.payload.text) ?? "";
          if (text.trim()) {
            renderAssistantText(text);
            rendered++;
          }
          break;
        }
        case "status": {
          const status = asString(event.payload.status) ?? "";
          if (status.trim()) {
            console.log(chalk.dim(`  ${ICON.pending} ${truncateInline(status, 120)}`));
            rendered++;
          }
          break;
        }
        default:
          break;
      }
    }
  }

  // Final text
  if (args.finalText.trim().length > 0) {
    console.log(chalk.green(`  ${ICON.pass} ${truncateInline(args.finalText, 200)}`));
  }
}

// ── Provider Attempt Start/Done ──────────────────────────────────────

export function printProviderAttemptStart(args: {
  step: Step;
  model: string;
  attempt: number;
  maxAttempts: number;
  timeoutMs: number;
  sessionStrategy: SessionStrategy;
  resumeSessionId?: string;
}): void {
  if (currentSpinner) {
    currentSpinner.stop();
  }
  const sessionInfo = `${args.sessionStrategy}${args.resumeSessionId ? `(${args.resumeSessionId})` : ""}`;
  currentSpinner = ora({
    text: chalk.cyan(`Loading ${chalk.bold(args.model)} (attempt ${args.attempt}/${args.maxAttempts}, session=${sessionInfo})`),
    color: "cyan",
    spinner: "dots",
  }).start();
}

export function printProviderHeartbeat(args: {
  step: Step;
  model: string;
  attempt: number;
  elapsedMs: number;
  timeoutMs: number;
  thinkingChunk?: string;
}): void {
  const elapsed = formatDuration(args.elapsedMs);
  if (currentSpinner) {
    const thinkingText = args.thinkingChunk ? `: ${truncateInline(args.thinkingChunk, 140)}` : " thinking...";
    currentSpinner.text = chalk.cyan(`${ICON.thinking} ${args.model}${thinkingText} (${elapsed})`);
  } else {
    const thinkingText = args.thinkingChunk ? `: ${truncateInline(args.thinkingChunk, 140)}` : " thinking...";
    console.log(chalk.dim(`  ${ICON.thinking} ${args.model}${thinkingText} ${elapsed}`));
  }
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
  const elapsed = formatDuration(args.durationMs);
  const state = args.ok
    ? "ok"
    : args.modelUnavailable
      ? "model_unavailable"
      : args.timedOut
        ? "timeout"
        : "error";

  if (currentSpinner) {
    const msg = `${args.model} (${state}, ${elapsed}${args.sessionId ? `, session=${args.sessionId}` : ""})`;
    if (args.ok) {
      currentSpinner.succeed(chalk.green(msg));
    } else {
      currentSpinner.fail(chalk.red(msg));
    }
    currentSpinner = null;
  } else {
    const icon = args.ok ? chalk.green(ICON.pass) : chalk.red(ICON.fail);
    console.log(`${icon} ${args.model} state=${state} exit=${args.exitCode ?? "?"} ${elapsed}`);
  }
}

// ── Retry ─────────────────────────────────────────────────────────────

export function printRetryScheduled(args: {
  step: Step;
  model: string;
  attempt: number;
  delayMs: number;
  reason: string;
}): void {
  console.log(
    chalk.yellow(
      `  ↻ Retry ${args.model} in ${formatDuration(args.delayMs)} (attempt ${args.attempt}) reason=${truncateInline(args.reason, 100)}`,
    ),
  );
}

// ── Success Criteria ──────────────────────────────────────────────────

export function printSuccessCriteriaStart(args: { step: Step; command: string }): void {
  console.log(chalk.dim(`  ${ICON.tool} Running success criteria: ${truncateInline(args.command, 100)}`));
}

export function printSuccessCriteriaDone(args: {
  step: Step;
  passed: boolean;
  durationMs: number;
}): void {
  const icon = args.passed ? chalk.green(ICON.pass) : chalk.red(ICON.fail);
  const label = args.passed ? "pass" : "fail";
  console.log(`  ${icon} Success criteria: ${label} (${formatDuration(args.durationMs)})`);
}

// ── Step Post-Checks ──────────────────────────────────────────────────

export function printStepPostChecksStart(args: { step: Step; total: number }): void {
  console.log(chalk.dim(`  ${ICON.tool} Running ${args.total} post-check(s)...`));
}

export function printStepPostCheckResult(args: {
  step: Step;
  command: string;
  index: number;
  total: number;
  passed: boolean;
  durationMs: number;
}): void {
  const icon = args.passed ? chalk.green(ICON.toolOk) : chalk.red(ICON.toolFail);
  console.log(
    `  ${icon} Post-check ${args.index}/${args.total}: ${truncateInline(args.command, 80)} (${formatDuration(args.durationMs)})`,
  );
}

// ── Iteration Result (styled pass/fail) ──────────────────────────────

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
  if (text.includes("thinking") && (text.includes("unsupported") || text.includes("not supported") || text.includes("invalid"))) {
    return "thinking_unsupported";
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

function renderErrorBlock(info: string, errorClass: string): void {
  const w = Math.min(termWidth(), 80);
  const header = `─ ${ICON.error} Error (${errorClass}) `;
  const headerPad = Math.max(0, w - 4 - stripAnsi(header).length);

  console.log(chalk.red(`┌${header}${"─".repeat(headerPad)}┐`));

  const maxLineLen = w - 6;
  const lines = info.split(/\n/).map((line) => truncateInline(line, maxLineLen)).slice(0, 8);
  for (const line of lines) {
    const pad = Math.max(0, maxLineLen - stripAnsi(line).length);
    console.log(chalk.red(`│ ${line}${" ".repeat(pad)} │`));
  }
  if (info.split(/\n/).length > 8) {
    const moreMsg = `... truncated`;
    const pad = Math.max(0, maxLineLen - moreMsg.length);
    console.log(chalk.red(`│ ${moreMsg}${" ".repeat(pad)} │`));
  }
  console.log(chalk.red(`└${"─".repeat(w - 2)}┘`));
}

export function printIterationResult(args: {
  step: Step;
  passed: boolean;
  attempts: number;
  maxAttempts: number;
  info?: string;
  durationMs?: number;
}): void {
  const duration = args.durationMs ? ` (${formatDuration(args.durationMs)})` : "";

  if (args.passed) {
    console.log(
      chalk.green.bold(
        `\n${ICON.pass} PASS ${args.step.id}: ${args.step.title}${duration}`,
      ),
    );
    if (args.info) {
      console.log(chalk.dim(`  ${args.info}`));
    }
  } else {
    const errorClass = args.info ? classifyError(args.info) : "unknown";
    console.log(
      chalk.red.bold(
        `\n${ICON.fail} FAIL ${args.step.id}: ${args.step.title} (attempt ${args.attempts}/${args.maxAttempts}${duration})`,
      ),
    );
    if (args.info) {
      renderErrorBlock(args.info, errorClass);
    }
  }
}
