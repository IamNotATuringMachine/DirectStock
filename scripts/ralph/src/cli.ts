#!/usr/bin/env node

import { Command } from "commander";
import { pathToFileURL } from "node:url";

import { runRalph } from "./ralph.js";

export function buildProgram(): Command {
  const program = new Command();

  program.name("direct").description("DirectStock automation CLI");

  program
    .command("ralph")
    .description("Run the Ralph Loop")
    .option("--no-preset", "Skip loading last preset")
    .option("--dry-run", "Show what would run without mutating plan/git")
    .option("--no-auto-commit", "Disable automatic git commits")
    .option("--allow-dirty", "Allow execution on a dirty working tree")
    .option("--max-iterations <number>", "Maximum iterations", (value) => Number(value))
    .option("--plan <path>", "Path to existing plan file")
    .option("--session-strategy <strategy>", "Session strategy: reset|resume", "reset")
    .option("--post-check-profile <profile>", "Post-check profile: none|fast|governance|full", "fast")
    .option("--log-format <format>", "Log format: text|jsonl", "text")
    .option("--run-log-path <path>", "Path for run log file (.jsonl)")
    .option("--strict-provider-capabilities", "Fail fast if required provider capabilities are missing")
    .option("--plan-template", "Print the Ralph plan template and exit")
    .action(async (options) => {
      await runRalph(options);
    });

  return program;
}

async function main(): Promise<void> {
  const program = buildProgram();
  await program.parseAsync(process.argv);
}

function isDirectExecution(): boolean {
  const scriptPath = process.argv[1];
  if (!scriptPath) {
    return false;
  }

  return import.meta.url === pathToFileURL(scriptPath).href;
}

if (isDirectExecution()) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[ralph] ${message}`);
    process.exitCode = 1;
  });
}
