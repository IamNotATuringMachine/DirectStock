import os from "node:os";
import path from "node:path";

import { execa } from "execa";
import fs from "fs-extra";
import { describe, expect, it } from "vitest";

interface ProviderCase {
  provider: "openai" | "anthropic" | "google";
  model: string;
  thinking: string;
}

const PROVIDER_CASES: ProviderCase[] = [
  { provider: "openai", model: "gpt-5.3-codex", thinking: "high" },
  { provider: "anthropic", model: "claude-sonnet-4-6-20250217", thinking: "10" },
  { provider: "google", model: "gemini-2.5-flash", thinking: "high" },
];

function samplePlan(provider: string, model: string): Record<string, unknown> {
  return {
    schemaVersion: "1.1.0",
    goal: `E2E output validation for ${provider}`,
    createdAt: new Date().toISOString(),
    steps: [
      {
        id: "step-01",
        title: "Verify normalized output",
        description: "Run one provider call and validate timeline output",
        successCriteria: "true",
        status: "pending",
        attempts: 0,
        maxAttempts: 1,
        type: "test",
        files: [],
        riskLevel: "low",
        owner: "agent",
        postChecks: [],
        rollbackHint: "none",
      },
    ],
    metadata: {
      provider,
      model,
      totalIterations: 1,
      completedIterations: 0,
    },
  };
}

async function writeExecutable(filePath: string, content: string): Promise<void> {
  await fs.writeFile(filePath, content, "utf8");
  await fs.chmod(filePath, 0o755);
}

async function createFakeProviderBinaries(binDir: string): Promise<void> {
  await fs.ensureDir(binDir);

  await writeExecutable(
    path.join(binDir, "codex"),
    `#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == "exec" && "\${2:-}" == "--help" ]]; then
  printf '%s\\n' '--json' '--dangerously-bypass-approvals-and-sandbox' '--output-schema'
  exit 0
fi
if [[ "\${1:-}" == "exec" && "\${2:-}" == "resume" && "\${3:-}" == "--help" ]]; then
  echo "resume"
  exit 0
fi
if [[ "\${1:-}" == "exec" ]]; then
  echo '{"type":"thread.started","thread_id":"thread-openai"}'
  echo '{"type":"item.completed","item":{"type":"reasoning","summary":"inspect files"}}'
  echo '{"type":"item.completed","item":{"type":"tool_call","name":"Read"}}'
  echo '{"type":"item.completed","item":{"type":"tool_result","name":"Read","status":"ok"}}'
  echo '{"type":"item.completed","item":{"type":"agent_message","text":"openai final"}}'
  echo '{"type":"turn.completed"}'
  exit 0
fi
echo "unexpected codex args: $*" >&2
exit 2
`,
  );

  await writeExecutable(
    path.join(binDir, "claude"),
    `#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == "--help" ]]; then
  printf '%s\\n' '--output-format' '--max-turns' '--resume' '--json-schema' 'stream-json'
  exit 0
fi
echo '{"type":"message_start","session_id":"sess-claude"}'
echo '{"type":"content_block_delta","delta":{"thinking":"reasoning"}}'
echo '{"type":"content_block_delta","delta":{"text":"anthropic final"}}'
echo '{"type":"result","result":"anthropic final","session_id":"sess-claude"}'
`,
  );

  await writeExecutable(
    path.join(binDir, "gemini"),
    `#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == "--help" ]]; then
  printf '%s\\n' '--output-format' '--approval-mode' '--resume' 'stream-json'
  exit 0
fi
echo "YOLO mode is enabled. All tool calls will be automatically approved."
echo '{"session_id":"sess-google","thinking":"thinking summary","response":"google final"}'
`,
  );
}

describe("ralph e2e output matrix (hermetic)", () => {
  it.each(PROVIDER_CASES)("normalizes timeline output for %s", async (providerCase) => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `ralph-e2e-${providerCase.provider}-`));
    const binDir = path.join(tempDir, "bin");
    const runLogPath = path.join(tempDir, `${providerCase.provider}.run.jsonl`);
    const planPath = path.join(tempDir, `${providerCase.provider}.plan.json`);

    await createFakeProviderBinaries(binDir);
    await fs.writeJson(planPath, samplePlan(providerCase.provider, providerCase.model), { spaces: 2 });

    const result = await execa(
      path.join(process.cwd(), "node_modules", ".bin", "tsx"),
      [
        "src/cli.ts",
        "ralph",
        "--no-preset",
        "--provider",
        providerCase.provider,
        "--model",
        providerCase.model,
        "--thinking",
        providerCase.thinking,
        "--plan",
        planPath,
        "--max-iterations",
        "1",
        "--post-check-profile",
        "none",
        "--no-auto-commit",
        "--output-mode",
        "timeline",
        "--live-provider-events",
        "on",
        "--thinking-visibility",
        "summary",
        "--run-log-path",
        runLogPath,
        "--skip-context-pipeline-check",
        "--strict-provider-capabilities",
        "--yes",
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          HOME: tempDir,
          PATH: `${binDir}:${process.env.PATH ?? ""}`,
        },
        reject: false,
      },
    );

    const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
    if (result.exitCode !== 0) {
      throw new Error(`ralph exited with ${result.exitCode}\n${output}`);
    }
    // New Claude Code-style UI uses icons instead of [status] prefixed lines
    expect(output).toContain("✓");
    expect(output).toContain("PASS");
    expect(output).toContain("💭");

    if (providerCase.provider === "google") {
      // Google YOLO noise line rendered as status event
      expect(output).toContain("○");
    }

    const events = (await fs.readFile(runLogPath, "utf8"))
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { event: string; providerEventType?: string; preview?: string });

    expect(events.some((event) => event.event === "provider_event")).toBe(true);
    expect(events.some((event) => event.providerEventType === "assistant_text")).toBe(true);
    expect(events.some((event) => event.event === "step_done")).toBe(true);
  }, 20_000);
});
