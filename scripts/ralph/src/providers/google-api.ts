import { GoogleGenAI } from "@google/genai";
import fs from "fs-extra";
import path from "node:path";

import { MODEL_CATALOG, THINKING_CATALOG } from "../config/models.js";
import { runCommand } from "../lib/process.js";
import {
    createProviderEvent,
    type ProviderOutputEvent,
    truncateText,
} from "./output-events.js";
import type { ProviderAdapter, ProviderCommand, ProviderExecutionInput, ProviderExecutionResult } from "./types.js";

const DEFAULT_MAX_TURNS = 120;
/** Timeout for the sendMessageStream() Promise itself (connection + first byte) */
const STREAM_CONNECT_TIMEOUT_MS = 120_000;
/** Abort the stream if no chunk arrives within this window (subsequent chunks) */
const STREAM_CHUNK_TIMEOUT_MS = 90_000;

function parsePositiveInt(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return undefined;
    return parsed;
}

function resolveMaxTurns(input: ProviderExecutionInput): number {
    if (input.providerMaxTurns && Number.isInteger(input.providerMaxTurns) && input.providerMaxTurns > 0) {
        return input.providerMaxTurns;
    }
    const envOverride =
        parsePositiveInt(input.env?.RALPH_GOOGLE_API_MAX_TURNS) ??
        parsePositiveInt(input.env?.RALPH_PROVIDER_MAX_TURNS) ??
        parsePositiveInt(process.env.RALPH_GOOGLE_API_MAX_TURNS) ??
        parsePositiveInt(process.env.RALPH_PROVIDER_MAX_TURNS);
    return envOverride ?? DEFAULT_MAX_TURNS;
}

function remainingTurnsHint(turnCount: number, maxTurns: number, writeCount: number): string {
    const remaining = maxTurns - turnCount;
    if (remaining > 8) {
        return "";
    }
    const writeState = writeCount === 0 ? "No files have been written yet." : `File writes so far: ${writeCount}.`;
    return `\n\nTurn budget is nearly exhausted (${remaining} turns remaining). ${writeState} If the task is done, stop calling tools and return the final response now.`;
}

function buildCommand(input: ProviderExecutionInput): ProviderCommand {
    return {
        command: "node",
        args: ["--internal-google-api"],
        env: input.env,
    };
}

async function executeBash(command: string, cwd: string): Promise<string> {
    const result = await runCommand({ command: "bash", args: ["-lc", command], cwd });
    return [result.stdout, result.stderr].filter(Boolean).join("\n").trim() || "Command executed successfully with no output.";
}

async function executeReadFile(filePath: string, cwd: string): Promise<string> {
    try {
        const absolutePath = path.resolve(cwd, filePath);
        return await fs.readFile(absolutePath, "utf8");
    } catch (error) {
        return `Error reading file: ${error instanceof Error ? error.message : String(error)}`;
    }
}

async function executeWriteFile(filePath: string, content: string, cwd: string): Promise<string> {
    try {
        const absolutePath = path.resolve(cwd, filePath);
        await fs.ensureDir(path.dirname(absolutePath));
        await fs.writeFile(absolutePath, content, "utf8");
        return `Successfully wrote to ${filePath}`;
    } catch (error) {
        return `Error writing file: ${error instanceof Error ? error.message : String(error)}`;
    }
}

/**
 * Returns true when the model response looks like a raw API error JSON body
 * (e.g. {"error":{"code":503,...}}) delivered as a text chunk instead of a
 * thrown exception. We need to re-throw these so they're treated as ok:false.
 */
function looksLikeApiError(text: string): boolean {
    const t = text.trim();
    if (!t.startsWith("{") || !t.endsWith("}")) return false;
    return (
        t.includes('"error"') &&
        (t.includes('"code"') || t.includes('"status"') || t.includes('"message"'))
    );
}

/**
 * Streams one turn from the chat session and returns the assembled text.
 * Emits `thinking` events for thought-parts as they arrive.
 * Throws on network errors or if no chunk arrives within STREAM_CHUNK_TIMEOUT_MS.
 */
async function streamOneTurn(
    stream: AsyncGenerator<any>,
    attempt: number,
    pushEvent: (e: ProviderOutputEvent) => void,
): Promise<string> {
    let assistantText = "";
    let chunkTimer: ReturnType<typeof setTimeout> | null = null;
    let aborted = false;

    const resetTimer = () => {
        if (chunkTimer) clearTimeout(chunkTimer);
        chunkTimer = setTimeout(() => {
            aborted = true;
        }, STREAM_CHUNK_TIMEOUT_MS);
    };

    resetTimer();

    try {
        for await (const chunk of stream) {
            if (aborted) {
                throw new Error(`Stream stalled: no chunk received for ${STREAM_CHUNK_TIMEOUT_MS / 1000}s`);
            }
            resetTimer();

            if (!chunk.candidates?.length) continue;
            const candidate = chunk.candidates[0];
            if (!candidate.content?.parts) continue;

            for (const part of candidate.content.parts) {
                const partText: string = (part as any).text ?? "";
                if (!partText) continue;

                if ((part as any).thought === true) {
                    // Live thinking chunk — push event so heartbeat can display it
                    pushEvent(
                        createProviderEvent({
                            type: "thinking",
                            provider: "google",
                            attempt,
                            payload: {
                                summary: truncateText(partText, 200),
                                text: partText,
                            },
                        })
                    );
                } else {
                    assistantText += partText;
                }
            }
        }
    } finally {
        if (chunkTimer) clearTimeout(chunkTimer);
    }

    if (aborted) {
        throw new Error(`Stream stalled: no chunk received for ${STREAM_CHUNK_TIMEOUT_MS / 1000}s`);
    }

    return assistantText;
}

export const googleApiAdapter: ProviderAdapter = {
    id: "google-api",
    name: "Google (Native API)",
    cliCommand: "node",
    models: MODEL_CATALOG.google,
    thinkingOptions: THINKING_CATALOG.google,
    defaultModel: MODEL_CATALOG.google[0].value,
    defaultThinking: THINKING_CATALOG.google[0].value,
    supportsResume: false,
    supportsStreamJson: true,
    isInstalled: async () => true,
    buildCommand,
    async execute(input: ProviderExecutionInput): Promise<ProviderExecutionResult> {
        const command = buildCommand(input);
        const maxTurns = resolveMaxTurns(input);

        if (input.dryRun) {
            return {
                ok: true,
                exitCode: 0,
                timedOut: false,
                stdout: "",
                stderr: "",
                responseText: "[dry-run] google-api execution skipped",
                finalText: "[dry-run] google-api execution skipped",
                events: [],
                usedModel: input.model,
                command,
                attempt: input.attempt,
            };
        }

        const apiKey = input.env?.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("GEMINI_API_KEY is not set in environment or config.");
        }

        const ai = new GoogleGenAI({ apiKey });
        const events: ProviderOutputEvent[] = [];
        const pushEvent = (event: ProviderOutputEvent) => {
            events.push(event);
            input.onEvent?.(event);
        };

        const chatSystemInstruction = `You are a helpful senior software engineer.
You have access to the following tools:
1. bash (runs a bash command in the project directory)
2. read_file (reads a file's contents)
3. write_file (writes contents to a file)

To use a tool, output a JSON block wrapped in \`\`\`json ... \`\`\` and NOTHING ELSE.
Example:
\`\`\`json
{
  "tool": "bash",
  "args": { "command": "npm test" }
}
\`\`\`
Example:
\`\`\`json
{
  "tool": "read_file",
  "args": { "path": "src/index.ts" }
}
\`\`\`
Example:
\`\`\`json
{
  "tool": "write_file",
  "args": { "path": "src/index.ts", "content": "console.log('hello');" }
}
\`\`\`

If you choose to use a tool, ONLY output the JSON block. Do not provide surrounding text. When you receive the tool result in the next turn, you can analyze it, use another tool, or give your final answer.
Once you are completely done with the task, output your final response WITHOUT any tool JSON block.
`;

        // Map thinking value to thinkingConfig
        let thinkingConfig: any = undefined;
        if (input.thinkingValue) {
            const parsed = parseInt(input.thinkingValue, 10);
            if (!isNaN(parsed)) {
                // Numeric value always becomes thinkingBudget (tokens)
                thinkingConfig = { thinkingBudget: parsed, includeThoughts: true };
            } else {
                const isGemini3 = input.model.includes("gemini-3");
                if (isGemini3) {
                    // "high" or "low" becomes the corresponding enum level
                    thinkingConfig = { thinkingLevel: input.thinkingValue === "low" ? "LOW" : "HIGH", includeThoughts: true };
                } else {
                    thinkingConfig = { includeThoughts: true };
                }
            }
        }

        // Use chat session — SDK manages history and role sequencing correctly
        const chat = ai.chats.create({
            model: input.model,
            config: {
                systemInstruction: chatSystemInstruction,
                thinkingConfig,
            },
        });

        let currentPrompt = input.prompt;
        let turnCount = 0;
        let finalText = "";
        let writeCount = 0;

        pushEvent(
            createProviderEvent({
                type: "status",
                provider: "google",
                attempt: input.attempt ?? 1,
                payload: { status: "started native loop" },
            })
        );

        while (turnCount < maxTurns) {
            turnCount++;
            let assistantMessage = "";

            try {
                // Race the sendMessageStream promise against a connect timeout.
                // When the model is 503-ing under load, sendMessageStream itself
                // hangs indefinitely — it never rejects and never resolves.
                const streamPromise = chat.sendMessageStream({ message: currentPrompt });
                const timeoutPromise = new Promise<never>((_, reject) =>
                    setTimeout(
                        () => reject(new Error(`Stream connect timeout after ${STREAM_CONNECT_TIMEOUT_MS / 1000}s (503 or network stall)`)),
                        STREAM_CONNECT_TIMEOUT_MS,
                    )
                );
                const stream = await Promise.race([streamPromise, timeoutPromise]);
                assistantMessage = await streamOneTurn(stream, input.attempt ?? 1, pushEvent);

                // The Google API sometimes delivers error responses (e.g. 503) as
                // stream text chunks instead of throwing. Detect and re-throw.
                if (looksLikeApiError(assistantMessage)) {
                    throw new Error(assistantMessage.trim());
                }
            } catch (error) {
                const errorMsg = `API Error: ${error instanceof Error ? error.message : String(error)}`;
                pushEvent(
                    createProviderEvent({
                        type: "error",
                        provider: "google",
                        attempt: input.attempt ?? 1,
                        payload: { error: errorMsg },
                    })
                );
                return {
                    ok: false,
                    exitCode: 1,
                    timedOut: false,
                    stdout: "",
                    stderr: errorMsg,
                    responseText: errorMsg,
                    finalText: errorMsg,
                    events,
                    usedModel: input.model,
                    command,
                    rawOutput: { stdout: "", stderr: errorMsg },
                    attempt: input.attempt ?? 1,
                };
            }

            pushEvent(
                createProviderEvent({
                    type: "assistant_text",
                    provider: "google",
                    attempt: input.attempt ?? 1,
                    payload: { text: assistantMessage },
                })
            );

            const jsonMatch = assistantMessage.match(/```json\s*(\{[\s\S]*?\})\s*```/);

            if (jsonMatch) {
                let toolCall: { tool?: string; args?: Record<string, string> };
                try {
                    toolCall = JSON.parse(jsonMatch[1]);
                } catch {
                    currentPrompt = "Error: Invalid JSON block. Please provide valid JSON to use a tool.";
                    continue;
                }

                const toolName = toolCall.tool;
                const toolArgs = toolCall.args || {};

                pushEvent(
                    createProviderEvent({
                        type: "tool_call",
                        provider: "google",
                        attempt: input.attempt ?? 1,
                        payload: { name: toolName || "unknown", command: toolArgs.command || toolArgs.path || "" },
                    })
                );

                let resultText = "";
                try {
                    if (toolName === "bash" && toolArgs.command) {
                        resultText = await executeBash(toolArgs.command, input.cwd);
                    } else if (toolName === "read_file" && toolArgs.path) {
                        resultText = await executeReadFile(toolArgs.path, input.cwd);
                    } else if (toolName === "write_file" && toolArgs.path && toolArgs.content !== undefined) {
                        resultText = await executeWriteFile(toolArgs.path, toolArgs.content, input.cwd);
                        writeCount++;
                    } else {
                        resultText = `Error: Unknown tool '${toolName}' or missing required arguments.`;
                    }
                } catch (error) {
                    resultText = `Execution error: ${error instanceof Error ? error.message : String(error)}`;
                }

                const stringifiedResult = truncateText(resultText, 10000);

                pushEvent(
                    createProviderEvent({
                        type: "tool_result",
                        provider: "google",
                        attempt: input.attempt ?? 1,
                        payload: { name: toolName || "unknown", status: "success" },
                    })
                );

                currentPrompt = `Tool Result for ${toolName}:\n${stringifiedResult}${remainingTurnsHint(turnCount, maxTurns, writeCount)}`;
            } else if (assistantMessage.trim() === "") {
                // The model generated ONLY thoughts (or just stopped) without outputting any text.
                // Prod it to continue instead of breaking the loop.
                currentPrompt = `You did not provide any text or tool call. Please continue and provide a tool call using the JSON format, or your final response if you are completely done.${remainingTurnsHint(turnCount, maxTurns, writeCount)}`;
                continue;
            } else {
                // No tool call — model is done
                finalText = assistantMessage;
                break;
            }
        }

        if (turnCount >= maxTurns) {
            finalText += `\n[Terminated: Reached maximum tool call turns (${maxTurns}). Increase with --provider-max-turns <n> or RALPH_PROVIDER_MAX_TURNS.]`;
        }

        pushEvent(
            createProviderEvent({
                type: "status",
                provider: "google",
                attempt: input.attempt ?? 1,
                payload: {
                    status: writeCount === 0
                        ? `loop_completed_no_writes (${turnCount} turns, 0 file writes — executor will retry without burning an attempt)`
                        : `loop completed (${turnCount} turns, ${writeCount} file write${writeCount === 1 ? "" : "s"})`,
                },
            })
        );

        return {
            ok: true,
            exitCode: 0,
            timedOut: false,
            stdout: "",
            stderr: "",
            responseText: finalText,
            finalText: finalText,
            events,
            usedModel: input.model,
            command,
            rawOutput: { stdout: "", stderr: "" },
            attempt: input.attempt ?? 1,
        };
    },
};
