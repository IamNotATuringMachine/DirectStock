from __future__ import annotations

from sqlalchemy import delete, insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.bootstrap_permissions_data import (
    PHASE5_DASHBOARD_CARDS,
    PHASE5_MODULE_PERMISSIONS,
    PHASE5_PAGES,
    PHASE5_ROLE_MODULE_PERMISSIONS,
    PHASE5_ROLE_PAGE_ACCESS,
)
from app.models.auth import Permission, Role, role_permissions
from app.models.phase5 import AppPage, DashboardCard, RoleDashboardPolicy


async def _seed_phase5_rbac_and_dashboard(db: AsyncSession, role_map: dict[str, Role]) -> None:
    existing_permissions = {
        permission.code: permission for permission in (await db.execute(select(Permission))).scalars()
    }
    existing_pages = {page.slug: page for page in (await db.execute(select(AppPage))).scalars()}
    existing_cards = {card.card_key: card for card in (await db.execute(select(DashboardCard))).scalars()}

    permissions: list[tuple[str, str]] = [
        *[(f"page.{slug}.view", f"View access for page '{slug}'") for slug, _, _ in PHASE5_PAGES],
        *PHASE5_MODULE_PERMISSIONS,
    ]

    for code, description in permissions:
        permission = existing_permissions.get(code)
        if permission is None:
            permission = Permission(code=code, description=description)
            db.add(permission)
            existing_permissions[code] = permission
        else:
            permission.description = description

    for slug, title, description in PHASE5_PAGES:
        page = existing_pages.get(slug)
        if page is None:
            page = AppPage(slug=slug, title=title, description=description)
            db.add(page)
            existing_pages[slug] = page
        else:
            page.title = title
            page.description = description

    await db.flush()

    all_permission_codes = set(existing_permissions.keys())
    for role_name, role in role_map.items():
        modules = PHASE5_ROLE_MODULE_PERMISSIONS.get(role_name, set())
        pages = PHASE5_ROLE_PAGE_ACCESS.get(role_name, set())

        desired_codes: set[str]
        if "*" in modules:
            desired_codes = set(all_permission_codes)
        else:
            desired_codes = set(modules)
            desired_codes.update({f"page.{slug}.view" for slug in pages})

        desired_permission_ids = [
            existing_permissions[code].id for code in sorted(desired_codes) if code in existing_permissions
        ]
        await db.execute(delete(role_permissions).where(role_permissions.c.role_id == role.id))
        if desired_permission_ids:
            await db.execute(
                insert(role_permissions),
                [{"role_id": role.id, "permission_id": permission_id} for permission_id in desired_permission_ids],
            )

    for card_key, title, description, default_order in PHASE5_DASHBOARD_CARDS:
        card = existing_cards.get(card_key)
        if card is None:
            card = DashboardCard(
                card_key=card_key,
                title=title,
                description=description,
                default_order=default_order,
                is_active=True,
            )
            db.add(card)
            existing_cards[card_key] = card
        else:
            card.title = title
            card.description = description
            card.default_order = default_order
            card.is_active = True

    await db.flush()

    existing_policies = {
        (policy.role_id, policy.card_key): policy
        for policy in (await db.execute(select(RoleDashboardPolicy))).scalars()
    }
    for role in role_map.values():
        for card_key, _, _, _ in PHASE5_DASHBOARD_CARDS:
            key = (role.id, card_key)
            policy = existing_policies.get(key)
            if policy is None:
                policy = RoleDashboardPolicy(
                    role_id=role.id,
                    card_key=card_key,
                    allowed=True,
                    default_visible=True,
                    locked=False,
                )
                db.add(policy)
            else:
                policy.allowed = True
                policy.default_visible = True
                policy.locked = False
