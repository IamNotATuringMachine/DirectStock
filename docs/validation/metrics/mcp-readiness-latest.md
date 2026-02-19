# MCP Readiness Snapshot

Generated at: 2026-02-19T09:12:29Z

## Summary

- Overall status: ready
- Config file: /Users/tobiasmorixbauer/.codex/config.toml

## Server Checks

| Server | Configured | Probe Status | Notes |
| --- | --- | --- | --- |
| filesystem | yes | pass | startup probe ok |
| postgres | yes | pass | startup probe ok |
| github | yes | pass | startup probe ok |
| playwright | yes | pass | startup probe ok |
| git | yes | pass | startup probe ok |

## Probe Semantics

- The probe verifies startup (--help) and runtime prerequisites.
- It does not execute business-side effects.
