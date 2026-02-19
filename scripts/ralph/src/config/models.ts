import type { ModelOption, ProviderId, ThinkingOption } from "../providers/types.js";

export const CUSTOM_MODEL_VALUE = "__custom_model__";

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  anthropic: "Anthropic (Claude Code CLI)",
  openai: "OpenAI (Codex CLI)",
  google: "Google (Gemini CLI)",
};

export const MODEL_CATALOG: Record<ProviderId, ModelOption[]> = {
  anthropic: [
    { value: "claude-sonnet-4-6-20250217", label: "claude-sonnet-4-6-20250217", tag: "SOTA" },
    { value: "claude-opus-4-6-20250205", label: "claude-opus-4-6-20250205" },
    { value: "claude-sonnet-4-5-20241022", label: "claude-sonnet-4-5-20241022" },
    { value: "claude-haiku-4-5-20251015", label: "claude-haiku-4-5-20251015" },
  ],
  openai: [
    { value: "gpt-5.3-codex", label: "gpt-5.3-codex", tag: "SOTA" },
    { value: "gpt-5.2", label: "gpt-5.2" },
    { value: "gpt-5-codex", label: "gpt-5-codex" },
    { value: "gpt-5-mini", label: "gpt-5-mini" },
  ],
  google: [
    { value: "gemini-3-pro-preview", label: "gemini-3-pro-preview", tag: "SOTA" },
    { value: "gemini-3.1-pro-preview", label: "gemini-3.1-pro-preview" },
    { value: "gemini-3-flash-preview", label: "gemini-3-flash-preview" },
    { value: "gemini-2.5-pro", label: "gemini-2.5-pro" },
    { value: "gemini-2.5-flash", label: "gemini-2.5-flash" },
  ],
};

export const THINKING_CATALOG: Record<ProviderId, ThinkingOption[]> = {
  anthropic: [
    { value: "5", label: "5 (schnell)" },
    { value: "10", label: "10 (standard)" },
    { value: "25", label: "25 (komplex)" },
    { value: "50", label: "50 (maximale Autonomie)" },
  ],
  openai: [
    { value: "medium", label: "medium" },
    { value: "high", label: "high" },
    { value: "xhigh", label: "xhigh" },
  ],
  google: [
    { value: "high", label: "high" },
    { value: "medium", label: "medium" },
    { value: "low", label: "low" },
    { value: "none", label: "none" },
  ],
};
