from datetime import UTC, datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, literal, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.dependencies import get_current_user, get_db
from app.models.catalog import Product, ProductWarehouseSetting
from app.models.inventory import GoodsIssue, GoodsReceipt, Inventory, StockMovement, StockTransfer
from app.models.warehouse import BinLocation, Warehouse, WarehouseZone
from app.schemas.dashboard import (
    DashboardActivityToday,
    DashboardLowStock,
    DashboardRecentMovements,
    DashboardSummary,
)
from app.schemas.inventory import LowStockItem, StockMovementItem

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


async def _load_low_stock(db: AsyncSession) -> list[LowStockItem]:
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


@router.get("/summary", response_model=DashboardSummary)
async def summary(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
) -> DashboardSummary:
    total_products = (await db.execute(select(func.count(Product.id)))).scalar_one()
    total_warehouses = (await db.execute(select(func.count(Warehouse.id)))).scalar_one()
    total_bins = (await db.execute(select(func.count(BinLocation.id)))).scalar_one()

    total_quantity = (
        await db.execute(select(func.coalesce(func.sum(Inventory.quantity), 0)))
    ).scalar_one()

    open_goods_receipts = (
        await db.execute(select(func.count(GoodsReceipt.id)).where(GoodsReceipt.status == "draft"))
    ).scalar_one()
    open_goods_issues = (
        await db.execute(select(func.count(GoodsIssue.id)).where(GoodsIssue.status == "draft"))
    ).scalar_one()
    open_stock_transfers = (
        await db.execute(select(func.count(StockTransfer.id)).where(StockTransfer.status == "draft"))
    ).scalar_one()

    low_stock_items = await _load_low_stock(db)

    return DashboardSummary(
        total_products=total_products,
        total_warehouses=total_warehouses,
        total_bins=total_bins,
        total_quantity=Decimal(total_quantity),
        low_stock_count=len(low_stock_items),
        open_goods_receipts=open_goods_receipts,
        open_goods_issues=open_goods_issues,
        open_stock_transfers=open_stock_transfers,
    )


@router.get("/recent-movements", response_model=DashboardRecentMovements)
async def recent_movements(
    limit: int = Query(default=15, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
) -> DashboardRecentMovements:
    from_bin = aliased(BinLocation)
    to_bin = aliased(BinLocation)

    rows = (
        await db.execute(
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
            .order_by(StockMovement.performed_at.desc(), StockMovement.id.desc())
            .limit(limit)
        )
    ).all()

    return DashboardRecentMovements(
        items=[
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
    )


@router.get("/low-stock", response_model=DashboardLowStock)
async def low_stock(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
) -> DashboardLowStock:
    return DashboardLowStock(items=await _load_low_stock(db))


@router.get("/activity-today", response_model=DashboardActivityToday)
async def activity_today(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
) -> DashboardActivityToday:
    now = datetime.now(UTC)
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = day_start + timedelta(days=1)

    movements_today = (
        await db.execute(
            select(func.count(StockMovement.id)).where(
                StockMovement.performed_at >= day_start,
                StockMovement.performed_at < day_end,
            )
        )
    ).scalar_one()

    completed_goods_receipts_today = (
        await db.execute(
            select(func.count(GoodsReceipt.id)).where(
                GoodsReceipt.completed_at.is_not(None),
                GoodsReceipt.completed_at >= day_start,
                GoodsReceipt.completed_at < day_end,
            )
        )
    ).scalar_one()

    completed_goods_issues_today = (
        await db.execute(
            select(func.count(GoodsIssue.id)).where(
                GoodsIssue.completed_at.is_not(None),
                GoodsIssue.completed_at >= day_start,
                GoodsIssue.completed_at < day_end,
            )
        )
    ).scalar_one()

    completed_stock_transfers_today = (
        await db.execute(
            select(func.count(StockTransfer.id)).where(
                StockTransfer.completed_at.is_not(None),
                StockTransfer.completed_at >= day_start,
                StockTransfer.completed_at < day_end,
            )
        )
    ).scalar_one()

    return DashboardActivityToday(
        date=day_start.date(),
        movements_today=movements_today,
        completed_goods_receipts_today=completed_goods_receipts_today,
        completed_goods_issues_today=completed_goods_issues_today,
        completed_stock_transfers_today=completed_stock_transfers_today,
    )
