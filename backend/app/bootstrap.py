from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.models.auth import Role, User
from app.models.catalog import Product, ProductGroup, ProductWarehouseSetting
from app.models.inventory import Inventory, StockMovement
from app.models.warehouse import BinLocation, Warehouse, WarehouseZone
from app.utils.security import hash_password

DEFAULT_ROLES: list[tuple[str, str]] = [
    ("admin", "Administrator"),
    ("lagerleiter", "Lagerleiter"),
    ("lagermitarbeiter", "Lagermitarbeiter"),
    ("einkauf", "Einkauf"),
    ("versand", "Versand"),
    ("controller", "Controlling"),
    ("auditor", "Audit / Read-Only"),
]

DEFAULT_USERS = [
    {
        "username": "lagerleiter",
        "email": "lagerleiter@directstock.local",
        "full_name": "DirectStock Lagerleitung",
        "password": "Lagerleiter2026!",
        "roles": ["lagerleiter"],
    },
    {
        "username": "lagermitarbeiter",
        "email": "lagermitarbeiter@directstock.local",
        "full_name": "DirectStock Lagerteam",
        "password": "Lagermitarbeiter2026!",
        "roles": ["lagermitarbeiter"],
    },
]

MVP_PRODUCT_GROUPS: list[tuple[str, str]] = [
    ("Elektronik", "Elektronische Komponenten"),
    ("Verpackung", "Verpackungs- und Versandmaterial"),
    ("Betriebsmittel", "Werkzeuge und Hilfsmittel"),
    ("Ersatzteile", "Ersatz- und Verschleißteile"),
    ("Sicherheit", "Sicherheits- und Schutzmaterial"),
]

SEED_WAREHOUSE_CODE = "WH-MAIN"
SEED_ZONE_CONFIGS = {
    "INB": {"name": "Inbound", "zone_type": "inbound", "aisles": range(1, 6), "shelves": range(1, 3), "levels": range(1, 4)},
    "STO": {"name": "Storage", "zone_type": "storage", "aisles": range(1, 11), "shelves": range(1, 6), "levels": range(1, 3)},
    "OUT": {"name": "Outbound", "zone_type": "outbound", "aisles": range(1, 6), "shelves": range(1, 3), "levels": range(1, 3)},
}


def _expected_bin_codes(zone_code: str) -> list[str]:
    config = SEED_ZONE_CONFIGS[zone_code]
    return [
        f"{zone_code}-{aisle:02d}-{shelf:02d}-{level:02d}"
        for aisle in config["aisles"]
        for shelf in config["shelves"]
        for level in config["levels"]
    ]


async def _seed_roles(db: AsyncSession) -> dict[str, Role]:
    existing_roles = {
        role.name: role
        for role in (await db.execute(select(Role))).scalars()
    }

    for role_name, description in DEFAULT_ROLES:
        role = existing_roles.get(role_name)
        if role is None:
            role = Role(name=role_name, description=description)
            db.add(role)
            existing_roles[role_name] = role
        else:
            role.description = description

    await db.flush()
    return existing_roles


async def _seed_users(db: AsyncSession, role_map: dict[str, Role]) -> User:
    settings = get_settings()

    desired_users = [
        {
            "username": settings.default_admin_username,
            "email": settings.default_admin_email,
            "full_name": "DirectStock Administrator",
            "password": settings.default_admin_password,
            "roles": ["admin"],
        },
        *DEFAULT_USERS,
    ]

    usernames = [user["username"] for user in desired_users]
    existing_users = {
        user.username: user
        for user in (
            await db.execute(
                select(User)
                .where(User.username.in_(usernames))
                .options(selectinload(User.roles))
            )
        ).scalars()
    }

    admin_user: User | None = None

    for desired in desired_users:
        user = existing_users.get(desired["username"])
        if user is None:
            user = User(
                username=desired["username"],
                email=desired["email"],
                full_name=desired["full_name"],
                hashed_password=hash_password(desired["password"]),
                is_active=True,
            )
            db.add(user)
            existing_users[desired["username"]] = user

        user.email = desired["email"]
        user.full_name = desired["full_name"]
        user.is_active = True

        # Keep seeded credentials deterministic for local onboarding.
        user.hashed_password = hash_password(desired["password"])
        user.roles = [role_map[role_name] for role_name in desired["roles"]]

        if "admin" in desired["roles"]:
            admin_user = user

    await db.flush()

    if admin_user is None:
        raise RuntimeError("Admin user could not be seeded")
    return admin_user


async def _seed_warehouse_structure(db: AsyncSession) -> tuple[Warehouse, dict[str, WarehouseZone], list[BinLocation]]:
    warehouse = (
        await db.execute(select(Warehouse).where(Warehouse.code == SEED_WAREHOUSE_CODE))
    ).scalar_one_or_none()
    if warehouse is None:
        warehouse = Warehouse(
            code=SEED_WAREHOUSE_CODE,
            name="DirectStock Hauptlager",
            address="DirectStock Campus",
            is_active=True,
        )
        db.add(warehouse)
        await db.flush()
    else:
        warehouse.name = "DirectStock Hauptlager"
        warehouse.address = "DirectStock Campus"
        warehouse.is_active = True

    existing_zones = {
        zone.code: zone
        for zone in (
            await db.execute(
                select(WarehouseZone).where(WarehouseZone.warehouse_id == warehouse.id)
            )
        ).scalars()
    }

    zone_map: dict[str, WarehouseZone] = {}
    for code, config in SEED_ZONE_CONFIGS.items():
        zone = existing_zones.get(code)
        if zone is None:
            zone = WarehouseZone(
                warehouse_id=warehouse.id,
                code=code,
                name=config["name"],
                zone_type=config["zone_type"],
                is_active=True,
            )
            db.add(zone)
            await db.flush()
        else:
            zone.name = config["name"]
            zone.zone_type = config["zone_type"]
            zone.is_active = True
        zone_map[code] = zone

    storage_bins: list[BinLocation] = []

    for zone_code, zone in zone_map.items():
        existing_bins = {
            bin_location.code: bin_location
            for bin_location in (
                await db.execute(select(BinLocation).where(BinLocation.zone_id == zone.id))
            ).scalars()
        }

        expected_codes = _expected_bin_codes(zone_code)
        for code in expected_codes:
            bin_location = existing_bins.get(code)
            if bin_location is None:
                bin_location = BinLocation(
                    zone_id=zone.id,
                    code=code,
                    bin_type=SEED_ZONE_CONFIGS[zone_code]["zone_type"],
                    qr_code_data=f"DS:BIN:{code}",
                    is_active=True,
                )
                db.add(bin_location)
                existing_bins[code] = bin_location
            else:
                bin_location.bin_type = SEED_ZONE_CONFIGS[zone_code]["zone_type"]
                bin_location.qr_code_data = f"DS:BIN:{code}"
                bin_location.is_active = True

        await db.flush()

        if zone_code == "STO":
            storage_bins = sorted(existing_bins.values(), key=lambda item: item.code)

    return warehouse, zone_map, storage_bins


async def _seed_product_groups(db: AsyncSession) -> list[ProductGroup]:
    group_names = [name for name, _ in MVP_PRODUCT_GROUPS]
    existing_groups = {
        group.name: group
        for group in (
            await db.execute(select(ProductGroup).where(ProductGroup.name.in_(group_names)))
        ).scalars()
    }

    groups: list[ProductGroup] = []
    for name, description in MVP_PRODUCT_GROUPS:
        group = existing_groups.get(name)
        if group is None:
            group = ProductGroup(name=name, description=description, is_active=True)
            db.add(group)
        else:
            group.description = description
            group.is_active = True
        groups.append(group)

    await db.flush()
    return groups


async def _seed_products(db: AsyncSession, groups: list[ProductGroup]) -> list[Product]:
    product_numbers = [f"DS-ART-{index:04d}" for index in range(1, 51)]
    existing_products = {
        product.product_number: product
        for product in (
            await db.execute(select(Product).where(Product.product_number.in_(product_numbers)))
        ).scalars()
    }

    seeded_products: list[Product] = []
    for index, product_number in enumerate(product_numbers, start=1):
        group = groups[(index - 1) % len(groups)]
        name = f"DirectStock Artikel {index:04d}"
        description = f"Seed-Produkt {index:04d} für DirectStock Phase 1"

        product = existing_products.get(product_number)
        if product is None:
            product = Product(
                product_number=product_number,
                name=name,
                description=description,
                product_group_id=group.id,
                unit="piece",
                status="active",
            )
            db.add(product)
            existing_products[product_number] = product
        else:
            product.name = name
            product.description = description
            product.product_group_id = group.id
            product.unit = "piece"
            product.status = "active"

        seeded_products.append(product)

    await db.flush()
    return seeded_products


async def _seed_product_settings(
    db: AsyncSession,
    *,
    products: list[Product],
    warehouse: Warehouse,
) -> None:
    existing_settings = {
        setting.product_id: setting
        for setting in (
            await db.execute(
                select(ProductWarehouseSetting).where(ProductWarehouseSetting.warehouse_id == warehouse.id)
            )
        ).scalars()
    }

    for index, product in enumerate(products, start=1):
        setting = existing_settings.get(product.id)
        qr_value = f"DS:PRD:{warehouse.code}:{product.product_number}"
        ean_value = f"{4000000000000 + index:013d}"
        min_stock = Decimal("5") + Decimal(index % 7)
        reorder_point = min_stock + Decimal("4")
        max_stock = reorder_point + Decimal("15")

        if setting is None:
            setting = ProductWarehouseSetting(
                product_id=product.id,
                warehouse_id=warehouse.id,
                ean=ean_value,
                qr_code_data=qr_value,
                min_stock=min_stock,
                reorder_point=reorder_point,
                max_stock=max_stock,
                safety_stock=Decimal("2"),
                lead_time_days=3,
            )
            db.add(setting)
            existing_settings[product.id] = setting
        else:
            setting.ean = ean_value
            setting.qr_code_data = qr_value
            setting.min_stock = min_stock
            setting.reorder_point = reorder_point
            setting.max_stock = max_stock
            setting.safety_stock = Decimal("2")
            setting.lead_time_days = 3

    await db.flush()


async def _seed_initial_inventory_and_movements(
    db: AsyncSession,
    *,
    admin_user: User,
    products: list[Product],
    storage_bins: list[BinLocation],
    inventory_seed_size: int,
) -> None:
    seeded_products = products[: max(0, min(inventory_seed_size, len(products)))]
    if not seeded_products or not storage_bins:
        return

    product_ids = [product.id for product in seeded_products]
    existing_inventory = {
        (row.product_id, row.bin_location_id): row
        for row in (
            await db.execute(select(Inventory).where(Inventory.product_id.in_(product_ids)))
        ).scalars()
    }

    reference_numbers = [f"SEED-WE-{index:04d}" for index in range(1, len(seeded_products) + 1)]
    existing_references = {
        reference
        for reference in (
            await db.execute(
                select(StockMovement.reference_number).where(StockMovement.reference_number.in_(reference_numbers))
            )
        ).scalars()
        if reference
    }

    now = datetime.now(UTC)

    for index, product in enumerate(seeded_products, start=1):
        target_bin = storage_bins[(index - 1) % len(storage_bins)]
        quantity = Decimal(str(5 + index))
        reserved = Decimal("1") if index % 4 == 0 else Decimal("0")

        inventory = existing_inventory.get((product.id, target_bin.id))
        if inventory is None:
            inventory = Inventory(
                product_id=product.id,
                bin_location_id=target_bin.id,
                quantity=quantity,
                reserved_quantity=reserved,
                unit="piece",
            )
            db.add(inventory)
            existing_inventory[(product.id, target_bin.id)] = inventory
        else:
            inventory.quantity = quantity
            inventory.reserved_quantity = reserved
            inventory.unit = "piece"

        reference_number = f"SEED-WE-{index:04d}"
        if reference_number not in existing_references:
            db.add(
                StockMovement(
                    movement_type="goods_receipt",
                    reference_type="seed",
                    reference_number=reference_number,
                    product_id=product.id,
                    from_bin_id=None,
                    to_bin_id=target_bin.id,
                    quantity=quantity,
                    performed_by=admin_user.id,
                    performed_at=now,
                    metadata_json={
                        "seed": True,
                        "scope": "phase-1.11",
                        "product_number": product.product_number,
                    },
                )
            )


async def seed_mvp_data(
    db: AsyncSession,
    *,
    admin_user: User,
    inventory_seed_size: int = 20,
) -> None:
    warehouse, _zone_map, storage_bins = await _seed_warehouse_structure(db)
    groups = await _seed_product_groups(db)
    products = await _seed_products(db, groups)
    await _seed_product_settings(db, products=products, warehouse=warehouse)
    await _seed_initial_inventory_and_movements(
        db,
        admin_user=admin_user,
        products=products,
        storage_bins=storage_bins,
        inventory_seed_size=inventory_seed_size,
    )


async def seed_defaults(
    db: AsyncSession,
    *,
    include_mvp: bool = True,
    inventory_seed_size: int = 20,
) -> None:
    role_map = await _seed_roles(db)
    admin_user = await _seed_users(db, role_map)

    if include_mvp:
        await seed_mvp_data(db, admin_user=admin_user, inventory_seed_size=inventory_seed_size)

    await db.commit()
