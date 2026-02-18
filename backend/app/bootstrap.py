from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.bootstrap_permissions import (
    PHASE5_DASHBOARD_CARDS,
    PHASE5_MODULE_PERMISSIONS,
    PHASE5_PAGES,
    PHASE5_ROLE_MODULE_PERMISSIONS,
    PHASE5_ROLE_PAGE_ACCESS,
    _seed_phase5_rbac_and_dashboard,
)
from app.bootstrap_roles import DEFAULT_ROLES, DEFAULT_USERS, _seed_roles, _seed_users
from app.bootstrap_seed import (
    MVP_PRODUCT_GROUPS,
    SEED_WAREHOUSE_CODE,
    SEED_ZONE_CONFIGS,
    _expected_bin_codes,
    _seed_initial_inventory_and_movements,
    _seed_product_groups,
    _seed_product_settings,
    _seed_products,
    _seed_warehouse_structure,
    seed_mvp_data,
)


async def seed_defaults(
    db: AsyncSession,
    *,
    include_mvp: bool = True,
    inventory_seed_size: int = 20,
) -> None:
    role_map = await _seed_roles(db)
    await _seed_phase5_rbac_and_dashboard(db, role_map)
    admin_user = await _seed_users(db, role_map)

    if include_mvp:
        await seed_mvp_data(db, admin_user=admin_user, inventory_seed_size=inventory_seed_size)

    await db.commit()


__all__ = [
    "DEFAULT_ROLES",
    "DEFAULT_USERS",
    "MVP_PRODUCT_GROUPS",
    "SEED_WAREHOUSE_CODE",
    "SEED_ZONE_CONFIGS",
    "PHASE5_PAGES",
    "PHASE5_MODULE_PERMISSIONS",
    "PHASE5_ROLE_MODULE_PERMISSIONS",
    "PHASE5_ROLE_PAGE_ACCESS",
    "PHASE5_DASHBOARD_CARDS",
    "_expected_bin_codes",
    "_seed_roles",
    "_seed_users",
    "_seed_phase5_rbac_and_dashboard",
    "_seed_warehouse_structure",
    "_seed_product_groups",
    "_seed_products",
    "_seed_product_settings",
    "_seed_initial_inventory_and_movements",
    "seed_mvp_data",
    "seed_defaults",
]
