# MCP Readiness Snapshot

Generated at: 2026-02-19T20:56:11Z

## Summary

- Overall status: blocked
- Configuration source: .mcp.json
- Active profile: docs-research
- Config file: /Users/tobiasmorixbauer/.codex/config.toml
- Read-only DB enforcement: 1

## Server Checks

| Server | Configured | Probe Status | Notes |
| --- | --- | --- | --- |
| filesystem | yes | pass | startup probe ok; version=2026.1.14 |
| postgres | no | blocked | server not configured |
| github | yes | pass | startup probe ok; image=ghcr.io/github/github-mcp-server:v0.31.0; read_only=0; toolsets=all |
| playwright | no | blocked | server not configured |
| git | yes | pass | startup probe ok; version=2026.1.14 |
| memory | yes | pass | startup probe ok; version=2026.1.26 |
| openai-docs | yes | blocked | [61041] Using automatically selected callback port: 14571 [61041] Discovering OAuth server configuration... [61041] [61041] Connecting to remote server: https://mcp.openai.com/mcp ; endpoint=https://mcp.openai.com/mcp; remote=0.1.38; remote auth/network prerequisite missing |
| context7 | yes | pass | startup probe ok; version=2.1.1 |
| fetch | yes | pass | startup probe ok; version=2025.4.7 |

## Probe Semantics

- The probe verifies startup and runtime prerequisites.
- It does not execute business-side effects.
- PostgreSQL readiness fails when MCP role is not a read-only role (user suffix '_ro'), unless explicitly disabled.
- GitHub probe surfaces effective MCP hardening (image pin, read-only posture, toolsets).
- OpenAI docs probe validates startup against the configured MCP endpoint and pinned mcp-remote version.
- Context7 and fetch probes validate pinned runtime availability for framework and fallback docs retrieval.
