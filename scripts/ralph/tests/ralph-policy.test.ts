import { describe, expect, it } from "vitest";

import { normalizeProviderModel, resolveAutoCommitPolicy } from "../src/ralph.js";

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
