import type { WorktreeState } from "./git.js";

export interface AutoCommitPolicyInput {
  requestedAutoCommit: boolean;
  dryRun: boolean;
  allowDirty: boolean;
  worktree: WorktreeState;
}

export interface AutoCommitPolicyOutput {
  autoCommit: boolean;
  warning?: string;
}

export function resolveAutoCommitPolicy(input: AutoCommitPolicyInput): AutoCommitPolicyOutput {
  if (!input.requestedAutoCommit || input.dryRun) {
    return { autoCommit: input.requestedAutoCommit };
  }

  if (!input.worktree.available) {
    return {
      autoCommit: false,
      warning: `[ralph] git status failed (${input.worktree.error || "unknown error"}). Auto-commit disabled.`,
    };
  }

  if (input.worktree.dirty && !input.allowDirty) {
    return {
      autoCommit: false,
      warning:
        "[ralph] Working tree is dirty. Loop continues, auto-commit disabled. Use --allow-dirty to auto-commit anyway.",
    };
  }

  return { autoCommit: true };
}
