# Agent Handoff Protocol

## Purpose
Standard handoff format for autonomous wave work. Keep it brief, deterministic, and directly executable.

## Required Fields
1. `objective`: one sentence target.
2. `in_scope`: explicit responsibilities for next agent.
3. `out_of_scope`: explicit exclusions.
4. `changed_files`: full paths.
5. `verification`: commands and pass/fail results.
6. `open_risks`: concrete risks with owner.
7. `next_actions`: max 3 ordered actions.
8. `assumptions`: assumptions that affected decisions.

## Canonical Markdown Template
```md
## Handoff
- objective: ...
- in_scope: ...
- out_of_scope: ...
- changed_files:
  - /abs/or/repo/path
- verification:
  - `command` -> PASS|FAIL (short note)
- open_risks:
  - risk, impact, owner
- next_actions:
  1. ...
  2. ...
- assumptions:
  - ...
```

## Validation Rules
1. No empty required field.
2. Verification must include actual executed commands.
3. Risks must include impact and owner.
4. If verification failed, include blocker severity and rollback path.
