import type { ProviderId, SessionStrategy } from "../providers/types.js";
import type { LiveProviderEventsMode, OutputMode, ThinkingVisibility } from "../providers/output-events.js";
import type { PostCheckProfile } from "../post-checks.js";
import type { RunLogFormat } from "./run-log.js";

export type EfficiencyMode = "forensic" | "balanced" | "performance";

const DEFAULT_SESSION_STRATEGY: SessionStrategy = "reset";
const DEFAULT_POST_CHECK_PROFILE: PostCheckProfile = "fast";
const DEFAULT_LOG_FORMAT: RunLogFormat = "text";
const DEFAULT_OUTPUT_MODE: OutputMode = "timeline";
const DEFAULT_THINKING_VISIBILITY: ThinkingVisibility = "full";
const DEFAULT_LIVE_PROVIDER_EVENTS: LiveProviderEventsMode = "auto";
const DEFAULT_EFFICIENCY_MODE: EfficiencyMode = "balanced";

const VALID_SESSION_STRATEGIES: SessionStrategy[] = ["reset", "resume"];
const VALID_POST_CHECK_PROFILES: PostCheckProfile[] = ["none", "fast", "governance", "full"];
const VALID_LOG_FORMATS: RunLogFormat[] = ["text", "jsonl"];
const VALID_OUTPUT_MODES: OutputMode[] = ["timeline", "final", "raw"];
const VALID_THINKING_VISIBILITY: ThinkingVisibility[] = ["summary", "hidden", "full"];
const VALID_LIVE_PROVIDER_EVENTS: LiveProviderEventsMode[] = ["auto", "on", "off"];
const VALID_EFFICIENCY_MODES: EfficiencyMode[] = ["forensic", "balanced", "performance"];

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
  if (value === "openai" || value === "anthropic" || value === "google" || value === "google-api") {
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

export function coerceLiveProviderEventsMode(value?: string): LiveProviderEventsMode {
  if (!value) {
    return DEFAULT_LIVE_PROVIDER_EVENTS;
  }
  if (VALID_LIVE_PROVIDER_EVENTS.includes(value as LiveProviderEventsMode)) {
    return value as LiveProviderEventsMode;
  }
  throw new Error(`Invalid live provider events mode: ${value}`);
}

export function coerceEfficiencyMode(value?: string): EfficiencyMode {
  if (!value) {
    return DEFAULT_EFFICIENCY_MODE;
  }
  if (VALID_EFFICIENCY_MODES.includes(value as EfficiencyMode)) {
    return value as EfficiencyMode;
  }
  throw new Error(`Invalid efficiency mode: ${value}`);
}
