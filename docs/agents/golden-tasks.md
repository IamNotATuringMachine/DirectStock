# Golden Task Evaluation Suite

> Tasks agents must complete correctly to validate their workflow produces correct results.
> Run: `./scripts/run_golden_tasks.sh`

## Purpose
Golden tasks are regression tests for agent behavior. If an agent can complete these tasks correctly, it demonstrates understanding of the project's architecture, conventions, and governance.

## Task Categories

### T1: Backend — Add Read Endpoint
- **Input**: "Add a GET endpoint at `/api/health/detailed` that returns DB connection status"
- **Expected**: Router file created/modified, service function with DB ping, schema for response, test covering happy path
- **Validates**: Router → service pattern, schema usage, test coverage

### T2: Frontend — Add Table Column
- **Input**: "Add a 'Last Modified' column to the Products table"
- **Expected**: Column added with proper date formatting, responsive handling, data-testid attribute
- **Validates**: Service layer usage, design system compliance, testability

### T3: Cross-Stack — Schema Sync
- **Input**: "Add an `sku_prefix` field to the Product schema"
- **Expected**: Backend schema + model + migration + frontend type sync
- **Validates**: Contract synchronization between backend and frontend

### T4: Governance — Self-Check
- **Input**: "Run a governance check and fix any drift"
- **Expected**: All gates pass, repo-index updated if needed, no policy violations
- **Validates**: Governance workflow understanding

### T5: Refactor — Extract Service
- **Input**: "Extract the inventory calculation logic from the router into a dedicated service"
- **Expected**: Logic moved to service, router simplified, tests still pass, file sizes within limits
- **Validates**: Architecture pattern adherence, LOC limits

## Scoring
- Each task: PASS (meets all expected outcomes) or FAIL (misses any)
- Target: 5/5 PASS for a well-configured agent
