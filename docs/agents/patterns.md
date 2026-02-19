# Agent Patterns — What Worked

> Living document. Agents add entries when they discover successful approaches for this project.
> Sorted by most recent first.

## Purpose
A knowledge base of "what worked" for DirectStock. Agents should consult this before starting complex tasks and add new entries when they discover useful patterns.

## Patterns

### P001: Frontend Page Modernization (2026-02-19)
- **Context**: Modernizing legacy pages to Phase 4 design
- **What worked**: Copy the layout structure from `InventoryCountPage.tsx` as a template, then adapt the data/columns. This ensures design consistency.
- **Key files**: `frontend/src/pages/InventoryCountPage.tsx`

### P002: Contract Sync After Schema Change (2026-02-19)
- **Context**: Adding fields to backend schemas
- **What worked**: Always update in this order: (1) backend model → (2) Alembic migration → (3) schema → (4) frontend `types.ts` → (5) frontend service → (6) UI. Running `./scripts/check_api_contract_drift.sh` after step 3 catches drift early.
- **Key files**: `backend/app/schemas/`, `frontend/src/types.ts`

### P003: Self-Improvement Cycle (2026-02-19)
- **Context**: Running governance checks and fixing drift
- **What worked**: Use the `.agents/workflows/self-improvement-run.md` workflow. Run `python3 scripts/agent_self_improve.py --mode check` first (non-destructive), then `--mode apply` only if changes are recommended.
- **Key files**: `scripts/agent_self_improve.py`, `docs/agents/auto-improvement-backlog.md`

---

*Add new patterns above this line. Use format: `### P00N: Title (date)` with Context, What worked, Key files.*
