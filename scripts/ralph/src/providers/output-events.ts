export type ProviderOutputEventType =
  | "thinking"
  | "tool_call"
  | "tool_result"
  | "assistant_text"
  | "status"
  | "error";

export type OutputMode = "timeline" | "final" | "raw";
export type ThinkingVisibility = "summary" | "hidden" | "full";

export interface ProviderOutputEvent {
  type: ProviderOutputEventType;
  provider: string;
  timestamp: string;
  attempt: number;
  payload: Record<string, unknown>;
}

export function createProviderEvent(input: {
  type: ProviderOutputEventType;
  provider: string;
  attempt: number;
  payload?: Record<string, unknown>;
}): ProviderOutputEvent {
  return {
    type: input.type,
    provider: input.provider,
    timestamp: new Date().toISOString(),
    attempt: input.attempt,
    payload: input.payload ?? {},
  };
}

export function normalizeInlineText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function truncateText(value: string, maxLength = 180): string {
  const normalized = normalizeInlineText(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 3)}...`;
}

export function parseJsonLines(text: string): unknown[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter((item): item is unknown => item !== null);
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function eventPreview(event: ProviderOutputEvent, maxLength = 200): string {
  const candidates = [
    asString(event.payload.summary),
    asString(event.payload.text),
    asString(event.payload.message),
    asString(event.payload.command),
    asString(event.payload.status),
    asString(event.payload.error),
    asString(event.payload.line),
    JSON.stringify(event.payload),
  ].filter((item): item is string => Boolean(item && item.trim().length > 0));

  return truncateText(candidates[0] ?? "", maxLength);
}

export function summarizeThinking(events: ProviderOutputEvent[]): string | undefined {
  const parts = events
    .filter((event) => event.type === "thinking")
    .map((event) => asString(event.payload.summary) ?? asString(event.payload.text) ?? "")
    .map((item) => normalizeInlineText(item))
    .filter(Boolean);

  if (parts.length === 0) {
    return undefined;
  }

  const summary = parts.join(" | ");
  return truncateText(summary, 220);
}
