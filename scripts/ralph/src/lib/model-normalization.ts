import type { ProviderId } from "../providers/types.js";

export function normalizeProviderModel(providerId: ProviderId, model: string): string {
  if (providerId === "google" && model === "gemini-3.0-flash-preview") {
    return "gemini-3-flash-preview";
  }
  return model;
}
