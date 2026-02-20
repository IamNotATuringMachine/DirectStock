import path from "node:path";
import { fileURLToPath } from "node:url";

import fs from "fs-extra";

import { fileExists } from "./io.js";

const PLAN_TEMPLATE_RELATIVE_PATH = path.join("docs", "guides", "ralph-plan-template.md");

export async function resolvePlanTemplatePath(cwd: string): Promise<string> {
  const candidates = new Set<string>();

  let cursor = path.resolve(cwd);
  while (true) {
    candidates.add(path.join(cursor, PLAN_TEMPLATE_RELATIVE_PATH));
    const parent = path.dirname(cursor);
    if (parent === cursor) {
      break;
    }
    cursor = parent;
  }

  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  cursor = moduleDir;
  while (true) {
    candidates.add(path.join(cursor, PLAN_TEMPLATE_RELATIVE_PATH));
    const parent = path.dirname(cursor);
    if (parent === cursor) {
      break;
    }
    cursor = parent;
  }

  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Template file not found. Expected path: ${PLAN_TEMPLATE_RELATIVE_PATH}`);
}

export function isGoalFilePath(filePath: string): boolean {
  return /\.(md|markdown|txt)$/i.test(filePath);
}

export function toJsonPlanPath(filePath: string): string {
  if (/\.[^./\\]+$/.test(filePath)) {
    return filePath.replace(/\.[^./\\]+$/, ".json");
  }
  return `${filePath}.json`;
}

export async function readGoalFromFile(goalFilePath: string): Promise<string> {
  if (!(await fileExists(goalFilePath))) {
    throw new Error(`Goal file not found: ${goalFilePath}`);
  }

  const goal = (await fs.readFile(goalFilePath, "utf8")).trim();
  if (!goal) {
    throw new Error(`Goal file is empty: ${goalFilePath}`);
  }

  return goal;
}
