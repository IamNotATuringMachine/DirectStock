import { captureGitState, type GitWorktreeFingerprint } from "../lib/git.js";

export async function captureIterationContext(
  cwd: string,
  snapshot?: Pick<GitWorktreeFingerprint, "statusShort">,
): Promise<string> {
  return captureGitState(cwd, snapshot);
}
