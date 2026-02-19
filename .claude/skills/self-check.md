---
name: Self-Check
description: Run governance self-check before ending a session
---

# Self-Check Skill

## When to Use
Before ending any work session, or when you want to validate that your changes comply with project governance.

## Steps

1. **Check file size limits**:
   ```bash
   ./scripts/check_file_size_limits.sh
   ```

2. **Check API contract drift** (if backend changes):
   ```bash
   ./scripts/check_api_contract_drift.sh
   ```

3. **Check dead code** (if frontend changes):
   ```bash
   cd frontend && npm run knip
   ```

4. **Validate repo index** (if files added/removed):
   ```bash
   python3 scripts/generate_repo_index.py --check
   ```

5. **Validate entrypoint coverage**:
   ```bash
   python3 scripts/check_entrypoint_coverage.py
   ```

6. **Check if any governance docs need updating**:
   - `docs/agents/incident-log.md` — if any failure occurred
   - `docs/agents/entrypoints/*.md` — if files were added/removed
   - `docs/agents/patterns.md` — if a useful approach was discovered

## When to Skip
- Pure documentation changes with no code impact
- Single-line fixes with no structural changes
