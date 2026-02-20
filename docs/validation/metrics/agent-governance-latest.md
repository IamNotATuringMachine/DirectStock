# Agent Governance Snapshot

Generated at: 2026-02-20T09:19:14Z

## Summary

- Debt detected: 1
- Findings: 3
- Required autonomy mode: unrestricted_senior

## Findings

- AGENTS.md does not reference branch protection validation.
- MCP profile parity check failed: {
  "valid": false,
  "strict": true,
  "findings": [
    ".mcp.json and .idx/mcp.json server sets differ: mcp_only=[], idx_only=['directstock-openai-docs']",
    ".mcp.json and .gemini/settings.json server sets differ: mcp_only=[], gemini_only=['directstock-openai-docs']",
    "profile mismatch for dev-autonomy: mcp={\"env\": {}, \"servers\": [\"directstock-context7\", \"directstock-fetch\", \"directstock-filesystem\", \"directstock-git\", \"directstock-github\", \"directstock-memory\", \"directstock-playwright\", \"directstock-postgres\"]} idx={\"env\": {}, \"servers\": [\"directstock-filesystem\", \"directstock-git\", \"directstock-github\", \"directstock-memory\", \"directstock-playwright\", \"directstock-postgres\"]}",
    "profile mismatch for docs-research: mcp={\"env\": {}, \"servers\": [\"directstock-context7\", \"directstock-fetch\", \"directstock-filesystem\", \"directstock-git\", \"directstock-github\", \"directstock-memory\"]} idx={\"env\": {}, \"servers\": [\"directstock-context7\", \"directstock-fetch\", \"directstock-filesystem\", \"directstock-git\", \"directstock-github\", \"directstock-memory\", \"directstock-openai-docs\"]}",
    "strict mode: directstock-openai-docs missing in .mcp.json.mcpServers"
  ]
}
- Repository index drift check failed: Repository index drift detected. Run: python3 scripts/generate_repo_index.py --write

## Recommended Rule/Process Updates

- Add scripts/check_branch_protection.sh validation guidance to AGENTS.md.
- Align .mcp.json, .idx/mcp.json and .gemini/settings.json server/profile parity.
- Run python3 scripts/generate_repo_index.py --write and commit docs/agents/repo-index.json.
