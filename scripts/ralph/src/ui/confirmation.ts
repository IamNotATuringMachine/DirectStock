import path from "node:path";

import chalk from "chalk";
import Table from "cli-table3";

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
  const table = new Table({
    head: [chalk.cyan("Field"), chalk.cyan("Value")],
    colWidths: [20, 88],
    wordWrap: true,
  });

  table.push(
    ["Provider", data.provider],
    ["Model", data.model],
    ["Thinking", data.thinking],
    ["Session Strategy", data.sessionStrategy],
    ["Post-check Profile", data.postCheckProfile],
    ["Log Format", data.logFormat],
    ["Run Log Path", `${path.relative(data.workingDir, data.runLogPath) || data.runLogPath}`],
    ["Strict Provider Caps", data.strictProviderCapabilities ? "yes" : "no"],
    ["Plan", `${path.relative(data.workingDir, data.planPath) || data.planPath} (${data.stepCount} steps)`],
    ["Iterations", String(data.maxIterations)],
    ["Working Dir", data.workingDir],
    ["Dry Run", data.dryRun ? "yes" : "no"],
    ["Auto Commit", data.autoCommit ? "yes" : "no"],
  );

  return `\n${chalk.bold("RALPH LOOP - Configuration")}\n${table.toString()}\n`;
}
