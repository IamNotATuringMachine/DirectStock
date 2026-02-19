# MCP Readiness Snapshot

Generated at: 2026-02-19T10:14:30Z

## Summary

- Overall status: ready
- Configuration source: .mcp.json
- Active profile: ci-readonly
- Config file: /Users/tobiasmorixbauer/.codex/config.toml
- Read-only DB enforcement: 1

## Server Checks

| Server | Configured | Probe Status | Notes |
| --- | --- | --- | --- |
| filesystem | yes | pass | startup probe ok |
| postgres | yes | pass | startup probe ok; readonly role suffix validated (directstock_ro); deep probe skipped (psql not found) |
| github | yes | pass | startup probe ok |
| playwright | yes | pass | startup probe ok |
| git | yes | pass | startup probe ok |

## Probe Semantics

- The probe verifies startup and runtime prerequisites.
- It does not execute business-side effects.
- PostgreSQL readiness fails when MCP role is not a read-only role (user suffix '_ro'), unless explicitly disabled.
