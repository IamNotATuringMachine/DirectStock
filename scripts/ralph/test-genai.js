import { GoogleGenAI } from "@google/genai";

async function main() {
    const apiKey = "AIzaSyCi81BLatXD1glWaG8VkxoWiyuRrseFeDs";
    const ai = new GoogleGenAI({ apiKey });

    console.log("Testing with genai includeThoughts...");
    try {
        const chat = ai.chats.create({
            model: "gemini-3.1-pro-preview",
            config: {
                systemInstruction: "You are a test. Write a short poem. Think step-by-step first.",
                thinkingConfig: { thinkingLevel: "HIGH", includeThoughts: true }
            }
        });

        const stream = await chat.sendMessageStream({ message: "Hello" });
        for await (const chunk of stream) {
            console.log("CHUNK:", JSON.stringify(chunk, null, 2));
            break; // Just need the first one to see structure
        }
        console.log("Done");
    } catch (err) {
        console.error("ERROR:", err);
    }
}

main().catch(console.error);
