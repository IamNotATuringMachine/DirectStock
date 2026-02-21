import chalk from "chalk";

import { runCommand } from "./lib/process.js";

export type PostCheckProfile = "none" | "fast" | "governance" | "full";

export interface PostCheckResult {
  command: string;
  exitCode: number | null;
  output: string;
}

const FAST_CHECKS = [
  "./scripts/check_refactor_scope_allowlist.sh",
  "./scripts/check_file_size_limits.sh",
];

const GOVERNANCE_CHECKS = [
  ...FAST_CHECKS,
  "./scripts/agent_governance_check.sh",
  "python3 scripts/check_mcp_profile_parity.py --strict --format json",
  "python3 scripts/check_provider_capabilities.py --provider all --format json",
];

const FULL_CHECKS = [
  ...GOVERNANCE_CHECKS,
  "GOLDEN_TASK_MODE=smoke MIN_SUCCESS_RATE=0.90 ./scripts/run_golden_tasks.sh",
];

export function commandsForPostCheckProfile(profile: PostCheckProfile): string[] {
  switch (profile) {
    case "none":
      return [];
    case "fast":
      return FAST_CHECKS;
    case "governance":
      return GOVERNANCE_CHECKS;
    case "full":
      return FULL_CHECKS;
    default:
      return [];
  }
}

export async function runPostChecks(args: {
  profile: PostCheckProfile;
  cwd: string;
  dryRun: boolean;
}): Promise<PostCheckResult[]> {
  const commands = commandsForPostCheckProfile(args.profile);
  const results: PostCheckResult[] = [];

  if (commands.length === 0) {
    console.log(chalk.dim("No post-check profile selected."));
    return results;
  }

  for (const command of commands) {
    if (args.dryRun) {
      console.log(chalk.dim(`[dry-run post-check] ${command}`));
      results.push({ command, exitCode: 0, output: "[dry-run] skipped" });
      continue;
    }

    console.log(chalk.cyan(`Running post-check: ${command}`));
    const result = await runCommand({
      command: "bash",
      args: ["-lc", command],
      cwd: args.cwd,
    });

    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    results.push({ command, exitCode: result.exitCode, output });

    if (result.exitCode !== 0) {
      throw new Error(`Post-check failed: ${command}\n${output}`);
    }
  }

  return results;
}
