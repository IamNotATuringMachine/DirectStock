from __future__ import annotations

from pathlib import Path

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm import selectinload

from app.bootstrap import seed_defaults
from app.models import Base
from app.models.auth import Permission, Role, User
from app.models.catalog import Product, ProductGroup, ProductWarehouseSetting
from app.models.inventory import Inventory, StockMovement
from app.models.warehouse import BinLocation, Warehouse, WarehouseZone


async def _count(session, model) -> int:
    return int((await session.execute(select(func.count()).select_from(model))).scalar_one())


async def _duplicate_count(session, stmt) -> int:
    return len((await session.execute(stmt)).all())


@pytest.mark.asyncio
async def test_seed_defaults_is_idempotent(tmp_path: Path):
    db_path = tmp_path / "seed_idempotent.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}", future=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    async with session_factory() as session:
        await seed_defaults(session, include_mvp=True, inventory_seed_size=20)

    async with session_factory() as session:
        first_counts = {
            "users": await _count(session, User),
            "warehouses": await _count(session, Warehouse),
            "zones": await _count(session, WarehouseZone),
            "bins": await _count(session, BinLocation),
            "groups": await _count(session, ProductGroup),
            "products": await _count(session, Product),
            "product_settings": await _count(session, ProductWarehouseSetting),
            "inventory": await _count(session, Inventory),
            "movements": await _count(session, StockMovement),
        }

    async with session_factory() as session:
        await seed_defaults(session, include_mvp=True, inventory_seed_size=20)

    async with session_factory() as session:
        second_counts = {
            "users": await _count(session, User),
            "warehouses": await _count(session, Warehouse),
            "zones": await _count(session, WarehouseZone),
            "bins": await _count(session, BinLocation),
            "groups": await _count(session, ProductGroup),
            "products": await _count(session, Product),
            "product_settings": await _count(session, ProductWarehouseSetting),
            "inventory": await _count(session, Inventory),
            "movements": await _count(session, StockMovement),
        }

        assert first_counts == second_counts
        assert second_counts == {
            "users": 3,
            "warehouses": 1,
            "zones": 3,
            "bins": 150,
            "groups": 5,
            "products": 50,
            "product_settings": 50,
            "inventory": 20,
            "movements": 20,
        }

        duplicate_usernames = await _duplicate_count(
            session,
            select(User.username, func.count()).group_by(User.username).having(func.count() > 1),
        )
        duplicate_product_numbers = await _duplicate_count(
            session,
            select(Product.product_number, func.count()).group_by(Product.product_number).having(func.count() > 1),
        )
        duplicate_warehouse_codes = await _duplicate_count(
            session,
            select(Warehouse.code, func.count()).group_by(Warehouse.code).having(func.count() > 1),
        )
        duplicate_group_names = await _duplicate_count(
            session,
            select(ProductGroup.name, func.count()).group_by(ProductGroup.name).having(func.count() > 1),
        )
        duplicate_bins = await _duplicate_count(
            session,
            select(BinLocation.zone_id, BinLocation.code, func.count())
            .group_by(BinLocation.zone_id, BinLocation.code)
            .having(func.count() > 1),
        )

        assert duplicate_usernames == 0
        assert duplicate_product_numbers == 0
        assert duplicate_warehouse_codes == 0
        assert duplicate_group_names == 0
        assert duplicate_bins == 0

    await engine.dispose()


@pytest.mark.asyncio
async def test_seeded_roles_include_wave1_module_permissions(tmp_path: Path):
    db_path = tmp_path / "seed_rbac_permissions.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}", future=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    async with session_factory() as session:
        await seed_defaults(session, include_mvp=False, inventory_seed_size=0)

    async with session_factory() as session:
        roles = list((await session.execute(select(Role).options(selectinload(Role.permissions)))).scalars())
        permissions = list((await session.execute(select(Permission))).scalars())
        permission_by_id = {permission.id: permission.code for permission in permissions}
        permission_codes = {permission.code for permission in permissions}

        role_permissions = {
            role.name: {permission_by_id.get(permission.id, "") for permission in role.permissions} for role in roles
        }

        assert "module.reports.read" in role_permissions["lagerleiter"]
        assert "module.operations.goods_issues.write" in role_permissions["lagerleiter"]
        assert "module.operations.stock_transfers.write" in role_permissions["lagerleiter"]
        assert "module.operations.goods_issues.write" in role_permissions["lagermitarbeiter"]
        assert "module.operations.stock_transfers.write" in role_permissions["lagermitarbeiter"]
        assert "module.reports.read" in role_permissions["controller"]
        assert "module.returns.read" in role_permissions["controller"]
        assert "module.reports.read" in role_permissions["auditor"]
        assert "module.returns.read" in role_permissions["auditor"]
        assert "module.purchasing.write" in role_permissions["einkauf"]
        assert "module.shipping.write" in role_permissions["versand"]
        assert "module.inventory_counts.cancel" in role_permissions["lagerleiter"]
        assert "module.inventory_counts.write" in role_permissions["lagermitarbeiter"]
        assert "module.alerts.write" in role_permissions["einkauf"]
        assert "module.alerts.write" in role_permissions["controller"]
        assert "module.alerts.read" in role_permissions["versand"]
        assert "module.picking.write" in role_permissions["versand"]
        assert "module.picking.read" in role_permissions["auditor"]
        assert "module.approval_rules.read" in role_permissions["controller"]
        assert "module.approval_rules.read" in role_permissions["auditor"]
        assert "module.approval_rules.write" in role_permissions["lagerleiter"]
        assert "module.approvals.read" in role_permissions["auditor"]
        assert "module.approvals.write" in role_permissions["versand"]
        assert "module.approvals.write" in role_permissions["einkauf"]
        assert "module.inter_warehouse_transfers.read" in role_permissions["auditor"]
        assert "module.inter_warehouse_transfers.write" in role_permissions["lagermitarbeiter"]
        assert "module.purchase_recommendations.read" in role_permissions["controller"]
        assert "module.purchase_recommendations.read" in role_permissions["auditor"]
        assert "module.purchase_recommendations.write" in role_permissions["einkauf"]
        assert "module.product_settings.read" in role_permissions["einkauf"]
        assert "module.product_settings.write" in role_permissions["einkauf"]
        assert "module.abc.read" in role_permissions["controller"]
        assert "module.abc.read" in role_permissions["auditor"]
        assert "module.abc.write" in role_permissions["einkauf"]
        assert "module.audit_log.read" in role_permissions["controller"]
        assert "module.audit_log.read" in role_permissions["auditor"]

        expected_codes = {
            "module.inventory_counts.cancel",
            "module.approval_rules.read",
            "module.approval_rules.write",
            "module.approvals.read",
            "module.approvals.write",
            "module.inter_warehouse_transfers.read",
            "module.inter_warehouse_transfers.write",
            "module.purchase_recommendations.read",
            "module.purchase_recommendations.write",
            "module.product_settings.read",
            "module.product_settings.write",
            "module.abc.read",
            "module.abc.write",
            "module.audit_log.read",
        }
        assert expected_codes.issubset(permission_codes)

    await engine.dispose()
