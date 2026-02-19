from decimal import Decimal

from sqlalchemy import func, literal, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.models.catalog import Product, ProductWarehouseSetting
from app.models.inventory import Inventory, StockMovement
from app.models.warehouse import BinLocation, Warehouse, WarehouseZone
from app.schemas.inventory import (
    InventoryByBinItem,
    InventoryByProductItem,
    InventoryItem,
    InventoryListResponse,
    InventorySummary,
    LowStockItem,
    StockMovementItem,
)


async def list_inventory_data(
    *,
    db: AsyncSession,
    page: int,
    page_size: int,
    search: str | None,
    warehouse_id: int | None,
) -> InventoryListResponse:
    filters = []
    if search:
        term = f"%{search.strip()}%"
        filters.append(or_(Product.product_number.ilike(term), Product.name.ilike(term)))
    if warehouse_id is not None:
        filters.append(WarehouseZone.warehouse_id == warehouse_id)

    base_stmt = (
        select(
            Product.id.label("product_id"),
            Product.product_number.label("product_number"),
            Product.name.label("product_name"),
            func.sum(Inventory.quantity).label("total_quantity"),
            func.sum(Inventory.reserved_quantity).label("reserved_quantity"),
            func.min(Inventory.unit).label("unit"),
        )
        .join(Inventory, Inventory.product_id == Product.id)
        .join(BinLocation, BinLocation.id == Inventory.bin_location_id)
        .join(WarehouseZone, WarehouseZone.id == BinLocation.zone_id)
    )

    if filters:
        base_stmt = base_stmt.where(*filters)

    base_stmt = base_stmt.group_by(Product.id, Product.product_number, Product.name)

    total = (await db.execute(select(func.count()).select_from(base_stmt.subquery()))).scalar_one()

    rows = (
        await db.execute(
            base_stmt
            .order_by(Product.product_number.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()

    items = [
        InventoryItem(
            product_id=row.product_id,
            product_number=row.product_number,
            product_name=row.product_name,
            total_quantity=row.total_quantity,
            reserved_quantity=row.reserved_quantity,
            available_quantity=row.total_quantity - row.reserved_quantity,
            unit=row.unit,
        )
        for row in rows
    ]

    return InventoryListResponse(items=items, total=total, page=page, page_size=page_size)


async def inventory_by_product_data(*, db: AsyncSession, product_id: int) -> list[InventoryByProductItem]:
    rows = (
        await db.execute(
            select(
                Inventory.id.label("inventory_id"),
                Warehouse.id.label("warehouse_id"),
                Warehouse.code.label("warehouse_code"),
                WarehouseZone.id.label("zone_id"),
                WarehouseZone.code.label("zone_code"),
                BinLocation.id.label("bin_id"),
                BinLocation.code.label("bin_code"),
                Inventory.quantity.label("quantity"),
                Inventory.reserved_quantity.label("reserved_quantity"),
                Inventory.unit.label("unit"),
            )
            .join(BinLocation, BinLocation.id == Inventory.bin_location_id)
            .join(WarehouseZone, WarehouseZone.id == BinLocation.zone_id)
            .join(Warehouse, Warehouse.id == WarehouseZone.warehouse_id)
            .where(Inventory.product_id == product_id)
            .order_by(Warehouse.code.asc(), WarehouseZone.code.asc(), BinLocation.code.asc())
        )
    ).all()

    return [
        InventoryByProductItem(
            inventory_id=row.inventory_id,
            warehouse_id=row.warehouse_id,
            warehouse_code=row.warehouse_code,
            zone_id=row.zone_id,
            zone_code=row.zone_code,
            bin_id=row.bin_id,
            bin_code=row.bin_code,
            quantity=row.quantity,
            reserved_quantity=row.reserved_quantity,
            available_quantity=row.quantity - row.reserved_quantity,
            unit=row.unit,
        )
        for row in rows
    ]


async def inventory_by_bin_data(*, db: AsyncSession, bin_id: int) -> list[InventoryByBinItem]:
    rows = (
        await db.execute(
            select(
                Inventory.id.label("inventory_id"),
                Product.id.label("product_id"),
                Product.product_number.label("product_number"),
                Product.name.label("product_name"),
                Inventory.quantity.label("quantity"),
                Inventory.reserved_quantity.label("reserved_quantity"),
                Inventory.unit.label("unit"),
            )
            .join(Product, Product.id == Inventory.product_id)
            .where(Inventory.bin_location_id == bin_id)
            .order_by(Product.product_number.asc())
        )
    ).all()

    return [
        InventoryByBinItem(
            inventory_id=row.inventory_id,
            product_id=row.product_id,
            product_number=row.product_number,
            product_name=row.product_name,
            quantity=row.quantity,
            reserved_quantity=row.reserved_quantity,
            available_quantity=row.quantity - row.reserved_quantity,
            unit=row.unit,
        )
        for row in rows
    ]


async def inventory_by_warehouse_data(*, db: AsyncSession, warehouse_id: int) -> list[InventoryItem]:
    rows = (
        await db.execute(
            select(
                Product.id.label("product_id"),
                Product.product_number.label("product_number"),
                Product.name.label("product_name"),
                func.sum(Inventory.quantity).label("total_quantity"),
                func.sum(Inventory.reserved_quantity).label("reserved_quantity"),
                func.min(Inventory.unit).label("unit"),
            )
            .join(Inventory, Inventory.product_id == Product.id)
            .join(BinLocation, BinLocation.id == Inventory.bin_location_id)
            .join(WarehouseZone, WarehouseZone.id == BinLocation.zone_id)
            .where(WarehouseZone.warehouse_id == warehouse_id)
            .group_by(Product.id, Product.product_number, Product.name)
            .order_by(Product.product_number.asc())
        )
    ).all()

    return [
        InventoryItem(
            product_id=row.product_id,
            product_number=row.product_number,
            product_name=row.product_name,
            total_quantity=row.total_quantity,
            reserved_quantity=row.reserved_quantity,
            available_quantity=row.total_quantity - row.reserved_quantity,
            unit=row.unit,
        )
        for row in rows
    ]


async def low_stock_data(*, db: AsyncSession) -> list[LowStockItem]:
    stock_sub = (
        select(
            Inventory.product_id.label("product_id"),
            WarehouseZone.warehouse_id.label("warehouse_id"),
            func.sum(Inventory.quantity).label("on_hand"),
        )
        .join(BinLocation, BinLocation.id == Inventory.bin_location_id)
        .join(WarehouseZone, WarehouseZone.id == BinLocation.zone_id)
        .group_by(Inventory.product_id, WarehouseZone.warehouse_id)
        .subquery()
    )

    threshold_expr = func.coalesce(ProductWarehouseSetting.reorder_point, ProductWarehouseSetting.min_stock)
    on_hand_expr = func.coalesce(stock_sub.c.on_hand, literal(0))

    rows = (
        await db.execute(
            select(
                Product.id.label("product_id"),
                Product.product_number.label("product_number"),
                Product.name.label("product_name"),
                Warehouse.id.label("warehouse_id"),
                Warehouse.code.label("warehouse_code"),
                on_hand_expr.label("on_hand"),
                threshold_expr.label("threshold"),
            )
            .join(Product, Product.id == ProductWarehouseSetting.product_id)
            .join(Warehouse, Warehouse.id == ProductWarehouseSetting.warehouse_id)
            .outerjoin(
                stock_sub,
                (stock_sub.c.product_id == ProductWarehouseSetting.product_id)
                & (stock_sub.c.warehouse_id == ProductWarehouseSetting.warehouse_id),
            )
            .where(threshold_expr.is_not(None))
            .where(on_hand_expr < threshold_expr)
            .order_by(Warehouse.code.asc(), Product.product_number.asc())
        )
    ).all()

    return [
        LowStockItem(
            product_id=row.product_id,
            product_number=row.product_number,
            product_name=row.product_name,
            warehouse_id=row.warehouse_id,
            warehouse_code=row.warehouse_code,
            on_hand=row.on_hand,
            threshold=row.threshold,
        )
        for row in rows
    ]


async def list_movements_data(
    *,
    db: AsyncSession,
    limit: int,
    product_id: int | None,
) -> list[StockMovementItem]:
    from_bin = aliased(BinLocation)
    to_bin = aliased(BinLocation)

    stmt = (
        select(
            StockMovement.id,
            StockMovement.movement_type,
            StockMovement.reference_type,
            StockMovement.reference_number,
            StockMovement.product_id,
            Product.product_number,
            Product.name.label("product_name"),
            from_bin.code.label("from_bin_code"),
            to_bin.code.label("to_bin_code"),
            StockMovement.quantity,
            StockMovement.performed_at,
        )
        .join(Product, Product.id == StockMovement.product_id)
        .outerjoin(from_bin, from_bin.id == StockMovement.from_bin_id)
        .outerjoin(to_bin, to_bin.id == StockMovement.to_bin_id)
    )
    if product_id is not None:
        stmt = stmt.where(StockMovement.product_id == product_id)

    rows = (
        await db.execute(
            stmt.order_by(StockMovement.performed_at.desc(), StockMovement.id.desc()).limit(limit)
        )
    ).all()

    return [
        StockMovementItem(
            id=row.id,
            movement_type=row.movement_type,
            reference_type=row.reference_type,
            reference_number=row.reference_number,
            product_id=row.product_id,
            product_number=row.product_number,
            product_name=row.product_name,
            from_bin_code=row.from_bin_code,
            to_bin_code=row.to_bin_code,
            quantity=row.quantity,
            performed_at=row.performed_at,
        )
        for row in rows
    ]


async def inventory_summary_data(*, db: AsyncSession) -> InventorySummary:
    totals = (
        await db.execute(
            select(
                func.coalesce(func.sum(Inventory.quantity), 0).label("total_quantity"),
                func.coalesce(func.sum(Inventory.reserved_quantity), 0).label("reserved_quantity"),
            )
        )
    ).one()

    products_with_stock = (
        await db.execute(
            select(func.count())
            .select_from(
                select(Inventory.product_id)
                .group_by(Inventory.product_id)
                .having(func.sum(Inventory.quantity) > 0)
                .subquery()
            )
        )
    ).scalar_one()

    low_stock_count = len(await low_stock_data(db=db))

    total_quantity = totals.total_quantity if totals.total_quantity is not None else Decimal(0)
    reserved_quantity = totals.reserved_quantity if totals.reserved_quantity is not None else Decimal(0)

    return InventorySummary(
        total_products_with_stock=products_with_stock,
        total_quantity=total_quantity,
        reserved_quantity=reserved_quantity,
        available_quantity=total_quantity - reserved_quantity,
        low_stock_count=low_stock_count,
    )
