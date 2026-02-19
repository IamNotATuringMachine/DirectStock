from datetime import UTC, datetime
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory import Inventory, InventoryBatch, SerialNumber, StockMovement
from app.models.phase4 import InterWarehouseTransfer, InterWarehouseTransferItem
from app.utils.http_status import HTTP_422_UNPROCESSABLE


def _now() -> datetime:
    return datetime.now(UTC)


def _normalize_serial_numbers(raw: list[str] | None) -> list[str]:
    if not raw:
        return []
    return sorted({item.strip() for item in raw if item and item.strip()})


def _ensure_quantity_matches_serials(quantity: Decimal, serial_numbers: list[str], *, item_label: str) -> None:
    if serial_numbers and quantity != Decimal(len(serial_numbers)):
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE,
            detail=f"{item_label} quantity must equal number of serial numbers",
        )


async def _get_inventory(db: AsyncSession, *, product_id: int, bin_location_id: int, unit: str) -> Inventory:
    item = (
        await db.execute(
            select(Inventory).where(
                Inventory.product_id == product_id,
                Inventory.bin_location_id == bin_location_id,
            )
        )
    ).scalar_one_or_none()
    if item is None:
        item = Inventory(product_id=product_id, bin_location_id=bin_location_id, quantity=Decimal("0"), unit=unit)
        db.add(item)
        await db.flush()
    return item


async def _get_inventory_batch(
    db: AsyncSession,
    *,
    product_id: int,
    bin_location_id: int,
    batch_number: str,
    unit: str,
) -> InventoryBatch:
    item = (
        await db.execute(
            select(InventoryBatch).where(
                InventoryBatch.product_id == product_id,
                InventoryBatch.bin_location_id == bin_location_id,
                InventoryBatch.batch_number == batch_number,
            )
        )
    ).scalar_one_or_none()
    if item is None:
        item = InventoryBatch(
            product_id=product_id,
            bin_location_id=bin_location_id,
            batch_number=batch_number,
            quantity=Decimal("0"),
            unit=unit,
        )
        db.add(item)
        await db.flush()
    return item


async def dispatch_inter_warehouse_transfer_flow(
    *,
    db: AsyncSession,
    transfer: InterWarehouseTransfer,
    items: list[InterWarehouseTransferItem],
    current_user_id: int,
) -> None:
    now = _now()
    try:
        for item in items:
            quantity = Decimal(item.requested_quantity)
            serial_numbers = _normalize_serial_numbers(item.serial_numbers)
            _ensure_quantity_matches_serials(quantity, serial_numbers, item_label=f"Transfer item {item.id}")

            source_inventory = (
                await db.execute(
                    select(Inventory).where(
                        Inventory.product_id == item.product_id,
                        Inventory.bin_location_id == item.from_bin_id,
                    )
                )
            ).scalar_one_or_none()
            if source_inventory is None:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Insufficient stock for transfer item {item.id}")

            available_quantity = Decimal(source_inventory.quantity) - Decimal(source_inventory.reserved_quantity)
            if available_quantity < quantity:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Insufficient stock for transfer item {item.id} (available={available_quantity}, requested={quantity})",
                )

            source_inventory.quantity = Decimal(source_inventory.quantity) - quantity

            if item.batch_number:
                source_batch = (
                    await db.execute(
                        select(InventoryBatch).where(
                            InventoryBatch.product_id == item.product_id,
                            InventoryBatch.bin_location_id == item.from_bin_id,
                            InventoryBatch.batch_number == item.batch_number,
                        )
                    )
                ).scalar_one_or_none()
                if source_batch is None or Decimal(source_batch.quantity) < quantity:
                    raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Insufficient batch stock for transfer item {item.id}")
                source_batch.quantity = Decimal(source_batch.quantity) - quantity

            if serial_numbers:
                serial_rows = list(
                    (
                        await db.execute(
                            select(SerialNumber).where(
                                SerialNumber.serial_number.in_(serial_numbers),
                                SerialNumber.product_id == item.product_id,
                            )
                        )
                    ).scalars()
                )
                serial_map = {row.serial_number: row for row in serial_rows}
                missing = [serial for serial in serial_numbers if serial not in serial_map]
                if missing:
                    raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Serial number not found: {missing[0]}")

                for serial in serial_numbers:
                    serial_row = serial_map[serial]
                    if serial_row.status != "in_stock" or serial_row.current_bin_id != item.from_bin_id:
                        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Serial number {serial} is not available at source bin")
                    serial_row.status = "in_transit"
                    serial_row.current_bin_id = None
                    serial_row.last_movement_at = now

            item.dispatched_quantity = quantity

            db.add(
                StockMovement(
                    movement_type="inter_warehouse_dispatch",
                    reference_type="inter_warehouse_transfer",
                    reference_number=transfer.transfer_number,
                    product_id=item.product_id,
                    from_bin_id=item.from_bin_id,
                    to_bin_id=None,
                    quantity=quantity,
                    performed_by=current_user_id,
                    performed_at=now,
                    metadata_json={
                        "inter_warehouse_transfer_id": transfer.id,
                        "inter_warehouse_transfer_item_id": item.id,
                        "batch_number": item.batch_number,
                        "serial_numbers": serial_numbers or None,
                    },
                )
            )

        transfer.status = "dispatched"
        transfer.dispatched_at = now
        await db.commit()
    except HTTPException:
        await db.rollback()
        raise


async def receive_inter_warehouse_transfer_flow(
    *,
    db: AsyncSession,
    transfer: InterWarehouseTransfer,
    items: list[InterWarehouseTransferItem],
    current_user_id: int,
) -> None:
    now = _now()
    try:
        for item in items:
            quantity = Decimal(item.dispatched_quantity or item.requested_quantity)
            if quantity <= 0:
                quantity = Decimal(item.requested_quantity)

            target_inventory = await _get_inventory(
                db,
                product_id=item.product_id,
                bin_location_id=item.to_bin_id,
                unit=item.unit,
            )
            target_inventory.quantity = Decimal(target_inventory.quantity) + quantity

            if item.batch_number:
                target_batch = await _get_inventory_batch(
                    db,
                    product_id=item.product_id,
                    bin_location_id=item.to_bin_id,
                    batch_number=item.batch_number,
                    unit=item.unit,
                )
                target_batch.quantity = Decimal(target_batch.quantity) + quantity

            serial_numbers = _normalize_serial_numbers(item.serial_numbers)
            if serial_numbers:
                serial_rows = list(
                    (
                        await db.execute(
                            select(SerialNumber).where(
                                SerialNumber.serial_number.in_(serial_numbers),
                                SerialNumber.product_id == item.product_id,
                            )
                        )
                    ).scalars()
                )
                serial_map = {row.serial_number: row for row in serial_rows}
                missing = [serial for serial in serial_numbers if serial not in serial_map]
                if missing:
                    raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Serial number not found: {missing[0]}")

                for serial in serial_numbers:
                    serial_row = serial_map[serial]
                    if serial_row.status != "in_transit":
                        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Serial number {serial} is not in transit")
                    serial_row.status = "in_stock"
                    serial_row.current_bin_id = item.to_bin_id
                    serial_row.last_movement_at = now

            item.received_quantity = quantity

            db.add(
                StockMovement(
                    movement_type="inter_warehouse_receive",
                    reference_type="inter_warehouse_transfer",
                    reference_number=transfer.transfer_number,
                    product_id=item.product_id,
                    from_bin_id=None,
                    to_bin_id=item.to_bin_id,
                    quantity=quantity,
                    performed_by=current_user_id,
                    performed_at=now,
                    metadata_json={
                        "inter_warehouse_transfer_id": transfer.id,
                        "inter_warehouse_transfer_item_id": item.id,
                        "batch_number": item.batch_number,
                        "serial_numbers": serial_numbers or None,
                    },
                )
            )

        transfer.status = "received"
        transfer.received_at = now
        await db.commit()
    except HTTPException:
        await db.rollback()
        raise
