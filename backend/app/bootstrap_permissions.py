from __future__ import annotations

from app.bootstrap_permissions_data import (
    PHASE5_DASHBOARD_CARDS,
    PHASE5_MODULE_PERMISSIONS,
    PHASE5_PAGES,
    PHASE5_ROLE_MODULE_PERMISSIONS,
    PHASE5_ROLE_PAGE_ACCESS,
)
from app.bootstrap_permissions_seed import _seed_phase5_rbac_and_dashboard

__all__ = [
    "PHASE5_PAGES",
    "PHASE5_MODULE_PERMISSIONS",
    "PHASE5_ROLE_MODULE_PERMISSIONS",
    "PHASE5_ROLE_PAGE_ACCESS",
    "PHASE5_DASHBOARD_CARDS",
    "_seed_phase5_rbac_and_dashboard",
]
