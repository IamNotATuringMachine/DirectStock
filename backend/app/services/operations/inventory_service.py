"""Inventory-related helpers for operations workflows."""

from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory import Inventory, InventoryBatch


async def get_or_create_inventory(
    db: AsyncSession,
    *,
    product_id: int,
    bin_location_id: int,
    unit: str,
) -> Inventory:
    inventory = (
        await db.execute(
            select(Inventory).where(
                Inventory.product_id == product_id,
                Inventory.bin_location_id == bin_location_id,
            )
        )
    ).scalar_one_or_none()
    if inventory is None:
        inventory = Inventory(
            product_id=product_id,
            bin_location_id=bin_location_id,
            quantity=Decimal("0"),
            reserved_quantity=Decimal("0"),
            unit=unit,
        )
        db.add(inventory)
        await db.flush()
    return inventory


async def get_or_create_inventory_batch(
    db: AsyncSession,
    *,
    product_id: int,
    bin_location_id: int,
    batch_number: str,
    unit: str,
    expiry_date: date | None,
    manufactured_at: date | None,
) -> InventoryBatch:
    batch = (
        await db.execute(
            select(InventoryBatch).where(
                InventoryBatch.product_id == product_id,
                InventoryBatch.bin_location_id == bin_location_id,
                InventoryBatch.batch_number == batch_number,
            )
        )
    ).scalar_one_or_none()

    if batch is None:
        batch = InventoryBatch(
            product_id=product_id,
            bin_location_id=bin_location_id,
            batch_number=batch_number,
            expiry_date=expiry_date,
            manufactured_at=manufactured_at,
            quantity=Decimal("0"),
            unit=unit,
        )
        db.add(batch)
        await db.flush()
        return batch

    if batch.expiry_date is None and expiry_date is not None:
        batch.expiry_date = expiry_date
    if batch.manufactured_at is None and manufactured_at is not None:
        batch.manufactured_at = manufactured_at
    if not batch.unit:
        batch.unit = unit

    return batch
