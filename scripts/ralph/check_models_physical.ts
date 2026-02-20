import { GoogleGenAI } from "@google/genai";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";

async function main() {
    console.log("--- Physical Test File START ---");
    const kf = path.join(os.homedir(), ".direct-ralph", "api-keys.json");
    const keys = await fs.readJson(kf);
    console.log("Keys found:", Object.keys(keys));
    const apiKey = keys["google-api"];
    console.log("API Key length:", apiKey ? apiKey.length : "undefined");

    if (!apiKey) {
        console.error("API key not found!");
        process.exit(1);
    }

    const ai = new GoogleGenAI({ apiKey });

    const tests = [
        { id: "gemini-3.1-pro-preview", level: "HIGH" },
        { id: "gemini-3.1-pro-preview", level: "LOW" },
        { id: "gemini-3.1-pro-preview", level: "4000" },
        { id: "gemini-3-flash-preview", level: "LOW" },
    ];

    for (const t of tests) {
        process.stdout.write(`Testing ${t.id}${t.level ? ` (${t.level})` : ""}... `);
        try {
            let thinkingConfig: any = undefined;
            if (t.level) {
                const parsed = parseInt(t.level, 10);
                if (!isNaN(parsed)) {
                    thinkingConfig = { thinkingBudget: parsed };
                } else {
                    thinkingConfig = { thinkingLevel: t.level as any };
                }
            }

            const chat = ai.chats.create({
                model: t.id,
                config: {
                    thinkingConfig
                }
            });
            const result = await chat.sendMessage({ message: "Hello. Answer with OK." });
            console.log("SUCCESS: " + (result.text?.trim() ?? "No text"));
        } catch (e: any) {
            console.log("FAILED: " + e.message.slice(0, 100));
        }
    }
}

main().catch(console.error);
