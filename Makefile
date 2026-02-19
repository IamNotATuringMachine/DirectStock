SHELL := /bin/bash

POLICY_PYTHON := $(if $(wildcard backend/.venv/bin/python),backend/.venv/bin/python,python3)

.PHONY: bootstrap-policy-deps agent-fast agent-full agent-governance agent-mcp

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
