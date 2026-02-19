import { anthropicAdapter } from "./anthropic.js";
import { googleAdapter } from "./google.js";
import { openaiAdapter } from "./openai.js";
import type { ProviderAdapter, ProviderId } from "./types.js";

export const PROVIDERS: Record<ProviderId, ProviderAdapter> = {
  anthropic: anthropicAdapter,
  openai: openaiAdapter,
  google: googleAdapter,
};

export function getProvider(providerId: ProviderId): ProviderAdapter {
  return PROVIDERS[providerId];
}
