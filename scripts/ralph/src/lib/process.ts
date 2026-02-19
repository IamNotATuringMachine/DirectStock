import { execa } from "execa";

export interface CommandInvocation {
  command: string;
  args?: string[];
  cwd?: string;
  timeoutMs?: number;
  env?: Record<string, string>;
  onStdout?: (chunk: string) => void;
}

export interface CommandResult {
  exitCode: number | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
}

export async function runCommand({
  command,
  args = [],
  cwd,
  timeoutMs,
  env,
  onStdout,
}: CommandInvocation): Promise<CommandResult> {
  try {
    const child = execa(command, args, {
      cwd,
      env,
      reject: false,
      timeout: timeoutMs,
      all: false,
      stripFinalNewline: false,
    });

    if (onStdout && child.stdout) {
      child.stdout.on("data", (data: string | Buffer) => {
        onStdout(data.toString());
      });
    }

    const result = await child;

    return {
      exitCode: result.exitCode ?? null,
      timedOut: false,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  } catch (error) {
    const e = error as {
      timedOut?: boolean;
      exitCode?: number | null;
      stdout?: string;
      stderr?: string;
      message?: string;
    };

    return {
      exitCode: e.exitCode ?? null,
      timedOut: Boolean(e.timedOut),
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? e.message ?? "",
    };
  }
}

export async function commandExists(command: string): Promise<boolean> {
  const result = await runCommand({ command: "which", args: [command] });
  return result.exitCode === 0;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
