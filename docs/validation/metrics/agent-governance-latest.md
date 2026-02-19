# Agent Governance Snapshot

Generated at: 2026-02-19T16:24:03Z

## Summary

- Debt detected: 1
- Findings: 1
- Required autonomy mode: unrestricted_senior

## Findings

- MCP profile parity check failed: {
  "valid": false,
  "strict": true,
  "findings": [
    ".mcp.json and .idx/mcp.json server sets differ: mcp_only=['directstock-docker', 'directstock-fetch', 'directstock-sequential-thinking'], idx_only=[]",
    ".mcp.json and .gemini/settings.json server sets differ: mcp_only=['directstock-docker', 'directstock-fetch', 'directstock-sequential-thinking'], gemini_only=[]",
    ".mcp.json.profiles missing or invalid",
    ".mcp.json.profiles.dev-autonomy missing or invalid",
    ".mcp.json.profiles.triage-readonly missing or invalid",
    ".mcp.json.profiles.review-governance missing or invalid"
  ]
}

## Recommended Rule/Process Updates

- Align .mcp.json, .idx/mcp.json and .gemini/settings.json server/profile parity.
