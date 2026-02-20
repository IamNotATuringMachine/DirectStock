import { describe, expect, it } from "vitest";

import { normalizeProviderModel, resolveAutoCommitPolicy, resolveProviderEnv } from "../src/ralph.js";

describe("ralph auto-commit policy", () => {
  it("normalizes known google model id typo from old presets", () => {
    expect(normalizeProviderModel("google", "gemini-3.0-flash-preview")).toBe("gemini-3-flash-preview");
    expect(normalizeProviderModel("google", "gemini-3-flash-preview")).toBe("gemini-3-flash-preview");
    expect(normalizeProviderModel("openai", "gemini-3.0-flash-preview")).toBe("gemini-3.0-flash-preview");
  });

  it("keeps auto-commit enabled on clean worktree", () => {
    const result = resolveAutoCommitPolicy({
      requestedAutoCommit: true,
      dryRun: false,
      allowDirty: false,
      worktree: { available: true, dirty: false },
    });

    expect(result).toEqual({ autoCommit: true });
  });

  it("does not fail on dirty worktree and disables auto-commit by default", () => {
    const result = resolveAutoCommitPolicy({
      requestedAutoCommit: true,
      dryRun: false,
      allowDirty: false,
      worktree: { available: true, dirty: true },
    });

    expect(result.autoCommit).toBe(false);
    expect(result.warning).toContain("Working tree is dirty");
  });

  it("keeps auto-commit enabled on dirty worktree when allowDirty is true", () => {
    const result = resolveAutoCommitPolicy({
      requestedAutoCommit: true,
      dryRun: false,
      allowDirty: true,
      worktree: { available: true, dirty: true },
    });

    expect(result).toEqual({ autoCommit: true });
  });
});

describe("resolveProviderEnv", () => {
  const base = { HOME: "/home/user" };

  it("injects GEMINI_API_KEY for google provider", () => {
    const env = resolveProviderEnv("google", "key-google", base);
    expect(env["GEMINI_API_KEY"]).toBe("key-google");
    expect(env["HOME"]).toBe("/home/user");
  });

  it("injects GEMINI_API_KEY for google-api provider (regression: was missing)", () => {
    const env = resolveProviderEnv("google-api", "key-google-api", base);
    expect(env["GEMINI_API_KEY"]).toBe("key-google-api");
    expect(env["ANTHROPIC_API_KEY"]).toBeUndefined();
    expect(env["OPENAI_API_KEY"]).toBeUndefined();
  });

  it("injects ANTHROPIC_API_KEY for anthropic provider", () => {
    const env = resolveProviderEnv("anthropic", "key-claude", base);
    expect(env["ANTHROPIC_API_KEY"]).toBe("key-claude");
    expect(env["GEMINI_API_KEY"]).toBeUndefined();
  });

  it("injects OPENAI_API_KEY for openai provider", () => {
    const env = resolveProviderEnv("openai", "key-oai", base);
    expect(env["OPENAI_API_KEY"]).toBe("key-oai");
    expect(env["GEMINI_API_KEY"]).toBeUndefined();
  });

  it("does not inject any API key when finalApiKey is undefined", () => {
    const env = resolveProviderEnv("google-api", undefined, base);
    expect(env["GEMINI_API_KEY"]).toBeUndefined();
    expect(Object.keys(env)).toEqual(["HOME"]);
  });
});
