---
name: Frontend Page
description: Create or modernize a frontend page with Phase 4+ design standards
---

# Frontend Page Skill

## When to Use
When creating a new frontend page or modernizing an existing one.

## Steps

1. **Check design system** — Review existing modernized pages for patterns (e.g., `InventoryCountPage.tsx`)
2. **Create/update page** in `frontend/src/pages/` — use Tailwind 4 + Zinc palette
3. **Add service layer** in `frontend/src/services/` if new API calls needed
4. **Update routing** in `frontend/src/routing/` if new page
5. **Add data-testid** attributes for critical interactive elements
6. **Run validation**:
   ```bash
   cd frontend && npm run test
   cd frontend && npm run build
   cd frontend && npm run knip
   ```

## Design Standards
- Use Tailwind CSS utility classes with Zinc color palette
- Responsive grid layout (mobile-first)
- Consistent typography and spacing with other modernized pages
- Text overflow prevention on all data cells
- Dark mode support via CSS variables

## Invariants
- Network calls originate from service layer modules only
- Permission-gated routing consistent with backend permissions
- Page containers < 350 LOC — extract components if larger
- Stable `data-testid` coverage for critical flows

## Anti-Patterns
- Do NOT use inline fetch/axios — use service layer
- Do NOT hardcode colors — use design tokens / Tailwind classes
- Do NOT skip data-testid on interactive elements
