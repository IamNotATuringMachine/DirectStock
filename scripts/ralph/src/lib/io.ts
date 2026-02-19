import path from "node:path";
import fs from "fs-extra";

export async function readJsonFile<T>(filePath: string): Promise<T> {
  return fs.readJson(filePath, { throws: true }) as Promise<T>;
}

export async function writeJsonFile(filePath: string, payload: unknown): Promise<void> {
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeJson(filePath, payload, { spaces: 2 });
}

export function resolveAbsolutePath(inputPath: string, cwd: string): string {
  return path.isAbsolute(inputPath) ? inputPath : path.resolve(cwd, inputPath);
}

export function extractJsonFromText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    return trimmed;
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return null;
}

export async function fileExists(filePath: string): Promise<boolean> {
  return fs.pathExists(filePath);
}
