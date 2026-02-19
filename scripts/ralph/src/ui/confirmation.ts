import path from "node:path";

import chalk from "chalk";

import type { RunLogFormat } from "../lib/run-log.js";
import type { PostCheckProfile } from "../post-checks.js";
import type { SessionStrategy } from "../providers/types.js";

export interface ConfirmationData {
  provider: string;
  model: string;
  thinking: string;
  planPath: string;
  stepCount: number;
  maxIterations: number;
  workingDir: string;
  dryRun: boolean;
  autoCommit: boolean;
  sessionStrategy: SessionStrategy;
  postCheckProfile: PostCheckProfile;
  logFormat: RunLogFormat;
  runLogPath: string;
  strictProviderCapabilities: boolean;
}

export function renderConfirmation(data: ConfirmationData): string {
  const planPath = path.relative(data.workingDir, data.planPath) || data.planPath;
  const runLogPath = path.relative(data.workingDir, data.runLogPath) || data.runLogPath;
  const maxWidth = resolveSummaryWidth();

  const lines = [
    `${chalk.cyan("Runtime")}  ${data.provider} / ${data.model} / thinking=${data.thinking}`,
    `${chalk.cyan("Plan")}     ${truncateMiddle(planPath, maxWidth - 15)} / ${data.stepCount} steps / iter=${data.maxIterations}`,
    `${chalk.cyan("Exec")}     session=${data.sessionStrategy} / post-check=${data.postCheckProfile} / dry=${formatBoolean(data.dryRun)} / commit=${formatBoolean(data.autoCommit)}`,
    `${chalk.cyan("Log")}      format=${data.logFormat} / strict-caps=${formatBoolean(data.strictProviderCapabilities)} / ${truncateMiddle(runLogPath, maxWidth - 42)}`,
    `${chalk.cyan("CWD")}      ${truncateMiddle(data.workingDir, maxWidth - 11)}`,
  ];

  return `\n${chalk.bold("RALPH LOOP - Configuration")}\n${lines.join("\n")}\n`;
}

function resolveSummaryWidth(): number {
  const terminalWidth = process.stdout.columns ?? 130;
  return Math.max(72, Math.min(terminalWidth - 4, 140));
}

function formatBoolean(value: boolean): string {
  return value ? chalk.green("yes") : chalk.gray("no");
}

function truncateMiddle(value: string, maxLength: number): string {
  if (value.length <= maxLength || maxLength <= 6) {
    return value;
  }

  const headLength = Math.ceil((maxLength - 3) / 2);
  const tailLength = Math.floor((maxLength - 3) / 2);
  return `${value.slice(0, headLength)}...${value.slice(value.length - tailLength)}`;
}
