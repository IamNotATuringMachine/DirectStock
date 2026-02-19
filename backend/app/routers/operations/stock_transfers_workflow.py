from .common import (
    AsyncSession,
    Decimal,
    HTTPException,
    Inventory,
    InventoryBatch,
    SerialNumber,
    StockMovement,
    StockTransfer,
    StockTransferItem,
    _ensure_quantity_matches_serials,
    _get_inventory,
    _get_inventory_batch,
    _normalize_serial_numbers,
    _now,
    evaluate_alerts,
    select,
    status,
)


async def complete_stock_transfer_workflow(
    *,
    db: AsyncSession,
    transfer: StockTransfer,
    current_user_id: int,
) -> None:
    transfer_items = list(
        (
            await db.execute(select(StockTransferItem).where(StockTransferItem.stock_transfer_id == transfer.id))
        ).scalars()
    )
    if not transfer_items:
        raise HTTPException(
            status_code=422,
            detail="Stock transfer has no items",
        )

    now = _now()
    touched_product_ids: set[int] = set()

    try:
        for transfer_item in transfer_items:
            if transfer_item.from_bin_id == transfer_item.to_bin_id:
                raise HTTPException(
                    status_code=422,
                    detail=f"Transfer item {transfer_item.id} has same source and target bin",
                )

            quantity = Decimal(transfer_item.quantity)
            serial_numbers = _normalize_serial_numbers(transfer_item.serial_numbers)
            _ensure_quantity_matches_serials(quantity, serial_numbers, item_label=f"Transfer item {transfer_item.id}")
            source_inventory = (
                await db.execute(
                    select(Inventory).where(
                        Inventory.product_id == transfer_item.product_id,
                        Inventory.bin_location_id == transfer_item.from_bin_id,
                    )
                )
            ).scalar_one_or_none()

            if source_inventory is None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"Insufficient stock for product {transfer_item.product_id} "
                        f"at source bin {transfer_item.from_bin_id}"
                    ),
                )

            available_quantity = Decimal(source_inventory.quantity) - Decimal(source_inventory.reserved_quantity)
            if available_quantity < quantity:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"Insufficient stock for product {transfer_item.product_id} at source bin "
                        f"{transfer_item.from_bin_id} (available={available_quantity}, requested={quantity})"
                    ),
                )

            target_inventory = await _get_inventory(
                db,
                product_id=transfer_item.product_id,
                bin_location_id=transfer_item.to_bin_id,
                unit=transfer_item.unit,
            )

            source_inventory.quantity = Decimal(source_inventory.quantity) - quantity
            target_inventory.quantity = Decimal(target_inventory.quantity) + quantity

            source_batch: InventoryBatch | None = None
            target_batch: InventoryBatch | None = None
            if transfer_item.batch_number:
                source_batch = (
                    await db.execute(
                        select(InventoryBatch).where(
                            InventoryBatch.product_id == transfer_item.product_id,
                            InventoryBatch.bin_location_id == transfer_item.from_bin_id,
                            InventoryBatch.batch_number == transfer_item.batch_number,
                        )
                    )
                ).scalar_one_or_none()
                if source_batch is None:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Batch {transfer_item.batch_number} not found at source bin",
                    )
                if Decimal(source_batch.quantity) < quantity:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Insufficient batch stock for transfer item {transfer_item.id}",
                    )
                source_batch.quantity = Decimal(source_batch.quantity) - quantity

                target_batch = await _get_inventory_batch(
                    db,
                    product_id=transfer_item.product_id,
                    bin_location_id=transfer_item.to_bin_id,
                    batch_number=source_batch.batch_number,
                    unit=transfer_item.unit,
                    expiry_date=source_batch.expiry_date,
                    manufactured_at=source_batch.manufactured_at,
                )
                target_batch.quantity = Decimal(target_batch.quantity) + quantity

            if serial_numbers:
                serial_rows = list(
                    (
                        await db.execute(
                            select(SerialNumber).where(
                                SerialNumber.serial_number.in_(serial_numbers),
                                SerialNumber.product_id == transfer_item.product_id,
                            )
                        )
                    ).scalars()
                )
                serial_map = {row.serial_number: row for row in serial_rows}
                missing = [serial for serial in serial_numbers if serial not in serial_map]
                if missing:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Serial number not found: {missing[0]}",
                    )

                for serial in serial_numbers:
                    serial_row = serial_map[serial]
                    if serial_row.status != "in_stock" or serial_row.current_bin_id != transfer_item.from_bin_id:
                        raise HTTPException(
                            status_code=status.HTTP_409_CONFLICT,
                            detail=f"Serial number {serial} is not available at source bin",
                        )
                    serial_row.current_bin_id = transfer_item.to_bin_id
                    serial_row.status = "in_stock"
                    serial_row.batch_id = target_batch.id if target_batch else serial_row.batch_id
                    serial_row.last_movement_at = now

            db.add(
                StockMovement(
                    movement_type="stock_transfer",
                    reference_type="stock_transfer",
                    reference_number=transfer.transfer_number,
                    product_id=transfer_item.product_id,
                    from_bin_id=transfer_item.from_bin_id,
                    to_bin_id=transfer_item.to_bin_id,
                    quantity=quantity,
                    performed_by=current_user_id,
                    performed_at=now,
                    metadata_json={
                        "stock_transfer_id": transfer.id,
                        "stock_transfer_item_id": transfer_item.id,
                        "batch_number": transfer_item.batch_number,
                        "serial_numbers": serial_numbers or None,
                    },
                )
            )
            touched_product_ids.add(transfer_item.product_id)

        transfer.status = "completed"
        transfer.completed_at = now
        if transfer.transferred_at is None:
            transfer.transferred_at = now

        await evaluate_alerts(
            db,
            trigger="stock_transfer_completed",
            scoped_product_ids=touched_product_ids or None,
        )
        await db.commit()
    except HTTPException:
        await db.rollback()
        raise
