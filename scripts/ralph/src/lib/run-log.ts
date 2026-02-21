import path from "node:path";
import { randomBytes } from "node:crypto";

import fs from "fs-extra";

import { resolveAbsolutePath } from "./io.js";

export type RunLogFormat = "text" | "jsonl";

export type RunEventName =
  | "run_started"
  | "iteration_started"
  | "provider_retry"
  | "provider_event"
  | "step_done"
  | "step_failed"
  | "post_check_failed"
  | "run_finished";

export interface RunLogEvent {
  event: RunEventName;
  timestamp: string;
  provider: string;
  model: string;
  trace_id: string;
  group_id: string;
  span_id: string;
  stepId?: string;
  stepTitle?: string;
  iteration?: number;
  maxIterations?: number;
  durationMs?: number;
  exitCode?: number | null;
  attempt?: number;
  maxAttempts?: number;
  sessionId?: string;
  providerEventType?: string;
  preview?: string;
  details?: string;
}

export interface RunLoggerConfig {
  cwd: string;
  provider: string;
  model: string;
  format: RunLogFormat;
  runLogPath?: string;
  redactSecrets?: boolean;
  retentionDays?: number;
}

interface OTelExportConfig {
  enabled: boolean;
  endpoint: string;
  headers: Record<string, string>;
  serviceName: string;
  scopeName: string;
  timeoutMs: number;
}

type RunLogInput = Omit<RunLogEvent, "timestamp" | "provider" | "model" | "trace_id" | "group_id" | "span_id"> & {
  trace_id?: string;
  group_id?: string;
  span_id?: string;
};

export class RalphRunLogger {
  private readonly format: RunLogFormat;
  private readonly provider: string;
  private readonly model: string;
  private readonly traceId: string;
  private readonly otel: OTelExportConfig;
  private readonly redactSecrets: boolean;
  private otelWarningEmitted = false;
  readonly filePath: string;

  constructor(config: RunLoggerConfig, filePath: string, traceId: string, otel: OTelExportConfig) {
    this.format = config.format;
    this.provider = config.provider;
    this.model = config.model;
    this.filePath = filePath;
    this.traceId = traceId;
    this.otel = otel;
    this.redactSecrets = config.redactSecrets !== false;
  }

  async log(event: RunLogInput): Promise<void> {
    const payload: RunLogEvent = {
      ...event,
      timestamp: new Date().toISOString(),
      provider: this.provider,
      model: this.model,
      trace_id: event.trace_id ?? this.traceId,
      group_id: event.group_id ?? deriveGroupId(event),
      span_id: event.span_id ?? createSpanId(),
    };

    const safePayload = this.redactSecrets ? sanitizeRunLogEvent(payload) : payload;
    const line = `${JSON.stringify(safePayload)}\n`;
    await fs.appendFile(this.filePath, line, "utf8");
    if (this.format === "jsonl") {
      process.stdout.write(line);
    }

    await this.exportToOtel(safePayload);
  }

  private async exportToOtel(event: RunLogEvent): Promise<void> {
    if (!this.otel.enabled) {
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.otel.timeoutMs);
    const body = {
      resourceLogs: [
        {
          resource: {
            attributes: [
              attrString("service.name", this.otel.serviceName),
              attrString("service.namespace", "directstock"),
              attrString("service.version", "0.1.0"),
            ],
          },
          scopeLogs: [
            {
              scope: {
                name: this.otel.scopeName,
              },
              logRecords: [
                {
                  timeUnixNano: toUnixNano(event.timestamp),
                  severityNumber: severityNumberForEvent(event.event),
                  severityText: severityTextForEvent(event.event),
                  body: { stringValue: JSON.stringify(event) },
                  attributes: [
                    attrString("event.name", event.event),
                    attrString("provider", event.provider),
                    attrString("model", event.model),
                    attrString("trace_id", event.trace_id),
                    attrString("group_id", event.group_id),
                    attrString("span_id", event.span_id),
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    try {
      const response = await fetch(this.otel.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...this.otel.headers,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok && !this.otelWarningEmitted) {
        this.otelWarningEmitted = true;
        console.warn(
          `[ralph telemetry] OTLP export failed (${response.status}) for ${this.otel.endpoint}. Continuing without blocking.`,
        );
      }
    } catch (error) {
      if (!this.otelWarningEmitted) {
        this.otelWarningEmitted = true;
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          `[ralph telemetry] OTLP export error for ${this.otel.endpoint}: ${message}. Continuing without blocking.`,
        );
      }
    } finally {
      clearTimeout(timeout);
    }
  }
}

function createTraceId(): string {
  return randomBytes(16).toString("hex");
}

function createSpanId(): string {
  return randomBytes(8).toString("hex");
}

function deriveGroupId(event: RunLogInput): string {
  if (event.stepId) {
    return `step:${event.stepId}`;
  }
  if (typeof event.iteration === "number") {
    return `iteration:${event.iteration}`;
  }
  return "run";
}

function parseHeaderList(value: string | undefined): Record<string, string> {
  if (!value) {
    return {};
  }
  const headers: Record<string, string> = {};
  for (const entry of value.split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) {
      continue;
    }
    const index = trimmed.indexOf("=");
    if (index <= 0) {
      continue;
    }
    const key = trimmed.slice(0, index).trim();
    const headerValue = trimmed.slice(index + 1).trim();
    if (!key || !headerValue) {
      continue;
    }
    headers[key] = headerValue;
  }
  return headers;
}

function resolveOtelEndpointFromEnv(env: NodeJS.ProcessEnv): string {
  if (env.RALPH_OTEL_ENDPOINT) {
    return env.RALPH_OTEL_ENDPOINT;
  }
  if (env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT) {
    return env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT;
  }
  const base = env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!base) {
    return "";
  }
  return base.endsWith("/") ? `${base}v1/logs` : `${base}/v1/logs`;
}

function resolveOtelExportConfig(env: NodeJS.ProcessEnv): OTelExportConfig {
  const endpoint = resolveOtelEndpointFromEnv(env);
  const enabled = (env.RALPH_OTEL_EXPORT ?? "0") === "1" && endpoint.length > 0;
  const headers = {
    ...parseHeaderList(env.OTEL_EXPORTER_OTLP_HEADERS),
    ...parseHeaderList(env.RALPH_OTEL_HEADERS),
  };
  const timeoutMs = Number.parseInt(env.RALPH_OTEL_TIMEOUT_MS ?? "1500", 10);

  return {
    enabled,
    endpoint,
    headers,
    serviceName: env.RALPH_OTEL_SERVICE_NAME ?? "direct-ralph",
    scopeName: env.RALPH_OTEL_SCOPE_NAME ?? "directstock.ralph.loop",
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 1500,
  };
}

function attrString(key: string, value: string): { key: string; value: { stringValue: string } } {
  return { key, value: { stringValue: value } };
}

function toUnixNano(isoTimestamp: string): string {
  const ms = Date.parse(isoTimestamp);
  if (!Number.isFinite(ms)) {
    return "0";
  }
  return `${Math.trunc(ms) * 1_000_000}`;
}

function severityNumberForEvent(event: RunEventName): number {
  if (event === "step_failed" || event === "post_check_failed") {
    return 17;
  }
  return 9;
}

function severityTextForEvent(event: RunEventName): "INFO" | "ERROR" {
  if (event === "step_failed" || event === "post_check_failed") {
    return "ERROR";
  }
  return "INFO";
}

function buildDefaultRunLogPath(cwd: string): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return path.join(cwd, ".ralph", "runs", `${stamp}.jsonl`);
}

function sanitizeRunLogEvent(event: RunLogEvent): RunLogEvent {
  return sanitizeUnknown(event) as RunLogEvent;
}

function sanitizeUnknown(value: unknown): unknown {
  if (typeof value === "string") {
    return redactSecretLikeText(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeUnknown(item));
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, sanitizeUnknown(entry)]);
    return Object.fromEntries(entries);
  }
  return value;
}

function redactSecretLikeText(raw: string): string {
  let value = raw;

  value = value.replace(/\b(Bearer)\s+[A-Za-z0-9._~+/\-=]{12,}\b/gi, "$1 [REDACTED]");
  value = value.replace(/\bsk-(?:proj-|live-|test-)?[A-Za-z0-9_-]{16,}\b/g, "[REDACTED_KEY]");
  value = value.replace(/\bsk-ant-[A-Za-z0-9_-]{16,}\b/gi, "[REDACTED_KEY]");
  value = value.replace(/\bAIza[0-9A-Za-z\-_]{20,}\b/g, "[REDACTED_KEY]");
  value = value.replace(/\bghp_[A-Za-z0-9]{20,}\b/g, "[REDACTED_KEY]");
  value = value.replace(/\bgithub_pat_[A-Za-z0-9_]{20,}\b/gi, "[REDACTED_KEY]");
  value = value.replace(
    /\b(api[_-]?key|token|secret|password)\b(\s*[:=]\s*)([^,\s;]+)/gi,
    (_match, label: string, separator: string) => `${label}${separator}[REDACTED]`,
  );

  return value;
}

export async function cleanupRunLogDirectory(args: {
  directoryPath: string;
  retentionDays: number;
  nowMs?: number;
}): Promise<number> {
  if (!Number.isFinite(args.retentionDays) || args.retentionDays < 0) {
    return 0;
  }

  const maxAgeMs = args.retentionDays * 24 * 60 * 60 * 1000;
  const thresholdMs = (args.nowMs ?? Date.now()) - maxAgeMs;
  const entries = await fs.readdir(args.directoryPath, { withFileTypes: true });
  let deletedCount = 0;

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".jsonl")) {
      continue;
    }
    const fullPath = path.join(args.directoryPath, entry.name);
    const stats = await fs.stat(fullPath);
    if (stats.mtimeMs < thresholdMs) {
      await fs.remove(fullPath);
      deletedCount += 1;
    }
  }

  return deletedCount;
}

export async function createRunLogger(config: RunLoggerConfig): Promise<RalphRunLogger> {
  const filePath = resolveAbsolutePath(config.runLogPath ?? buildDefaultRunLogPath(config.cwd), config.cwd);
  const logDirectory = path.dirname(filePath);
  await fs.ensureDir(logDirectory);
  if (typeof config.retentionDays === "number") {
    try {
      await cleanupRunLogDirectory({
        directoryPath: logDirectory,
        retentionDays: config.retentionDays,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[ralph run-log] retention cleanup failed: ${message}`);
    }
  }
  await fs.writeFile(filePath, "", "utf8");
  return new RalphRunLogger(config, filePath, createTraceId(), resolveOtelExportConfig(process.env));
}
