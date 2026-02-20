# DirectStock LLM-Readiness Masterplan 2026

> Version: 2026-02-20 | Status: Implementation in progress

## Context

DirectStock is a WMS (Warehouse Management System) with an advanced agent setup. This plan brings the project to SOTA (State of the Art) February 2026 for maximum LLM-friendliness and autonomous "Vibe Coding" with all three providers (Anthropic, OpenAI, Google).

---

## Assessment: LLM-Friendliness — 7.4 / 10

| Category | Score | Key Gap |
|---|---|---|
| AGENTS.md Quality | 8/10 | Too long (~298 lines), SOTA recommends <200 |
| Provider Parity | 7/10 | Missing agent_teams, skills_system, A2A v0.3 |
| MCP Server Setup | 7/10 | No Sentry/Docker MCP, redundant openai-docs server |
| Ralph Loop | 8/10 | Model catalog partially outdated |
| Code Architecture | 7/10 | No llms.txt, minimal .ai-context.md |
| Hooks & Skills | 7/10 | Only 3/7+ hook types, small skills set |
| CI/CD Agent Integration | 8/10 | No agentic workflows |
| Governance & Self-Improvement | 9/10 | Best-in-class |
| Documentation for Agents | 8/10 | No llms.txt entry point |
| Cross-Provider Standards | 6/10 | No A2A v0.3, no SKILL.md convergence |

---

## Implementation Phases

### Phase A — Quick Wins
1. Model catalog update (`scripts/ralph/src/config/models.ts`)
2. `llms.txt` creation (root)
3. `.ai-context.md` expansion
4. Provider profiles update (anthropic.md, openai.md, google.md)
5. `policy.contract.yaml` update

### Phase B — Medium Effort
6. AGENTS.md refactoring (<200 lines, extract sections)
7. Hooks expansion (PreCompact, Stop, SubagentStop)
8. CLAUDE.md, CODEX.md, GEMINI.md modernization
9. MCP profile consolidation
10. Ralph `ralph.ts` refactoring (helpers to lib/)

### Phase C — Deeper Changes
11. New skills (migration.md, debugging.md, performance.md)
12. A2A v0.3 readiness (handoff-protocol.md)
13. Context-compaction schema
14. Ralph English messages + analytics
15. Ralph CLI all messages to English

---

## Completion Log (2026-02-20)

- `b10` ✅ Completed: `scripts/ralph/src/ralph.ts` refactored to orchestration-first with extracted helpers in `scripts/ralph/src/lib/{auto-commit-policy.ts,model-normalization.ts,plan-bootstrap.ts}`.
- `c11` ✅ Completed: Added `.claude/skills/{migration.md,debugging.md,performance.md}` with DirectStock-specific commands and invariants.
- `c12` ✅ Completed: Extended `docs/agents/handoff-protocol.md` and `docs/agents/handoff.schema.json` with optional A2A v0.3-compatible metadata.
- `c13` ✅ Completed: Added `docs/agents/compaction-schema.md` and aligned it with `.claude/hooks.json` PreCompact references.
- `c14` ✅ Completed: Added in-memory run-summary analytics to `runRalphLoop` and surfaced concise analytics output in `runRalph`.
- `c15` ✅ Completed: Converted Ralph user-facing German copy to English in `scripts/ralph/src/{ui/prompts.ts,loop/executor.ts,planner/planner.ts}` and translated `docs/guides/ralph-plan-template.md`.

---

## Verification Gates

```bash
# Policy & Provider Parity
python3 scripts/agent_policy_lint.py --strict --provider all --format json
python3 scripts/check_provider_capabilities.py --provider all --format json

# Repo Structure
python3 scripts/generate_repo_index.py --check
python3 scripts/check_entrypoint_coverage.py

# Ralph CLI
cd scripts/ralph && npm test

# MCP Readiness
MCP_PROFILE=ci-readonly MCP_REQUIRE_POSTGRES_READONLY=1 ./scripts/check_mcp_readiness.sh

# File Size Limits
wc -l scripts/ralph/src/ralph.ts  # Target: <500
```
