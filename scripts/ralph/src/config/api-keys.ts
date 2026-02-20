import os from "node:os";
import path from "node:path";

import { fileExists, readJsonFile, writeJsonFile } from "../lib/io.js";

const API_KEYS_DIR = path.join(os.homedir(), ".direct-ralph");
const API_KEYS_FILE = path.join(API_KEYS_DIR, "api-keys.json");

export type RalphApiKeys = Record<string, string>;

export async function loadApiKeys(): Promise<RalphApiKeys> {
    if (!(await fileExists(API_KEYS_FILE))) {
        return {};
    }

    try {
        return await readJsonFile<RalphApiKeys>(API_KEYS_FILE);
    } catch {
        return {};
    }
}

export async function saveApiKeys(keys: RalphApiKeys): Promise<void> {
    await writeJsonFile(API_KEYS_FILE, keys);
}
