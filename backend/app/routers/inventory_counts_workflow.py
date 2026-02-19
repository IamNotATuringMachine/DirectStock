from datetime import UTC, datetime
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory import Inventory, InventoryCountItem, InventoryCountSession, StockMovement
from app.models.warehouse import BinLocation, WarehouseZone
from app.services.alerts import evaluate_alerts
from app.utils.http_status import HTTP_422_UNPROCESSABLE


def _now() -> datetime:
    return datetime.now(UTC)


async def generate_inventory_count_items_flow(
    *,
    db: AsyncSession,
    session: InventoryCountSession,
    refresh_existing: bool,
) -> int:
    if session.status == "completed":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Inventory count session already completed")
    if session.status == "cancelled":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Inventory count session is cancelled")

    existing_items = list(
        (
            await db.execute(select(InventoryCountItem).where(InventoryCountItem.session_id == session.id))
        ).scalars()
    )
    if existing_items and not refresh_existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Inventory count items already generated; set refresh_existing=true to regenerate",
        )

    if refresh_existing and existing_items:
        for row in existing_items:
            await db.delete(row)
        await db.flush()

    stmt = (
        select(
            Inventory.id.label("inventory_id"),
            Inventory.product_id.label("product_id"),
            Inventory.bin_location_id.label("bin_location_id"),
            Inventory.quantity.label("quantity"),
            Inventory.unit.label("unit"),
        )
        .join(BinLocation, BinLocation.id == Inventory.bin_location_id)
        .join(WarehouseZone, WarehouseZone.id == BinLocation.zone_id)
        .where(Inventory.quantity > 0)
    )
    if session.warehouse_id is not None:
        stmt = stmt.where(WarehouseZone.warehouse_id == session.warehouse_id)

    rows = (await db.execute(stmt)).all()
    if not rows:
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE,
            detail="No inventory rows available for this session scope",
        )

    for row in rows:
        db.add(
            InventoryCountItem(
                session_id=session.id,
                inventory_id=row.inventory_id,
                product_id=row.product_id,
                bin_location_id=row.bin_location_id,
                snapshot_quantity=row.quantity,
                counted_quantity=None,
                difference_quantity=None,
                unit=row.unit,
            )
        )

    session.generated_at = _now()
    session.status = "in_progress"
    await db.commit()
    return len(rows)


async def complete_inventory_count_session_flow(
    *,
    db: AsyncSession,
    session: InventoryCountSession,
    current_user_id: int,
) -> None:
    if session.status == "completed":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Inventory count session already completed")
    if session.status == "cancelled":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Inventory count session is cancelled")

    items = list(
        (
            await db.execute(select(InventoryCountItem).where(InventoryCountItem.session_id == session.id))
        ).scalars()
    )
    if not items:
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE,
            detail="Inventory count session has no items",
        )

    uncounted = [row.id for row in items if row.counted_quantity is None]
    if uncounted:
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE,
            detail=f"Inventory count items without count: {uncounted[0]}",
        )

    recount_required = [row.id for row in items if row.recount_required]
    if recount_required:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Recount required for item {recount_required[0]}",
        )

    now = _now()
    touched_product_ids: set[int] = set()
    try:
        for count_item in items:
            diff = Decimal(count_item.difference_quantity or 0)
            if diff == 0:
                continue

            inventory = None
            if count_item.inventory_id is not None:
                inventory = await db.get(Inventory, count_item.inventory_id)

            if inventory is None:
                inventory = (
                    await db.execute(
                        select(Inventory)
                        .where(
                            Inventory.product_id == count_item.product_id,
                            Inventory.bin_location_id == count_item.bin_location_id,
                        )
                        .order_by(Inventory.id.asc())
                        .limit(1)
                    )
                ).scalar_one_or_none()
            if inventory is None:
                inventory = Inventory(
                    product_id=count_item.product_id,
                    bin_location_id=count_item.bin_location_id,
                    quantity=Decimal("0"),
                    reserved_quantity=Decimal("0"),
                    unit=count_item.unit,
                )
                db.add(inventory)
                await db.flush()

            resulting_qty = Decimal(inventory.quantity) + diff
            if resulting_qty < 0:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Inventory adjustment would create negative stock for item {count_item.id}",
                )
            inventory.quantity = resulting_qty

            is_increase = diff > 0
            db.add(
                StockMovement(
                    movement_type="inventory_adjustment",
                    reference_type="inventory_count",
                    reference_number=session.session_number,
                    product_id=count_item.product_id,
                    from_bin_id=None if is_increase else count_item.bin_location_id,
                    to_bin_id=count_item.bin_location_id if is_increase else None,
                    quantity=abs(diff),
                    performed_by=current_user_id,
                    performed_at=now,
                    metadata_json={
                        "inventory_count_session_id": session.id,
                        "inventory_count_item_id": count_item.id,
                        "snapshot_quantity": str(count_item.snapshot_quantity),
                        "counted_quantity": str(count_item.counted_quantity),
                        "difference_quantity": str(diff),
                    },
                )
            )
            touched_product_ids.add(count_item.product_id)

        session.status = "completed"
        session.completed_at = now
        await evaluate_alerts(
            db,
            trigger="inventory_count_completed",
            scoped_product_ids=touched_product_ids or None,
        )
        await db.commit()
    except HTTPException:
        await db.rollback()
        raise
