import { captureGitState } from "../lib/git.js";

export async function captureIterationContext(cwd: string): Promise<string> {
  return captureGitState(cwd);
}
