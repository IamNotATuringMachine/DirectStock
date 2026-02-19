# Anthropic Provider Profile (Claude Code)

## Scope
- Adapter: `CLAUDE.md`
- Canonical policy: `AGENTS.md`
- Contract: `docs/agents/policy.contract.yaml`

## Required Capabilities
1. `claude_code_hooks`
2. `memory_files`
3. `prompt_caching`
4. `mcp_connectors`

## Deterministic Runtime Rules
1. Use repository policy from `AGENTS.md`; do not mirror policy into local memory.
2. Keep hook behavior deterministic for checks, linting, and safety gates.
3. Use prompt caching breakpoints for long governance/context prompts.
4. Resolve ambiguity from code/docs/tests before asking users.

## Fallback Order
1. `AGENTS.md`
2. `docs/agents/providers/anthropic.md`
3. `CLAUDE.md`

## Failure Handling
1. If hooks or cache features are unavailable, run equivalent shell/script checks directly.
2. Any high-risk autonomous action must write to `docs/agents/decision-log.md`.
