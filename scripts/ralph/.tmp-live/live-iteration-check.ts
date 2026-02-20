import fs from "node:fs/promises";

import { buildIterationPrompt } from "../src/loop/executor.ts";
import type { Plan } from "../src/planner/plan-schema.ts";
import { captureGitState } from "../src/lib/git.ts";
import { googleAdapter } from "../src/providers/google.ts";

async function main(): Promise<void> {
  const planPath = ".tmp-live/plan-flash3-e2e.json";
  const planRaw = await fs.readFile(planPath, "utf8");
  const plan = JSON.parse(planRaw) as Plan;
  const step = plan.steps[0];
  const gitState = await captureGitState(process.cwd());
  const prompt = buildIterationPrompt(plan, step, gitState);

  console.log(`prompt_chars=${prompt.length}`);

  const events: Array<{ type: string; preview: string }> = [];
  const result = await googleAdapter.execute({
    model: "gemini-3-flash-preview",
    thinkingValue: "high",
    prompt,
    cwd: process.cwd(),
    timeoutMs: 120_000,
    attempt: 1,
    sessionStrategy: "reset",
    streamingEnabled: true,
    onEvent: (event) => {
      const preview = JSON.stringify(event.payload).slice(0, 200);
      events.push({ type: event.type, preview });
      if (event.type === "thinking") {
        console.log(`[thinking] ${String(event.payload.summary ?? "").replace(/\s+/g, " ").slice(0, 140)}`);
      }
      if (event.type === "tool_call") {
        console.log(`[tool_call] ${preview}`);
      }
      if (event.type === "assistant_text") {
        console.log(`[assistant_text] ${String(event.payload.text ?? "").slice(0, 140)}`);
      }
    },
  });

  const counts = events.reduce<Record<string, number>>((acc, event) => {
    acc[event.type] = (acc[event.type] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`ok=${result.ok} exit=${String(result.exitCode)} timedOut=${result.timedOut}`);
  console.log(`event_counts=${JSON.stringify(counts)}`);
  console.log(`final=${(result.finalText || "").slice(0, 300)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
