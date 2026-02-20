import { GoogleGenAI } from "@google/genai";
import fs from "fs-extra";
import path from "node:path";

import { MODEL_CATALOG, THINKING_CATALOG } from "../config/models.js";
import { runCommand } from "../lib/process.js";
import {
    createProviderEvent,
    type ProviderOutputEvent,
    summarizeThinking,
    truncateText,
} from "./output-events.js";
import type { ProviderAdapter, ProviderCommand, ProviderExecutionInput, ProviderExecutionResult } from "./types.js";

const MAX_TURNS = 25;

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

        let chatSystemInstruction = `You are a helpful senior software engineer.
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

        // Map legacy thinking budgets to level if using Gemini 3
        let thinkingConfig: any = undefined;
        if (input.thinkingValue) {
            const isGemini3 = input.model.includes("gemini-3");
            if (isGemini3) {
                thinkingConfig = { thinkingLevel: input.thinkingValue === "low" ? "low" : "high" };
            } else {
                const parsed = parseInt(input.thinkingValue, 10);
                if (!isNaN(parsed)) {
                    thinkingConfig = { thinkingBudget: parsed };
                }
            }
        }

        const chat = ai.chats.create({
            model: input.model,
            config: {
                systemInstruction: chatSystemInstruction,
                thinkingConfig,
            }
        });

        let currentPrompt = input.prompt;
        let turnCount = 0;
        let finalText = "";

        pushEvent(
            createProviderEvent({
                type: "status",
                provider: "google",
                attempt: input.attempt ?? 1,
                payload: { status: "started native loop" },
            })
        );

        while (turnCount < MAX_TURNS) {
            turnCount++;
            let response;
            try {
                response = await chat.sendMessage({ message: currentPrompt });
            } catch (error) {
                pushEvent(
                    createProviderEvent({
                        type: "error",
                        provider: "google",
                        attempt: input.attempt ?? 1,
                        payload: { error: `API Error: ${error instanceof Error ? error.message : String(error)}` },
                    })
                );
                finalText = `API Error: ${error instanceof Error ? error.message : String(error)}`;
                break;
            }

            const assistantMessage = response.text || "";

            pushEvent(
                createProviderEvent({
                    type: "assistant_text",
                    provider: "google",
                    attempt: input.attempt ?? 1,
                    payload: { text: assistantMessage },
                })
            );

            const jsonMatch = assistantMessage.match(/\`\`\`json\s*(\{[\s\S]*?\})\s*\`\`\`/);

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

                currentPrompt = `Tool Result for ${toolName}:\n${stringifiedResult}`;
            } else {
                // No tool call, model is done.
                finalText = assistantMessage;
                break;
            }
        }

        if (turnCount >= MAX_TURNS) {
            finalText += "\n[Terminated: Reached maximum tool call turns]";
        }

        pushEvent(
            createProviderEvent({
                type: "status",
                provider: "google",
                attempt: input.attempt ?? 1,
                payload: { status: "loop completed" },
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
