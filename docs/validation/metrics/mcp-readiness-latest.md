# MCP Readiness Snapshot

Generated at: 2026-02-19T07:34:59Z

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

## Probe Semantics

- The probe verifies startup (--help) and runtime prerequisites.
- It does not execute business-side effects.
