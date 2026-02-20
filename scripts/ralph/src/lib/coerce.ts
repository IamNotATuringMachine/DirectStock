import type { ProviderId, SessionStrategy } from "../providers/types.js";
import type { OutputMode, ThinkingVisibility } from "../providers/output-events.js";
import type { PostCheckProfile } from "../post-checks.js";
import type { RunLogFormat } from "./run-log.js";

const DEFAULT_SESSION_STRATEGY: SessionStrategy = "reset";
const DEFAULT_POST_CHECK_PROFILE: PostCheckProfile = "fast";
const DEFAULT_LOG_FORMAT: RunLogFormat = "text";
const DEFAULT_OUTPUT_MODE: OutputMode = "timeline";
const DEFAULT_THINKING_VISIBILITY: ThinkingVisibility = "summary";

const VALID_SESSION_STRATEGIES: SessionStrategy[] = ["reset", "resume"];
const VALID_POST_CHECK_PROFILES: PostCheckProfile[] = ["none", "fast", "governance", "full"];
const VALID_LOG_FORMATS: RunLogFormat[] = ["text", "jsonl"];
const VALID_OUTPUT_MODES: OutputMode[] = ["timeline", "final", "raw"];
const VALID_THINKING_VISIBILITY: ThinkingVisibility[] = ["summary", "hidden", "full"];

export function coerceSessionStrategy(value?: string): SessionStrategy {
  if (!value) {
    return DEFAULT_SESSION_STRATEGY;
  }
  if (VALID_SESSION_STRATEGIES.includes(value as SessionStrategy)) {
    return value as SessionStrategy;
  }
  throw new Error(`Invalid session strategy: ${value}`);
}

export function coerceProviderId(value?: string): ProviderId | null {
  if (!value) {
    return null;
  }
  if (value === "openai" || value === "anthropic" || value === "google") {
    return value;
  }
  throw new Error(`Invalid provider: ${value}`);
}

export function coercePostCheckProfile(value?: string): PostCheckProfile {
  if (!value) {
    return DEFAULT_POST_CHECK_PROFILE;
  }
  if (VALID_POST_CHECK_PROFILES.includes(value as PostCheckProfile)) {
    return value as PostCheckProfile;
  }
  throw new Error(`Invalid post-check profile: ${value}`);
}

export function coerceLogFormat(value?: string): RunLogFormat {
  if (!value) {
    return DEFAULT_LOG_FORMAT;
  }
  if (VALID_LOG_FORMATS.includes(value as RunLogFormat)) {
    return value as RunLogFormat;
  }
  throw new Error(`Invalid log format: ${value}`);
}

export function coerceOutputMode(value?: string): OutputMode {
  if (!value) {
    return DEFAULT_OUTPUT_MODE;
  }
  if (VALID_OUTPUT_MODES.includes(value as OutputMode)) {
    return value as OutputMode;
  }
  throw new Error(`Invalid output mode: ${value}`);
}

export function coerceThinkingVisibility(value?: string): ThinkingVisibility {
  if (!value) {
    return DEFAULT_THINKING_VISIBILITY;
  }
  if (VALID_THINKING_VISIBILITY.includes(value as ThinkingVisibility)) {
    return value as ThinkingVisibility;
  }
  throw new Error(`Invalid thinking visibility: ${value}`);
}
