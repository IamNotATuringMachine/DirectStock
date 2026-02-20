# Ralph Plan Template (v1.1.0)

Use this template as the canonical starting format for `ralph-plan.json`.

## Rules
1. A step must describe exactly one clearly scoped outcome.
2. `files` contains `Affected Paths` (glob patterns or concrete files).
3. `successCriteria` must be an executable shell command.
4. `postChecks` contains optional additional commands per step.
5. `rollbackHint` describes the fastest safe rollback path.
6. Set `riskLevel` conservatively (`high` when uncertain).

## JSON Template

```json
{
  "schemaVersion": "1.1.0",
  "goal": "Short goal description",
  "createdAt": "2026-02-19T00:00:00.000Z",
  "steps": [
    {
      "id": "step-01",
      "title": "Titel",
      "description": "Concrete implementation plan in 1-3 sentences",
      "successCriteria": "cd scripts/ralph && npm run test",
      "status": "pending",
      "attempts": 0,
      "maxAttempts": 3,
      "type": "code",
      "files": [
        "scripts/ralph/src/ralph.ts",
        "scripts/ralph/src/loop/executor.ts"
      ],
      "riskLevel": "medium",
      "owner": "agent",
      "postChecks": [
        "./scripts/check_refactor_scope_allowlist.sh"
      ],
      "rollbackHint": "git revert <commit_sha>"
    }
  ],
  "metadata": {
    "provider": "OpenAI",
    "model": "gpt-5.3-codex",
    "totalIterations": 10,
    "completedIterations": 0,
    "resumeSessionId": "optional-provider-session-id"
  }
}
```

## Definition of Done per Step
1. `status=done`
2. `successCriteria` executed successfully
3. if set: `postChecks` executed successfully
4. reviewable changes inside the target scope

## Gate Matrix (Recommended)
1. `low`: at least `./scripts/check_refactor_scope_allowlist.sh`
2. `medium`: plus `./scripts/check_file_size_limits.sh`
3. `high`: plus `./scripts/agent_governance_check.sh` and `python3 scripts/check_provider_capabilities.py --provider all --format json`

## Affected Paths (Guideline)
1. Use repository-relative paths.
2. For large scope, prefer multiple small steps with narrow `files` sets.
3. Example: `backend/app/services/inventory.py` instead of only `backend/`.

## Recommended Risk-Class Heuristic
1. `low`: local docs/tests, no contract changes.
2. `medium`: multiple files, internal refactor without API changes.
3. `high`: API/schema/security/migration changes.
