import { createHash } from "node:crypto";

import { runCommand } from "./process.js";

export interface WorktreeState {
  available: boolean;
  dirty: boolean;
  error?: string;
}

export interface GitWorktreeFingerprint {
  head: string;
  statusShort: string;
  worktreeHash: string;
}

export async function readGitWorktreeFingerprint(cwd: string): Promise<GitWorktreeFingerprint> {
  const [headResult, statusResult] = await Promise.all([
    runCommand({ command: "git", args: ["rev-parse", "--verify", "HEAD"], cwd }),
    runCommand({ command: "git", args: ["status", "--short"], cwd }),
  ]);

  const head = (headResult.stdout || "(no-head)").trim() || "(no-head)";
  const statusShort = (statusResult.stdout || "").trim();
  const hashInput = `${head}\n${statusShort}`;
  const worktreeHash = createHash("sha256").update(hashInput).digest("hex");

  return {
    head,
    statusShort,
    worktreeHash,
  };
}

export async function captureGitState(
  cwd: string,
  snapshot?: Pick<GitWorktreeFingerprint, "statusShort">,
): Promise<string> {
  const [logResult, statusResult] = await Promise.all([
    runCommand({ command: "git", args: ["log", "--oneline", "-10"], cwd }),
    snapshot
      ? Promise.resolve({ stdout: snapshot.statusShort, stderr: "", exitCode: 0, timedOut: false })
      : runCommand({ command: "git", args: ["status", "--short"], cwd }),
  ]);

  const log = (logResult.stdout || "(no commits)").trim();
  const status = (statusResult.stdout || "(clean)").trim();

  return `Recent commits:\n${log}\n\nUncommitted changes:\n${status}`;
}

export async function readWorktreeState(cwd: string): Promise<WorktreeState> {
  const result = await runCommand({ command: "git", args: ["status", "--porcelain"], cwd });
  if (result.exitCode !== 0) {
    return {
      available: false,
      dirty: false,
      error: result.stderr || "unknown error",
    };
  }

  return {
    available: true,
    dirty: Boolean(result.stdout.trim()),
  };
}

export async function ensureCleanWorktree(cwd: string): Promise<void> {
  const state = await readWorktreeState(cwd);
  if (!state.available) {
    throw new Error(`git status failed: ${state.error || "unknown error"}`);
  }
  if (state.dirty) {
    throw new Error("Working tree is dirty. Use --allow-dirty to override.");
  }
}

export async function createStepCommit(cwd: string, message: string): Promise<boolean> {
  const addResult = await runCommand({ command: "git", args: ["add", "-A"], cwd });
  if (addResult.exitCode !== 0) {
    throw new Error(`git add failed: ${addResult.stderr || "unknown error"}`);
  }

  const stagedResult = await runCommand({ command: "git", args: ["diff", "--cached", "--quiet"], cwd });
  if (stagedResult.exitCode === 0) {
    return false;
  }

  const commitResult = await runCommand({
    command: "git",
    args: ["commit", "-m", message],
    cwd,
  });

  if (commitResult.exitCode !== 0) {
    throw new Error(`git commit failed: ${commitResult.stderr || "unknown error"}`);
  }

  return true;
}
