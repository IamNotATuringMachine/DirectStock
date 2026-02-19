import { beforeEach, describe, expect, it, vi, type MockedFunction } from "vitest";

vi.mock("../src/lib/process.js", () => ({
  runCommand: vi.fn(),
}));

import { runCommand } from "../src/lib/process.js";
import { ensureCleanWorktree, readWorktreeState } from "../src/lib/git.js";

describe("git helpers", () => {
  const mockRunCommand = runCommand as MockedFunction<typeof runCommand>;

  beforeEach(() => {
    mockRunCommand.mockReset();
  });

  it("reports dirty worktree when porcelain output is not empty", async () => {
    mockRunCommand.mockResolvedValue({
      exitCode: 0,
      timedOut: false,
      stdout: " M scripts/ralph/src/ralph.ts\n",
      stderr: "",
    });

    const state = await readWorktreeState(process.cwd());
    expect(state).toEqual({ available: true, dirty: true });
  });

  it("reports unavailable state when git status fails", async () => {
    mockRunCommand.mockResolvedValue({
      exitCode: 128,
      timedOut: false,
      stdout: "",
      stderr: "fatal: not a git repository",
    });

    const state = await readWorktreeState(process.cwd());
    expect(state.available).toBe(false);
    expect(state.dirty).toBe(false);
    expect(state.error).toContain("not a git repository");
  });

  it("throws for dirty worktree in ensureCleanWorktree", async () => {
    mockRunCommand.mockResolvedValue({
      exitCode: 0,
      timedOut: false,
      stdout: "?? untracked.file\n",
      stderr: "",
    });

    await expect(ensureCleanWorktree(process.cwd())).rejects.toThrow("Working tree is dirty");
  });
});
