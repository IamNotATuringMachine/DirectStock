import { googleAdapter } from "../src/providers/google.ts";

async function main(): Promise<void> {
  const streamed: string[] = [];
  const result = await googleAdapter.execute({
    model: "gemini-3-flash-preview",
    thinkingValue: "high",
    prompt: "Say hi",
    cwd: process.cwd(),
    timeoutMs: 120_000,
    attempt: 1,
    sessionStrategy: "reset",
    streamingEnabled: true,
    onEvent: (event) => {
      streamed.push(event.type);
    },
  });

  const streamCounts = streamed.reduce<Record<string, number>>((acc, type) => {
    acc[type] = (acc[type] ?? 0) + 1;
    return acc;
  }, {});
  const resultCounts = result.events.reduce<Record<string, number>>((acc, event) => {
    acc[event.type] = (acc[event.type] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`ok=${result.ok} exit=${String(result.exitCode)} timedOut=${result.timedOut}`);
  console.log(`stream_counts=${JSON.stringify(streamCounts)}`);
  console.log(`result_counts=${JSON.stringify(resultCounts)}`);
  console.log(`result_thinking=${result.events.filter((event) => event.type === "thinking").length}`);
  console.log(`final=${(result.finalText || "").slice(0, 160)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
