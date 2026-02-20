# Context Compaction Schema

Use this schema when summarizing context before compaction (for example in `PreCompact` hooks).

## YAML Schema

```yaml
version: "1.0"
session:
  id: "<stable-session-id>"
  timestamp_utc: "<ISO-8601 UTC timestamp>"
established_facts:
  - "<repo/runtime truth discovered during session>"
decisions:
  - decision: "<what was decided>"
    rationale: "<why this decision was made>"
    impact: "<scope of impact>"
active_constraints:
  - "<instruction, policy, or environment limitation currently active>"
open_questions:
  - question: "<unresolved question>"
    owner: "<who should answer>"
    next_step: "<what should happen next>"
```

## Required Sections

1. `established_facts`: objective truths gathered from code, docs, or executed checks.
2. `decisions`: choices made in-session with rationale and impact.
3. `active_constraints`: currently binding constraints (policy, runtime, scope).
4. `open_questions`: unresolved items that could affect next steps.

## Minimal Valid Example

```yaml
version: "1.0"
session:
  id: "sess-001"
  timestamp_utc: "2026-02-20T07:00:00Z"
established_facts:
  - "Ralph tests pass locally."
decisions:
  - decision: "Keep skills in .claude/skills/*.md format."
    rationale: "Matches existing repository convention."
    impact: "No migration to SKILL.md directories required."
active_constraints:
  - "Follow AGENTS.md and nearest nested AGENTS.md."
open_questions:
  - question: "None."
    owner: "n/a"
    next_step: "Proceed."
```

## Extended Example

```yaml
version: "1.0"
session:
  id: "sess-2026-02-20-ralph-wave"
  timestamp_utc: "2026-02-20T07:20:00Z"
established_facts:
  - "scripts/ralph/src/ralph.ts still contains bootstrap and policy helper logic."
  - "docs/agents/compaction-schema.md was missing before this change."
  - "Only three .claude skills existed before c11 implementation."
decisions:
  - decision: "Extract plan bootstrap to lib/plan-bootstrap.ts."
    rationale: "Keep ralph.ts orchestration-focused."
    impact: "Reduces coupling and improves testability."
  - decision: "Add run-summary analytics only."
    rationale: "Lowest implementation risk with immediate value."
    impact: "No new telemetry backend or metrics file."
active_constraints:
  - "Do not modify unrelated changed files."
  - "Keep handoff schema backward compatible while adding optional A2A fields."
  - "Use English for Ralph user-facing messages."
open_questions:
  - question: "Should analytics be persisted across runs in a future wave?"
    owner: "maintainers"
    next_step: "Revisit after observing run-summary usage."
```
