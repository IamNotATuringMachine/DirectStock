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

## Optional A2A v0.3 Extension
Use this block when handoff payloads need Agent-to-Agent interoperability metadata.

- `a2a.protocol_version`: must be `0.3`
- `a2a.sender`: agent identity that produced the handoff
- `a2a.receiver`: intended receiving agent identity
- `a2a.capabilities_declared`: capabilities the sender can provide
- `a2a.capabilities_required`: capabilities required by the receiver to continue work
- `a2a.interaction_id`: stable interaction/thread identifier
- `a2a.checkpoint_id`: optional checkpoint identifier for resume workflows
- `a2a.agent_card_ref`: optional reference to Agent Card/source descriptor
- `a2a.handoff_reason`: optional concise reason for delegation/transfer

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
- a2a: # optional
  - protocol_version: 0.3
  - sender:
    - agent_id: orchestrator.alpha
    - provider: openai
    - model: gpt-5.3-codex
  - receiver:
    - agent_id: verifier.beta
    - provider: anthropic
    - model: claude-sonnet-4-6-20250217
  - capabilities_declared:
    - mcp_tooling
    - context_compaction
  - capabilities_required:
    - claude_code_hooks
  - interaction_id: int-2026-02-20-001
  - checkpoint_id: cp-03
  - agent_card_ref: https://example.local/agent-cards/verifier-beta.json
  - handoff_reason: hand over verification and risk review
```

## Canonical JSON Example (with optional `a2a`)
```json
{
  "objective": "Stabilize Ralph CLI loop output for provider parity.",
  "in_scope": ["Update prompt copy", "Adjust loop analytics", "Refresh tests"],
  "out_of_scope": ["Provider model catalog changes"],
  "changed_files": ["scripts/ralph/src/loop/executor.ts"],
  "verification": [
    {
      "command": "cd scripts/ralph && npm test",
      "result": "PASS",
      "notes": "All tests green."
    }
  ],
  "open_risks": [
    {
      "risk": "No live provider run performed",
      "impact": "Runtime edge cases may still exist",
      "owner": "qa"
    }
  ],
  "next_actions": [
    "Run live smoke tests for all providers",
    "Review run logs for output drift"
  ],
  "assumptions": ["Provider CLIs remain installed and authenticated"],
  "a2a": {
    "protocol_version": "0.3",
    "sender": {
      "agent_id": "orchestrator.alpha",
      "provider": "openai",
      "model": "gpt-5.3-codex"
    },
    "receiver": {
      "agent_id": "verifier.beta",
      "provider": "anthropic",
      "model": "claude-sonnet-4-6-20250217"
    },
    "capabilities_declared": ["mcp_tooling", "context_compaction"],
    "capabilities_required": ["claude_code_hooks"],
    "interaction_id": "int-2026-02-20-001",
    "checkpoint_id": "cp-03",
    "agent_card_ref": "https://example.local/agent-cards/verifier-beta.json",
    "handoff_reason": "handover for independent verification"
  }
}
```

## Validation Rules
1. No empty required field.
2. Verification must include actual executed commands.
3. Risks must include impact and owner.
4. If verification failed, include blocker severity and rollback path.
