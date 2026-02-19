# DirectStock Antigravity Rules (Gemini UI/UX)

## Policy Priority
1. `AGENTS.md`
2. `docs/agents/providers/google.md`
3. `GEMINI.md`

## Mandatory UI/UX Workflow
For every frontend UI/UX change, run and report all gates:
1. `cd frontend && npm run test:e2e:visual -- --project=web-desktop`
2. `cd frontend && npm run test:e2e:a11y -- --project=web-desktop`
3. `cd frontend && npm run test:e2e:visual -- --project=ios-iphone-se --project=ios-ipad`
4. `cd frontend && npm run test:e2e:a11y -- --project=ios-iphone-se --project=ios-ipad`
5. `./scripts/check_design_token_drift.sh`

## Fallback Sequence
If MCP connectivity or external design tooling is unavailable:
1. Continue with local repository context from filesystem/git/github MCP servers.
2. Run the full local UI/UX gate stack (visual, a11y, token drift).
3. Document fallback reason and evidence in the task report.

## Required Completion Artifacts
Every UI/UX delivery report must include:
1. Executed commands and pass/fail result per gate.
2. Visual baseline scope (desktop/mobile routes covered).
3. Accessibility scope (desktop/mobile routes covered).
4. Token drift result.
5. Explicit fallback evidence when MCP/SaaS was unavailable.
