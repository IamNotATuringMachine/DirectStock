# Anthropic Provider Profile (Claude Code + Agent SDK)

## Scope
- Adapter: `CLAUDE.md`
- Canonical policy: `AGENTS.md`
- Contract: `docs/agents/policy.contract.yaml`

## Required Capabilities
1. `claude_code_hooks`
2. `memory_files`
3. `prompt_caching`
4. `mcp_connectors`
5. `subagent_orchestration`
6. `hooks_lifecycle`
7. `skills_directory`

## Capability To Behavior Mapping
1. `claude_code_hooks` -> deterministic pre/post checks for lint/test/governance gates. Config: `.claude/hooks.json`.
2. `memory_files` -> operational memory stays external to canonical repo policy.
3. `prompt_caching` -> cache long governance/context prompts to reduce drift and latency.
4. `mcp_connectors` -> MCP connectors are preferred for local runtime and repo context.
5. `subagent_orchestration` -> delegate complex subtasks to scoped subagents with isolated context.
6. `hooks_lifecycle` -> `SessionStart`, `PreToolUse`, `PostToolUse`, `SubagentStart` events for automation.
7. `skills_directory` -> reusable task recipes in `.claude/skills/` for recurring patterns.

## Deterministic Runtime Rules
1. Use repository policy from `AGENTS.md`; do not mirror policy into local memory.
2. Keep hook behavior deterministic for checks, linting, and safety gates.
3. Use prompt caching breakpoints for long governance/context prompts.
4. Resolve ambiguity from code/docs/tests before asking users.
5. Emit runtime fallback evidence when hooks/cache/connectors are unavailable.
6. Use subagents for parallelizable subtasks within large features.
7. Reference `.agents/workflows/` for step-by-step execution patterns.

## Fallback Order
1. `AGENTS.md`
2. `docs/agents/providers/anthropic.md`
3. `CLAUDE.md`

## Failure Handling
1. If hooks or cache features are unavailable, run equivalent shell/script checks directly.
2. Any high-risk autonomous action must write to `docs/agents/decision-log.md`.
3. If subagent orchestration is unavailable, execute tasks sequentially in main context.

## Mandatory Verification Artifacts
1. `python3 scripts/check_provider_capabilities.py --provider anthropic --format json`
2. `python3 scripts/agent_policy_lint.py --strict --provider anthropic --format json`
