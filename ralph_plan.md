# RALPH LOOP — SOTA 2026 Implementation Plan

> **direct ralph** — Interactive CLI for iterative, context-resetting AI agent loops
>
> Date: 2026-02-19 | Status: Implementation Plan

---

## 1. What Is The Ralph Loop?

The **Ralph Method** (aka "Ralph Wiggum Pattern") is an iterative coding loop where an AI agent:
1. Reads the current **plan file** + **git state** to understand what's done and what's next
2. Executes the next task step autonomously
3. Commits the results
4. **Hard-resets its context** (kills the process, starts fresh)
5. Repeats with a clean context window

The key insight: agents perform best in the first 30-60% of their context window. By resetting between iterations, you keep the agent in its "smart zone" every time.

---

## 2. Tech Stack & Architecture

### Language: **TypeScript (Node.js)**
- **Reason**: All 3 target CLIs (Claude Code, Codex CLI, Gemini CLI) are npm-installable. TypeScript gives type safety, native npm ecosystem, and easy global install via `npm link` or `npx`.
- Package manager: `pnpm` (fastest, workspace-native)

### Dependencies

| Package | Purpose | Version |
|---|---|---|
| `@inquirer/prompts` | Interactive CLI prompts (select, input, confirm) | latest |
| `chalk` | Colored terminal output | ^5 |
| `ora` | Spinners for async operations | latest |
| `cli-table3` | Formatted tables for confirmation screen | latest |
| `execa` | Subprocess execution (spawn agent CLIs) | latest |
| `fs-extra` | Enhanced file operations | latest |
| `commander` | CLI argument parsing (`direct ralph`) | latest |
| `zod` | Schema validation for plan files and config | latest |

### Project Structure

```
scripts/ralph/
├── package.json              # name: "direct-ralph", bin: { "direct": "./dist/cli.js" }
├── tsconfig.json
├── src/
│   ├── cli.ts                # Entry point — commander setup, routes to subcommands
│   ├── ralph.ts              # Main `ralph` subcommand — orchestrates the flow
│   ├── providers/
│   │   ├── types.ts          # Provider interface definition
│   │   ├── anthropic.ts      # Claude Code adapter
│   │   ├── openai.ts         # Codex CLI adapter
│   │   └── google.ts         # Gemini CLI adapter
│   ├── planner/
│   │   ├── planner.ts        # Plan creation (calls agent to decompose task)
│   │   └── plan-schema.ts    # Zod schema for plan.json
│   ├── loop/
│   │   ├── executor.ts       # The Ralph Loop engine
│   │   └── context-reset.ts  # Context reset + git state capture
│   ├── ui/
│   │   ├── prompts.ts        # All interactive prompts
│   │   ├── confirmation.ts   # Pre-start confirmation table
│   │   └── progress.ts       # Iteration progress display
│   └── config/
│       ├── preset.ts         # Preset load/save (~/.direct-ralph/last-preset.json)
│       └── models.ts         # Model catalogs per provider
└── dist/                     # Compiled output
```

### Installation & Invocation

```bash
# From project root
cd scripts/ralph && pnpm install && pnpm build && npm link

# Now globally available:
direct ralph
```

---

## 3. CLI Flow — Detailed Screen-by-Screen

### Screen 0: Preset Check
```
┌─────────────────────────────────────────┐
│  🔄 RALPH LOOP — SOTA 2026             │
│                                         │
│  Letztes Preset gefunden:               │
│  Provider: Anthropic (Claude Code)      │
│  Model: claude-sonnet-4-6-20250217      │
│  Thinking: 16384 tokens                 │
│  Plan: ./ralph-plan.json                │
│  Iterationen: 10                        │
│                                         │
│  Letztes Preset verwenden? (Y/n)        │
└─────────────────────────────────────────┘
```

**Logic**:
- Check `~/.direct-ralph/last-preset.json`
- If exists AND `--no-preset` flag not set → show confirm prompt
- "Y" → skip to Screen 6 (Confirmation)
- "n" → proceed to Screen 1

---

### Screen 1: Provider Selection
```
? Provider & Agenten-CLI auswählen:
  ❯ Anthropic (Claude Code CLI)
    OpenAI (Codex CLI)
    Google (Gemini CLI)
```

**Implementation**: `@inquirer/prompts` → `select()`

---

### Screen 2: Model Selection
Dynamic based on provider. Example for Anthropic:
```
? Modell auswählen:
  ❯ claude-sonnet-4-6-20250217  (SOTA — Sonnet 4.6, Feb 2026)
    claude-opus-4-6-20250205    (Opus 4.6, Feb 2026)
    claude-sonnet-4-5-20241022  (Sonnet 4.5)
    claude-haiku-4-5-20251015   (Haiku 4.5, schnell & günstig)
    ── Custom Model eingeben ──
```

For OpenAI:
```
  ❯ gpt-5.3-codex       (SOTA — GPT-5.3-Codex, Feb 2026)
    gpt-5.2              (GPT-5.2)
    gpt-5-codex          (GPT-5-Codex)
    gpt-5-mini           (GPT-5 mini, schnell)
    ── Custom Model eingeben ──
```

For Google:
```
  ❯ gemini-3-pro-preview     (SOTA — Gemini 3 Pro, Nov 2025)
    gemini-3-flash-preview    (Gemini 3 Flash, schnell)
    gemini-2.5-pro            (Gemini 2.5 Pro)
    gemini-2.5-flash          (Gemini 2.5 Flash)
    ── Custom Model eingeben ──
```

**"Custom Model"** → fallback to `input()` with freetext

---

### Screen 3: Thinking Budget / Reasoning Level

This is **provider-specific**. Research results:

#### Anthropic: `--max-turns` (context control)
Claude Code CLI doesn't expose a direct `--thinking-budget` flag. The agent manages thinking internally via "adaptive thinking". The controllable parameter is `--max-turns` which limits how many tool-use turns the agent can take per invocation.

```
? Max Turns pro Iteration (wie viele Tool-Calls pro Loop-Step):
  ❯ 5   (schnell, einfache Tasks)
    10  (standard)
    25  (komplex, tiefe Analyse)
    50  (maximale Autonomie)
    ── Custom Zahl eingeben ──
```

#### OpenAI: `--reasoning-effort`
Codex CLI supports `--reasoning-effort` natively with the reasoning models.

```
? Reasoning Effort:
  ❯ high   (empfohlen für Refactoring)
    medium (Routine-Tasks)
    low    (schnelle Fixes)
```

#### Google: `thinkingLevel` (via config)
Gemini CLI reads thinking config from `settings.json` or environment. For Gemini 3 models, `thinkingLevel` is the parameter.

```
? Thinking Level:
  ❯ high     (maximale Reasoning-Tiefe)
    medium   (balanced)
    low      (schnelle Antworten)
    none     (Thinking deaktiviert)
```

---

### Screen 4: Plan Selection
```
? Was möchtest du tun?
  ❯ Neuen Plan erstellen
    Bestehenden Plan laden
```

#### "Neuen Plan erstellen":
```
? Beschreibe das Ziel (z.B. "Refactoring von X"):
> Refactoring der Backend-Services: Services > 500 LOC aufteilen

🔄 Erstelle Plan via [Provider]...
```

The tool executes an initial agent call with the prompt:
```
Du bist ein Senior Engineer. Zerlege die folgende Aufgabe in kleine, messbare Einzelschritte.
Jeder Schritt muss:
1. Genau eine Datei oder ein klar abgegrenztes Modul betreffen
2. Ein messbares Erfolgskriterium haben (z.B. "Tests laufen", "File < 500 LOC")
3. Unabhängig genug sein, um in einer einzelnen Agent-Session abgeschlossen zu werden

Aufgabe: {user_goal}

Antworte NUR mit gültigem JSON im folgenden Format:
{plan_schema}
```

Output saved to `ralph-plan.json`.

#### "Bestehenden Plan laden":
```
? Plan-Datei auswählen:
  ❯ ./ralph-plan.json
    ./prd.json
    ./plan.md
    ── Pfad manuell eingeben ──
```

Scans working directory for `*.json` and `*.md` files matching common plan patterns.

---

### Screen 5: Iteration Count
```
? Maximale Iterationen: (10)
>
```

Default: 10. Input validation: number, 1-100.

---

### Screen 6: Confirmation Screen
```
╔══════════════════════════════════════════════╗
║          🔄 RALPH LOOP — Konfiguration       ║
╠══════════════════════════════════════════════╣
║  Provider      │ Anthropic (Claude Code)     ║
║  Model         │ claude-sonnet-4-6-20250217  ║
║  Thinking      │ max-turns: 25              ║
║  Plan          │ ./ralph-plan.json (8 steps) ║
║  Iterationen   │ 10                          ║
║  Working Dir   │ /Users/.../DirectStock      ║
╠══════════════════════════════════════════════╣
║  Alles korrekt? Drücke Enter zum Starten.    ║
╚══════════════════════════════════════════════╝
```

On confirm:
1. Save config to `~/.direct-ralph/last-preset.json`
2. Start the loop

---

## 4. The Ralph Loop Engine — Core Logic

### 4.1 Plan File Schema (`ralph-plan.json`)

```typescript
// plan-schema.ts
import { z } from 'zod';

export const StepSchema = z.object({
  id: z.string(),              // "step-01"
  title: z.string(),           // "Extract inventory calc to service"
  description: z.string(),     // Detailed what + how
  successCriteria: z.string(), // "cd backend && python -m pytest -q passes"
  status: z.enum(["pending", "in_progress", "done", "failed"]),
  attempts: z.number().default(0),
  maxAttempts: z.number().default(3),
  lastError: z.string().optional(),
});

export const PlanSchema = z.object({
  goal: z.string(),
  createdAt: z.string(),
  steps: z.array(StepSchema),
  metadata: z.object({
    provider: z.string(),
    model: z.string(),
    totalIterations: z.number(),
    completedIterations: z.number(),
  }),
});
```

### 4.2 Loop Pseudocode

```typescript
// executor.ts — the core Ralph Loop
async function runRalphLoop(config: RalphConfig): Promise<void> {
  const plan = loadPlan(config.planPath);

  for (let i = 0; i < config.maxIterations; i++) {
    // 1. Find next pending step
    const nextStep = plan.steps.find(s => s.status === "pending" || s.status === "failed");
    if (!nextStep) {
      console.log(chalk.green("✅ Alle Steps abgeschlossen!"));
      break;
    }

    // 2. Build the iteration prompt
    const prompt = buildIterationPrompt(plan, nextStep);

    // 3. Capture git state BEFORE execution
    const gitStateBefore = await captureGitState();

    // 4. Execute agent CLI (THIS IS THE KEY — fresh process = fresh context)
    const result = await executeAgentCLI(config.provider, {
      model: config.model,
      thinkingConfig: config.thinkingConfig,
      prompt: prompt,
      cwd: config.workingDir,
    });

    // 5. Run success criteria check
    const passed = await runSuccessCriteria(nextStep.successCriteria);

    // 6. Update plan file
    if (passed) {
      nextStep.status = "done";
      // Auto-commit with descriptive message
      await gitCommit(`ralph: ✅ ${nextStep.title}`);
    } else {
      nextStep.attempts++;
      nextStep.lastError = result.stderr || "Success criteria failed";
      if (nextStep.attempts >= nextStep.maxAttempts) {
        nextStep.status = "failed";
        console.log(chalk.red(`❌ Step "${nextStep.title}" failed after ${nextStep.maxAttempts} attempts`));
      }
    }

    plan.metadata.completedIterations = i + 1;
    savePlan(config.planPath, plan);

    // 7. Print iteration summary
    printIterationSummary(i + 1, config.maxIterations, nextStep, passed);

    // 8. Context is AUTOMATICALLY reset because we spawned a new process
    // The next iteration starts a brand-new agent process
  }
}
```

### 4.3 Iteration Prompt Template

The prompt given to the agent on each iteration is critical. It must provide:
- The current plan state
- The specific step to work on
- The success criteria
- Instruction to ONLY work on this step

```typescript
function buildIterationPrompt(plan: Plan, step: Step): string {
  return `
Du bist ein Senior Engineer. Du arbeitest an einem iterativen Refactoring-Plan.

## Aktueller Plan-Status:
${plan.steps.map(s => `- [${s.status === 'done' ? 'x' : s.status === 'in_progress' ? '/' : ' '}] ${s.title}`).join('\n')}

## Dein aktueller Task:
**${step.title}**
${step.description}

## Erfolgskriterium:
${step.successCriteria}

## Regeln:
1. Arbeite NUR an diesem einen Step
2. Mache kleine, reviewbare Änderungen
3. Folge AGENTS.md und dem nächsten nested AGENTS.md
4. Führe das Erfolgskriterium SELBST aus und prüfe ob es passt
5. Committe NICHT selbst — das macht der Ralph Loop
6. Wenn du nicht sicher bist, beschreibe was unklar ist in einer Datei .ralph-notes.md

## Git Status (seit letztem Step):
Nutze git log und git diff um den aktuellen Stand zu verstehen.
`.trim();
}
```

### 4.4 Provider Adapters

Each provider adapter implements a common interface:

```typescript
// types.ts
interface ProviderAdapter {
  name: string;
  cliCommand: string;
  models: ModelOption[];
  thinkingOptions: ThinkingOption[];
  buildCommand(args: ExecuteArgs): string[];
  isInstalled(): Promise<boolean>;
}
```

#### Anthropic (Claude Code)
```typescript
// anthropic.ts
export const anthropicAdapter: ProviderAdapter = {
  name: "Anthropic",
  cliCommand: "claude",
  models: [
    { value: "claude-sonnet-4-6-20250217", label: "Claude Sonnet 4.6 (SOTA)", tag: "Feb 2026" },
    { value: "claude-opus-4-6-20250205", label: "Claude Opus 4.6", tag: "Feb 2026" },
    { value: "claude-sonnet-4-5-20241022", label: "Claude Sonnet 4.5", tag: "Oct 2024" },
    { value: "claude-haiku-4-5-20251015", label: "Claude Haiku 4.5", tag: "Oct 2025" },
  ],
  thinkingOptions: [
    { value: "5", label: "5 max-turns (schnell)" },
    { value: "10", label: "10 max-turns (standard)" },
    { value: "25", label: "25 max-turns (komplex)" },
    { value: "50", label: "50 max-turns (maximale Autonomie)" },
  ],
  buildCommand({ model, thinkingValue, prompt }) {
    return [
      "claude",
      "-p", prompt,             // non-interactive print mode
      "--model", model,
      "--max-turns", thinkingValue,
      "--output-format", "json",
      "--dangerously-skip-permissions",  // full autonomy
    ];
  },
};
```

#### OpenAI (Codex CLI)
```typescript
// openai.ts
export const openaiAdapter: ProviderAdapter = {
  name: "OpenAI",
  cliCommand: "codex",
  models: [
    { value: "gpt-5.3-codex", label: "GPT-5.3-Codex (SOTA)", tag: "Feb 2026" },
    { value: "gpt-5.2", label: "GPT-5.2", tag: "Dec 2025" },
    { value: "gpt-5-codex", label: "GPT-5-Codex", tag: "Aug 2025" },
    { value: "gpt-5-mini", label: "GPT-5 mini (schnell)", tag: "2025" },
  ],
  thinkingOptions: [
    { value: "high", label: "high (empfohlen)" },
    { value: "medium", label: "medium" },
    { value: "low", label: "low" },
  ],
  buildCommand({ model, thinkingValue, prompt }) {
    return [
      "codex", "exec",
      "-m", model,
      "--reasoning-effort", thinkingValue,
      "--ask-for-approval", "never",
      "--full-auto",
      prompt,
    ];
  },
};
```

#### Google (Gemini CLI)
```typescript
// google.ts
export const googleAdapter: ProviderAdapter = {
  name: "Google",
  cliCommand: "gemini",
  models: [
    { value: "gemini-3-pro-preview", label: "Gemini 3 Pro (SOTA)", tag: "Nov 2025" },
    { value: "gemini-3-flash-preview", label: "Gemini 3 Flash (schnell)", tag: "Dec 2025" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro", tag: "2025" },
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash", tag: "2025" },
  ],
  thinkingOptions: [
    { value: "high", label: "high (maximale Tiefe)" },
    { value: "medium", label: "medium (balanced)" },
    { value: "low", label: "low (schnell)" },
    { value: "none", label: "none (Thinking aus)" },
  ],
  buildCommand({ model, thinkingValue, prompt }) {
    return [
      "gemini",
      "-p", prompt,             // non-interactive prompt mode
      "--model", model,
      // thinkingLevel is set via GEMINI_THINKING_LEVEL env var or settings.json
    ];
  },
};
```

---

## 5. Context Reset Mechanism

This is the **heart of the Ralph Method**. Each iteration:

1. **Spawns a NEW process** — `execa()` creates a child process for the agent CLI. When it exits, ALL context is gone.
2. **State lives ONLY in files** — `ralph-plan.json` is the single source of truth.
3. **Git is the memory** — The agent is told to use `git log` and `git diff` to understand what changed.

```typescript
// context-reset.ts
async function captureGitState(): Promise<string> {
  const { stdout: log } = await execa("git", ["log", "--oneline", "-10"]);
  const { stdout: status } = await execa("git", ["status", "--short"]);
  return `Recent commits:\n${log}\n\nUncommitted changes:\n${status}`;
}

async function gitCommit(message: string): Promise<void> {
  await execa("git", ["add", "-A"]);
  await execa("git", ["commit", "-m", message, "--allow-empty"]);
}
```

---

## 6. Preset System

```typescript
// preset.ts
const PRESET_DIR = path.join(os.homedir(), ".direct-ralph");
const PRESET_FILE = path.join(PRESET_DIR, "last-preset.json");

interface Preset {
  provider: string;
  model: string;
  thinkingValue: string;
  planPath: string;
  maxIterations: number;
  savedAt: string;
}

function savePreset(preset: Preset): void { /* write JSON */ }
function loadPreset(): Preset | null { /* read JSON or null */ }
```

---

## 7. Progress Display During Loop

```
╔═══════════════════════════════════════════════════╗
║  🔄 RALPH LOOP — Iteration 3/10                  ║
╠═══════════════════════════════════════════════════╣
║  Step:     Extract inventory calc to service      ║
║  Status:   🏃 Running...                          ║
║  Attempts: 1/3                                    ║
╠═══════════════════════════════════════════════════╣
║  Plan Progress:                                   ║
║  [x] Step 1: Split user service                   ║
║  [x] Step 2: Extract auth middleware              ║
║  [/] Step 3: Extract inventory calc     ← current ║
║  [ ] Step 4: Consolidate error handling           ║
║  [ ] Step 5: Add integration tests                ║
╚═══════════════════════════════════════════════════╝
```

---

## 8. Implementation Checklist

### Phase 1: Scaffold (1-2h)
- [ ] Create `scripts/ralph/` directory structure
- [ ] Init `package.json` with `bin: { "direct": "./dist/cli.js" }`
- [ ] Set up `tsconfig.json` with ESM + strict mode
- [ ] Install dependencies
- [ ] Create `cli.ts` entry point with commander

### Phase 2: Provider Adapters (1-2h)
- [ ] Implement `ProviderAdapter` interface in `types.ts`
- [ ] Implement `anthropic.ts` with Claude Code CLI flags
- [ ] Implement `openai.ts` with Codex CLI flags
- [ ] Implement `google.ts` with Gemini CLI flags
- [ ] Implement `models.ts` with model catalogs + custom model option
- [ ] Add `isInstalled()` check per provider (verify CLI is available)

### Phase 3: Interactive UI (2-3h)
- [ ] Implement preset load/save in `preset.ts`
- [ ] Implement all prompts in `prompts.ts` (provider, model, thinking, plan, iterations)
- [ ] Implement confirmation table in `confirmation.ts`
- [ ] Implement plan creation flow (agent call to decompose task)
- [ ] Implement plan loading flow (file picker + validation)
- [ ] Implement progress display in `progress.ts`

### Phase 4: Loop Engine (2-3h)
- [ ] Implement `plan-schema.ts` with Zod validation
- [ ] Implement `buildIterationPrompt()` with plan context injection
- [ ] Implement `executeAgentCLI()` with process spawning
- [ ] Implement success criteria runner (shell command execution)
- [ ] Implement git state capture and auto-commit
- [ ] Implement iteration summary output
- [ ] Implement max-attempts retry logic per step

### Phase 5: Polish & Testing (1-2h)
- [ ] Add error handling (CLI not installed, plan file invalid, etc.)
- [ ] Add `--no-preset` and `--dry-run` flags
- [ ] Add color output and spinner animations
- [ ] Test with each provider (Claude, Codex, Gemini)
- [ ] Add to project's `.agents/workflows/ralph-loop.md`
- [ ] Document in README

### Total Estimated Effort: **7-12 hours**

---

## 9. Integration With DirectStock

The Ralph Loop lives at `scripts/ralph/` and integrates with existing governance:

1. **AGENTS.md** — The iteration prompt tells agents to follow `AGENTS.md`
2. **Plan files** — Stored in project root or `docs/` as `ralph-plan.json`
3. **Git history** — Each iteration creates a clean commit
4. **Self-improvement** — Failed steps can create incident log entries automatically
5. **Workflow** — Add `.agents/workflows/ralph-loop.md` for other agents to use

---

## 10. Example Usage

```bash
# First run — full interactive setup
$ direct ralph

# Repeat with last config
$ direct ralph
> Letztes Preset verwenden? Y
> ✅ Starting Ralph Loop...

# Skip preset prompt
$ direct ralph --no-preset

# Dry run (show what would execute)
$ direct ralph --dry-run
```
