import type { Plan } from "../planner/plan-schema.js";
import type { ProviderId } from "../providers/types.js";
import { fileExists, resolveAbsolutePath } from "./io.js";

const REQUIRED_CONTEXT_FILES = [
  "AGENTS.md",
  "llms.txt",
  ".ai-context.md",
  "docs/agents/policy.contract.yaml",
  "docs/agents/commands.md",
  "docs/agents/repo-index.json",
] as const;

const PROVIDER_ADAPTER_FILE: Record<ProviderId, string> = {
  openai: "CODEX.md",
  anthropic: "CLAUDE.md",
  google: "GEMINI.md",
  "google-api": "GEMINI.md",
};

function unique(items: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const item of items) {
    if (!seen.has(item)) {
      seen.add(item);
      deduped.push(item);
    }
  }
  return deduped;
}

export function resolveContextFilesForPlan(input: { providerId: ProviderId; plan: Plan }): string[] {
  const files: string[] = [
    REQUIRED_CONTEXT_FILES[0],
    PROVIDER_ADAPTER_FILE[input.providerId],
    ...REQUIRED_CONTEXT_FILES.slice(1),
  ];

  const stepFiles = input.plan.steps.flatMap((step) => step.files);
  if (stepFiles.some((file) => file.startsWith("frontend/"))) {
    files.push("frontend/AGENTS.md");
  }
  if (stepFiles.some((file) => file.startsWith("backend/"))) {
    files.push("backend/AGENTS.md");
  }

  return unique(files);
}

export async function findMissingContextFiles(input: { cwd: string; contextFiles: string[] }): Promise<string[]> {
  const missing: string[] = [];
  for (const file of input.contextFiles) {
    const absolutePath = resolveAbsolutePath(file, input.cwd);
    if (!(await fileExists(absolutePath))) {
      missing.push(file);
    }
  }
  return missing;
}

export async function assertContextPipeline(input: {
  cwd: string;
  contextFiles: string[];
  skipCheck: boolean;
  logWarning?: (message: string) => void;
}): Promise<void> {
  const missing = await findMissingContextFiles({
    cwd: input.cwd,
    contextFiles: input.contextFiles,
  });

  if (missing.length === 0) {
    return;
  }

  const joined = missing.join(", ");
  const message = `[ralph context] Missing required context files: ${joined}`;

  if (input.skipCheck) {
    input.logWarning?.(`${message} (continuing because --skip-context-pipeline-check is set).`);
    return;
  }

  throw new Error(`${message}. Re-run with --skip-context-pipeline-check to bypass.`);
}
