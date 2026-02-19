import os from "node:os";
import path from "node:path";

import { fileExists, readJsonFile, writeJsonFile } from "../lib/io.js";
import type { ProviderId } from "../providers/types.js";

const PRESET_DIR = path.join(os.homedir(), ".direct-ralph");
const PRESET_FILE = path.join(PRESET_DIR, "last-preset.json");

export interface RalphPreset {
  provider: ProviderId;
  model: string;
  thinkingValue: string;
  planPath: string;
  maxIterations: number;
  savedAt: string;
}

export async function loadPreset(): Promise<RalphPreset | null> {
  if (!(await fileExists(PRESET_FILE))) {
    return null;
  }

  try {
    return await readJsonFile<RalphPreset>(PRESET_FILE);
  } catch {
    return null;
  }
}

export async function savePreset(preset: RalphPreset): Promise<void> {
  await writeJsonFile(PRESET_FILE, preset);
}

export function presetFilePath(): string {
  return PRESET_FILE;
}
