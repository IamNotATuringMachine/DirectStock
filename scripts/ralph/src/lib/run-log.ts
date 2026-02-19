import path from "node:path";

import fs from "fs-extra";

import { resolveAbsolutePath } from "./io.js";

export type RunLogFormat = "text" | "jsonl";

export type RunEventName =
  | "run_started"
  | "iteration_started"
  | "provider_retry"
  | "step_done"
  | "step_failed"
  | "post_check_failed"
  | "run_finished";

export interface RunLogEvent {
  event: RunEventName;
  timestamp: string;
  provider: string;
  model: string;
  stepId?: string;
  stepTitle?: string;
  iteration?: number;
  maxIterations?: number;
  durationMs?: number;
  exitCode?: number | null;
  attempt?: number;
  maxAttempts?: number;
  sessionId?: string;
  details?: string;
}

export interface RunLoggerConfig {
  cwd: string;
  provider: string;
  model: string;
  format: RunLogFormat;
  runLogPath?: string;
}

export class RalphRunLogger {
  private readonly format: RunLogFormat;
  private readonly provider: string;
  private readonly model: string;
  readonly filePath: string;

  constructor(config: RunLoggerConfig, filePath: string) {
    this.format = config.format;
    this.provider = config.provider;
    this.model = config.model;
    this.filePath = filePath;
  }

  async log(event: Omit<RunLogEvent, "timestamp" | "provider" | "model">): Promise<void> {
    const payload: RunLogEvent = {
      ...event,
      timestamp: new Date().toISOString(),
      provider: this.provider,
      model: this.model,
    };

    const line = `${JSON.stringify(payload)}\n`;
    await fs.appendFile(this.filePath, line, "utf8");
    if (this.format === "jsonl") {
      process.stdout.write(line);
    }
  }
}

function buildDefaultRunLogPath(cwd: string): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return path.join(cwd, ".ralph", "runs", `${stamp}.jsonl`);
}

export async function createRunLogger(config: RunLoggerConfig): Promise<RalphRunLogger> {
  const filePath = resolveAbsolutePath(config.runLogPath ?? buildDefaultRunLogPath(config.cwd), config.cwd);
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, "", "utf8");
  return new RalphRunLogger(config, filePath);
}
