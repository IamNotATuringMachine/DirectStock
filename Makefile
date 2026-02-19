SHELL := /bin/bash

POLICY_PYTHON := $(if $(wildcard backend/.venv/bin/python),backend/.venv/bin/python,python3)

.PHONY: bootstrap-policy-deps agent-fast agent-full agent-governance agent-mcp agent-gemini-readiness agent-gemini-readiness-static agent-gemini-readiness-runtime agent-gemini-readiness-runtime-strict agent-uiux-gates

bootstrap-policy-deps:
	@echo "==> Installing governance lint dependencies"
	@$(POLICY_PYTHON) -m pip install --upgrade jsonschema

agent-fast:
	@echo "==> Running fast autonomous baseline"
	@RUN_AGENT_GOVERNANCE=1 RUN_MCP_READINESS=1 ./scripts/autonomous_task_harness.sh

agent-full:
	@echo "==> Running full autonomous baseline"
	@RUN_E2E_SMOKE=1 RUN_AGENT_GOVERNANCE=1 RUN_MCP_READINESS=1 RUN_GOLDEN_TASKS=1 COLLECT_SCORECARD_METRICS=1 ./scripts/autonomous_task_harness.sh

agent-governance: bootstrap-policy-deps
	@echo "==> Running governance and provider parity checks"
	@./scripts/agent_governance_check.sh
	@$(POLICY_PYTHON) scripts/agent_policy_lint.py --strict --provider all --format json
	@$(POLICY_PYTHON) scripts/check_provider_capabilities.py --strict --provider all --format json

agent-mcp:
	@echo "==> Configuring MCP servers across CLIs"
	@./scripts/setup_mcp_multi_cli.sh
	@MCP_PROFILE=dev-autonomy MCP_PROBE_ALLOW_BLOCKED=1 ./scripts/check_mcp_readiness.sh

agent-gemini-readiness:
	@echo "==> Validating Gemini CLI + MCP readiness"
	@./scripts/check_gemini_readiness.sh --mode runtime

agent-gemini-readiness-static:
	@echo "==> Validating Gemini config parity (static mode)"
	@./scripts/check_gemini_readiness.sh --mode static
	@python3 scripts/check_mcp_profile_parity.py --strict --format json

agent-gemini-readiness-runtime:
	@echo "==> Validating Gemini runtime readiness"
	@./scripts/check_gemini_readiness.sh --mode runtime

agent-gemini-readiness-runtime-strict:
	@echo "==> Validating Gemini runtime readiness (strict allowlist)"
	@./scripts/check_gemini_readiness.sh --mode runtime --enforce-allowlist

agent-uiux-gates:
	@echo "==> Running UI/UX gates (desktop + mobile)"
	@cd frontend && npm run test:e2e:a11y -- --project=web-desktop
	@cd frontend && npm run test:e2e:visual -- --project=web-desktop
	@cd frontend && npm run test:e2e:a11y -- --project=ios-iphone-se --project=ios-ipad
	@cd frontend && npm run test:e2e:visual -- --project=ios-iphone-se --project=ios-ipad
	@./scripts/check_design_token_drift.sh
