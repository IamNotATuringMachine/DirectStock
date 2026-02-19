---
description: Agent self-improvement cycle — scan incidents, update policy, validate
---

# Self-Improvement Run Workflow

// turbo-all

## Prerequisites
- Access to `docs/agents/incident-log.md`
- Access to `docs/agents/decision-log.md`

## Steps

1. **Run self-improvement check** — Scan for recurring incidents:
   ```bash
   python3 scripts/agent_self_improve.py --mode check
   ```

2. **Review auto-improvement backlog**:
   ```bash
   cat docs/agents/auto-improvement-backlog.md
   ```

3. **If improvements are recommended**, execute them:
   ```bash
   python3 scripts/agent_self_improve.py --mode apply --emit-decision-log
   ```

4. **Validate policy contract**:
   ```bash
   python3 scripts/agent_policy_lint.py --strict --provider all --format json
   ```

5. **Validate provider capabilities**:
   ```bash
   python3 scripts/check_provider_capabilities.py --provider all --format json
   ```

6. **Run full governance check**:
   ```bash
   ./scripts/agent_governance_check.sh
   ```

7. **Validate repo index** — Ensure no drift:
   ```bash
   python3 scripts/generate_repo_index.py --check
   python3 scripts/check_entrypoint_coverage.py
   ```

8. **Review decision log** for any high-risk entries:
   ```bash
   tail -50 docs/agents/decision-log.md
   ```

9. **Commit policy updates** (if any changes were made):
   ```bash
   git add AGENTS.md docs/agents/ scripts/ .agents/ && git commit -m "chore(agents): self-improvement cycle"
   ```

## Completion Criteria
- All governance gates pass
- No policy lint findings
- Provider capabilities valid
- Decision log updated for any high-risk changes
- Backlog reflects current state
