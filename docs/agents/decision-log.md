# Agent High-Risk Decision Log

This log is mandatory in `unrestricted_senior` mode.

Use one entry per high-risk action (destructive git, breaking API/schema, security-critical change, invasive migration, or comparable blast radius).

## Entry Template

```md
## YYYY-MM-DDTHH:MM:SSZ - <short action label>
- action: <what will be or was executed>
- rationale: <why this was chosen>
- impacted_files: <paths or systems>
- risk_level: <low|medium|high|critical>
- expected_impact: <before execution expectation>
- result: <success|partial|failed>
- actual_impact: <after execution impact>
- rollback_hint: <how to reverse or mitigate>
- verification:
  - `<command>` -> PASS|FAIL (short note)
```

## Entries

<!-- Append new entries below this line in reverse chronological order. -->
