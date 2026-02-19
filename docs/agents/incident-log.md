# Agent Incident Log

## Purpose
Track recurring autonomous execution failures and rule gaps that require governance changes.

## Logging Rule
Create one entry per incident when:
1. A mandatory gate fails repeatedly.
2. Agent instructions are ambiguous/conflicting.
3. A policy violation is detected.
4. A recurring flaky workflow reduces autonomous success.

## Entry Template
```md
## Incident <YYYY-MM-DD>-<short-id>
- timestamp_utc: 2026-02-18T00:00:00Z
- severity: low|medium|high|critical
- category: policy|quality-gate|tooling|security|contract|infra
- summary: ...
- trigger: ...
- impacted_paths:
  - path
- evidence:
  - command -> output summary
- mitigation_applied: ...
- permanent_fix_proposal: ...
- owner: ...
- status: open|monitoring|closed
```

## Severity Guide
1. `critical`: security/integrity risk or data loss risk.
2. `high`: contract break risk or repeated CI gate failure.
3. `medium`: autonomous throughput or reliability degraded.
4. `low`: documentation/protocol drift with low immediate impact.
