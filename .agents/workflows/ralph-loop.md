---
description: Run iterative context-resetting autonomous execution with direct ralph
---

# Ralph Loop Workflow

// turbo-all

## Prerequisites
- Plan file exists (for example `ralph-plan.json`) or a clear goal is available to generate one.
- `codex`, `claude`, or `gemini` CLI is installed and authenticated.
- Repository is clean (unless `--allow-dirty` is intentionally used).
- If multiple plans exist (`frontend_plan.json`, `backend_plan.json`, ...), select the desired plan in the interactive picker.

## Steps

1. Install Ralph CLI package dependencies:
   ```bash
   cd scripts/ralph && npm ci
   ```

2. Validate local package health:
   ```bash
   cd scripts/ralph && npm run test && npm run build
   ```

3. Start interactive setup:
   ```bash
   cd scripts/ralph && npm link
   cd ../.. && direct ralph
   ```

4. Optional deterministic run settings:
   ```bash
   direct ralph --plan ./ralph-plan.json --max-iterations 10 --no-preset --session-strategy reset --post-check-profile fast --log-format text
   ```

5. Optional preview without mutations:
   ```bash
   direct ralph --plan ./ralph-plan.json --dry-run
   ```

6. Show official plan template:
   ```bash
   direct ralph --plan-template
   ```

7. Optional strict provider capability checks (fail-fast):
   ```bash
   direct ralph --plan ./ralph-plan.json --strict-provider-capabilities
   ```

7. Run repository guardrails after loop completion:
   ```bash
   ./scripts/check_refactor_scope_allowlist.sh
   ./scripts/check_file_size_limits.sh
   ```

## Completion Criteria
- Plan file reflects latest step statuses (`pending|in_progress|done|failed`).
- Successful steps are auto-committed unless `--no-auto-commit` was used.
- Guard scripts pass for changed files.
- Plan format follows `docs/guides/ralph-plan-template.md` and `docs/contracts/ralph-plan.schema.json`.
- Run log exists under `.ralph/runs/` (or custom `--run-log-path`) with JSONL events.
