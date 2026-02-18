# CI Duration Snapshot

Generated at: 2026-02-18T16:27:20Z

## Status

Blocked: GitHub Actions metadata query failed: couldn't fetch workflows for IamNotATuringMachine/DirectStock: HTTP 404: Not Found (https://api.github.com/repos/IamNotATuringMachine/DirectStock/actions/workflows?per_page=100&page=1)

## Next Step

1. Install/login GitHub CLI: `gh auth login`
2. Ensure repository access for: `IamNotATuringMachine/DirectStock`
3. Re-run: `CI_RUN_LIMIT=20 GH_REPO=<owner/repo> ./scripts/collect_ci_duration.sh`
