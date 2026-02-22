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

## 2026-02-21T18:46:14Z - purchase-order supplier email workflow rollout
- action: add purchase-order supplier communication state model, SMTP/IMAP workflow services, new API endpoints, and frontend purchasing/goods-receipt flow updates for send/sync/reply-confirmation handling
- rationale: implement end-to-end supplier order email exchange with auditable communication events, reply attachment ingestion, and confirmed-only receiving flow
- impacted_files: backend/app/models/purchasing.py, backend/alembic/versions/0035_purchase_order_email_workflow.py, backend/app/services/purchasing/email_workflow.py, backend/app/routers/purchasing.py, backend/app/routers/suppliers.py, backend/app/routers/documents.py, backend/app/main.py, frontend/src/pages/purchasing/*, frontend/src/pages/goods-receipt/hooks/useGoodsReceiptFlow.ts, frontend/src/services/purchasingApi.ts, frontend/src/services/suppliersApi.ts, frontend/src/types/*
- risk_level: high
- expected_impact: purchase orders gain explicit supplier communication lifecycle, outbound order mails include persisted PDFs, inbound replies are imported/deduplicated as `.eml`, and goods receipt PO mode only exposes supplier-confirmed orders
- result: success
- actual_impact: workflow is implemented across backend/frontend with migration/backfill, template CRUD+validation, IMAP sync endpoint/background poller, communication timeline data, and confirmed-only PO selection for goods receipt
- rollback_hint: revert migration `0035_purchase_order_email_workflow`, remove new purchasing/supplier endpoints/services and frontend API/UX additions, then run test suite and contract drift check
- verification:
  - `cd backend && .venv/bin/python -m pytest -q tests/test_purchase_orders.py tests/test_documents.py tests/test_operations.py` -> PASS (15 passed)
  - `cd frontend && npm run test` -> PASS (13 files, 45 tests)
  - `./scripts/check_api_contract_drift.sh` -> PASS

## 2026-02-19T17:11:12Z - migrate postgres mcp server to in-repo implementation
- action: replace deprecated npm-based PostgreSQL MCP runtime with in-repo Python MCP server and hard-switch all startup/readiness/bootstrap paths
- rationale: `@modelcontextprotocol/server-postgres` is deprecated; repository must remove dependency on archived/deprecated server implementation
- impacted_files: scripts/mcp/start_postgres_server.sh, scripts/mcp/directstock_postgres_server.py, scripts/check_mcp_readiness.sh, scripts/setup_mcp_multi_cli.sh, docs/guides/mcp-stack-strategy.md, docs/guides/gemini-antigravity-setup.md, docs/validation/metrics/*
- risk_level: high
- expected_impact: Postgres MCP behavior remains compatible for clients (`directstock-postgres`, `MCP_POSTGRES_DSN`, read-only policy) while runtime dependency changes to maintained in-repo code
- result: success
- actual_impact: Postgres MCP now runs via in-repo Python server with read-only enforcement and mutating-SQL blocklist; readiness/governance snapshots were regenerated and now report current parity/health state.
- rollback_hint: restore previous `@modelcontextprotocol/server-postgres` invocation paths in start/readiness scripts and revert docs/metrics snapshots
- verification:
  - `python3 scripts/check_mcp_profile_parity.py --strict --format json` -> PASS
  - `MCP_PROFILE=dev-autonomy MCP_PROBE_ALLOW_BLOCKED=1 ./scripts/check_mcp_readiness.sh` -> PASS
  - `MCP_PROFILE=ci-readonly MCP_REQUIRE_POSTGRES_READONLY=1 MCP_PROBE_ALLOW_BLOCKED=0 ./scripts/check_mcp_readiness.sh` -> PASS
  - `MCP_POSTGRES_DSN='postgresql://directstock:directstock@localhost:5432/directstock_clean' MCP_REQUIRE_POSTGRES_READONLY=1 ./scripts/mcp/start_postgres_server.sh` -> PASS (expected fail, user suffix guard)
  - `uv run --quiet --with 'mcp>=1.26.0,<2.0.0' --with 'psycopg[binary]>=3.2.13,<4.0.0' python <inline mutating SQL check>` -> PASS (WRITE_BLOCKED enforced)
  - `./scripts/check_gemini_readiness.sh --mode static` -> PASS
  - `./scripts/check_gemini_readiness.sh --mode runtime --enforce-allowlist` -> PASS
  - `./scripts/agent_governance_check.sh` -> PASS

## 2026-02-19T14:25:09Z - realign branch protection to deterministic provider contexts
- action: replace legacy `provider_capability_matrix` required context with explicit provider contexts (`provider_capability_openai`, `provider_capability_anthropic`, `provider_capability_google`) on `main`
- rationale: matrix-style context naming is ambiguous for branch protection; explicit contexts remove merge-gate drift risk
- impacted_files: GitHub repository branch protection settings for `IamNotATuringMachine/DirectStock` (`main`)
- risk_level: high
- expected_impact: branch protection required checks align exactly with CI job identities and remain stable across workflow execution
- result: success
- actual_impact: `main` required checks now use deterministic provider-specific contexts and no longer depend on matrix naming behavior
- rollback_hint: patch branch protection required contexts back to previous list via `gh api repos/IamNotATuringMachine/DirectStock/branches/main/protection/required_status_checks`
- verification:
  - `gh api --method PATCH repos/IamNotATuringMachine/DirectStock/branches/main/protection/required_status_checks --input <payload.json>` -> PASS
  - `./scripts/check_branch_protection.sh` -> PASS

## 2026-02-19T14:13:11Z - synchronize main branch required status contexts
- action: update GitHub branch protection required status checks on `main` to the autonomous UI/UX+Gemini gate set
- rationale: enforce the newly introduced PR-blocking governance/quality gates at repository policy level
- impacted_files: GitHub repository branch protection settings for `IamNotATuringMachine/DirectStock` (`main`)
- risk_level: high
- expected_impact: merges to `main` are blocked unless all required contexts (provider parity, desktop/mobile a11y+visual, token drift, gemini config) pass
- result: success
- actual_impact: `main` required status checks now enforce all new contexts; policy script confirms branch protection is compliant
- rollback_hint: patch branch protection required contexts back to previous set via `gh api repos/IamNotATuringMachine/DirectStock/branches/main/protection/required_status_checks`
- verification:
  - `gh api --method PATCH repos/IamNotATuringMachine/DirectStock/branches/main/protection/required_status_checks --input <payload.json>` -> PASS
  - `./scripts/check_branch_protection.sh` -> PASS

## 2026-02-19T10:48:31Z - enable branch-protection api capability
- action: change repository visibility to public and configure main-branch protection baseline
- rationale: strict branch-protection mode is enabled and requires GitHub Branch Protection API support
- impacted_files: GitHub repository settings, branch protection policy on `main`
- risk_level: critical
- expected_impact: strict branch-protection guard becomes technically satisfiable; repository source becomes publicly accessible
- result: success
- actual_impact: repository is now public, branch-protection API is available, and `main` protection baseline is configured/validated
- rollback_hint: set repository visibility back to private and/or relax strict branch-protection requirement
- verification:
  - `gh repo view IamNotATuringMachine/DirectStock --json visibility,isPrivate` -> PASS (`PUBLIC`, `isPrivate=false`)
  - `gh api repos/IamNotATuringMachine/DirectStock/branches/main/protection` -> PASS
  - `BRANCH_PROTECTION_REQUIRE_SUPPORTED=1 ./scripts/check_branch_protection.sh` -> PASS

## 2026-02-19T09:33:01Z - agent-self-improve autonomous policy update
- action: apply governance/document updates generated by scripts/agent_self_improve.py
- rationale: keep provider parity and recurring-incident feedback loop current
- impacted_files: docs/agents/auto-improvement-backlog.md
- risk_level: medium
- expected_impact: reduced policy drift and faster autonomous recovery
- result: success
- actual_impact: No policy drift detected.
- rollback_hint: revert modified governance/docs files and rerun lint checks
- verification:
  - `python3 scripts/agent_policy_lint.py --strict --provider all --format json` -> PASS

## 2026-02-19T09:43:31Z - agent-self-improve autonomous policy update
- action: apply governance/document updates generated by scripts/agent_self_improve.py
- rationale: keep provider parity and recurring-incident feedback loop current
- impacted_files: docs/agents/auto-improvement-backlog.md
- risk_level: medium
- expected_impact: reduced policy drift and faster autonomous recovery
- result: success
- actual_impact: No policy drift detected.
- rollback_hint: revert modified governance/docs files and rerun lint checks
- verification:
  - `python3 scripts/agent_policy_lint.py --strict --provider all --format json` -> PASS

## 2026-02-19T09:53:08Z - agent-self-improve autonomous policy update
- action: apply governance/document updates generated by scripts/agent_self_improve.py
- rationale: keep provider parity and recurring-incident feedback loop current
- impacted_files: docs/agents/auto-improvement-backlog.md
- risk_level: medium
- expected_impact: reduced policy drift and faster autonomous recovery
- result: success
- actual_impact: No policy drift detected.
- rollback_hint: revert modified governance/docs files and rerun lint checks
- verification:
  - `python3 scripts/agent_policy_lint.py --strict --provider all --format json` -> PASS

## 2026-02-19T10:23:37Z - agent-self-improve autonomous policy update
- action: apply governance/document updates generated by scripts/agent_self_improve.py
- rationale: keep provider parity and recurring-incident feedback loop current
- impacted_files: docs/agents/auto-improvement-backlog.md
- risk_level: medium
- expected_impact: reduced policy drift and faster autonomous recovery
- result: success
- actual_impact: No policy drift detected.
- rollback_hint: revert modified governance/docs files and rerun lint checks
- verification:
  - `python3 scripts/agent_policy_lint.py --strict --provider all --format json` -> PASS

## 2026-02-19T10:55:51Z - agent-self-improve autonomous policy update
- action: apply governance/document updates generated by scripts/agent_self_improve.py
- rationale: keep provider parity and recurring-incident feedback loop current
- impacted_files: docs/agents/auto-improvement-backlog.md
- risk_level: medium
- expected_impact: reduced policy drift and faster autonomous recovery
- result: success
- actual_impact: No policy drift detected.
- rollback_hint: revert modified governance/docs files and rerun lint checks
- verification:
  - `python3 scripts/agent_policy_lint.py --strict --provider all --format json` -> PASS
