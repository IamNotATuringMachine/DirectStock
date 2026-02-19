# Ralph Plan Template (v1.1.0)

Nutze dieses Template als verbindliche Ausgangsform für `ralph-plan.json`.

## Regeln
1. Ein Step beschreibt genau ein klar abgegrenztes Ergebnis.
2. `files` enthält `Affected Paths` (glob oder konkrete Dateien).
3. `successCriteria` ist ein ausführbarer Shell-Command.
4. `postChecks` enthält optionale zusätzliche Commands pro Step.
5. `rollbackHint` beschreibt den schnellsten sicheren Rückweg.
6. `riskLevel` ist konservativ zu setzen (`high` bei Unsicherheit).

## JSON Template

```json
{
  "schemaVersion": "1.1.0",
  "goal": "Kurzbeschreibung des Ziels",
  "createdAt": "2026-02-19T00:00:00.000Z",
  "steps": [
    {
      "id": "step-01",
      "title": "Titel",
      "description": "Konkrete Umsetzung in 1-3 Sätzen",
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

## Definition of Done pro Step
1. `status=done`
2. `successCriteria` erfolgreich ausgeführt
3. falls gesetzt: `postChecks` erfolgreich ausgeführt
4. Reviewbare Änderungen im Ziel-Scope

## Gate-Matrix (Empfehlung)
1. `low`: mindestens `./scripts/check_refactor_scope_allowlist.sh`
2. `medium`: plus `./scripts/check_file_size_limits.sh`
3. `high`: plus `./scripts/agent_governance_check.sh` und `python3 scripts/check_provider_capabilities.py --provider all --format json`

## Affected Paths (Guideline)
1. Nutze repo-relative Pfade.
2. Bei großem Scope lieber mehrere kleine Steps mit je engem `files`-Set.
3. Beispiel: `backend/app/services/inventory.py` statt nur `backend/`.

## Empfohlene Risk-Class Heuristik
1. `low`: lokale Doku/Tests, keine Verträge verändert.
2. `medium`: mehrere Dateien, internes Refactoring ohne API-Änderung.
3. `high`: API-/Schema-/Sicherheits-/Migrationsänderung.
