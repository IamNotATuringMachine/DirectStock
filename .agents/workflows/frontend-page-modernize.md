---
description: Frontend page modernization — audit, refactor, test, and baseline
---

# Frontend Page Modernization Workflow

// turbo-all

## Prerequisites
- Target page identified from `modern_frontend.md` or user request
- Design system tokens and patterns are understood from existing modern pages

## Steps

1. **Audit current page** — Check LOC, styling approach, and test coverage:
   ```bash
   wc -l frontend/src/pages/<PageName>/*.tsx
   ```

2. **Study reference page** — Read a modern page for pattern reference:
   - Good references: `InventoryCountPage.tsx`, `GoodsReceiptPage.tsx`
   - Check Tailwind CSS classes, Zinc palette, responsive patterns

3. **Refactor page** — Apply Phase 4/5 design standards:
   - Use Tailwind CSS utility classes and Zinc color palette
   - Responsive grid layout with proper breakpoints
   - Typography: consistent sizing, weights, and colors
   - Interactive elements: hover states, transitions
   - Text overflow prevention with `truncate` / `line-clamp`
   - Keep page < 350 LOC, extract complex logic to hooks

4. **Update data-testid coverage**:
   - Ensure critical interactive elements have `data-testid` attributes
   - Follow naming pattern: `<page>-<element>-<action>`

5. **Run frontend tests**:
   ```bash
   cd frontend && npm run test
   cd frontend && npm run build
   ```

6. **Run E2E smoke tests**:
   ```bash
   cd frontend && npm run test:e2e:smoke
   ```

7. **Update visual baselines** (if visual tests exist):
   ```bash
   cd frontend && npm run test:e2e:visual:update
   cd frontend && npm run test:e2e:visual:update:mobile
   ```

8. **Run accessibility check**:
   ```bash
   cd frontend && npm run test:e2e:a11y -- --project=web-desktop
   cd frontend && npm run test:e2e:a11y:mobile
   ```

9. **Check design token drift**:
   ```bash
   ./scripts/check_design_token_drift.sh
   ```

10. **Mark page as modernized** in `modern_frontend.md`

## Completion Criteria
- Page uses Phase 4/5 design standards
- Page < 350 LOC
- All tests pass (unit, E2E, a11y, visual)
- Baselines updated
- `modern_frontend.md` updated
