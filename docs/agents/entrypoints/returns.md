# Returns Entrypoint

## Core Paths
- Router package entry: `backend/app/routers/returns.py`
- Domain routers: `backend/app/routers/returns_common.py`, `backend/app/routers/returns_orders.py`, `backend/app/routers/returns_items.py`
- Services: `backend/app/services/returns/*`
- Frontend page: `frontend/src/pages/returns/*`

## Invariants
1. Return-order workflow transitions remain valid.
2. Permission guards required on protected paths.
3. Audit and idempotency protections preserved for mutations.

## Verification
- `cd backend && python -m pytest -q tests/test_inbound_returns_workflow_extensions.py`
- `./scripts/check_mutation_integrity.py`
