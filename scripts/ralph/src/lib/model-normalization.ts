import type { ProviderId } from "../providers/types.js";

/**
 * Normalises a raw model ID entered by the user (or loaded from an old preset)
 * to a canonical form expected by the provider CLI/API.
 *
 * Currently handles the Google "gemini-3.0-…" → "gemini-3-…" correction
 * (the dot-version prefix is not valid for the Gemini CLI / Native API).
 */
export function normalizeProviderModel(providerId: ProviderId, model: string): string {
  if (providerId === "google" || providerId === "google-api") {
    // "gemini-3.0-flash-preview" → "gemini-3-flash-preview"
    // The Gemini CLI and Native API use "gemini-3-…" without the ".0" minor version.
    return model.replace(/^gemini-(\d+)\.0-/, "gemini-$1-");
  }
  return model;
}
