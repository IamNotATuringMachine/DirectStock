from .common import *


async def complete_goods_issue_flow(
    *,
    db: AsyncSession,
    item: GoodsIssue,
    issue_items: list[GoodsIssueItem],
    current_user: User,
    operation_signoff: OperationSignoff | None = None,
) -> None:
    now = _now()
    touched_product_ids: set[int] = set()

    try:
        for issue_item in issue_items:
            if issue_item.source_bin_id is None:
                raise HTTPException(
                    status_code=HTTP_422_UNPROCESSABLE,
                    detail=f"Issue item {issue_item.id} has no source_bin_id",
                )

            quantity = Decimal(issue_item.issued_quantity or 0)
            if quantity <= 0:
                quantity = Decimal(issue_item.requested_quantity)

            serial_numbers = _normalize_serial_numbers(issue_item.serial_numbers)
            _ensure_quantity_matches_serials(quantity, serial_numbers, item_label=f"Issue item {issue_item.id}")

            inventory = (
                await db.execute(
                    select(Inventory).where(
                        Inventory.product_id == issue_item.product_id,
                        Inventory.bin_location_id == issue_item.source_bin_id,
                    )
                )
            ).scalar_one_or_none()

            if inventory is None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Insufficient stock for product {issue_item.product_id} at bin {issue_item.source_bin_id}",
                )

            available_quantity = Decimal(inventory.quantity) - Decimal(inventory.reserved_quantity)
            if available_quantity < quantity:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"Insufficient stock for product {issue_item.product_id} at bin {issue_item.source_bin_id} "
                        f"(available={available_quantity}, requested={quantity})"
                    ),
                )

            inventory.quantity = Decimal(inventory.quantity) - quantity
            issue_item.issued_quantity = quantity

            batch = await _resolve_issue_batch(db, issue_item=issue_item)
            if batch is not None:
                if Decimal(batch.quantity) < quantity:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Insufficient batch stock for issue item {issue_item.id} (batch={batch.batch_number})",
                    )
                batch.quantity = Decimal(batch.quantity) - quantity

            if serial_numbers:
                serial_rows = list(
                    (
                        await db.execute(
                            select(SerialNumber).where(
                                SerialNumber.serial_number.in_(serial_numbers),
                                SerialNumber.product_id == issue_item.product_id,
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
                    if serial_row.status != "in_stock" or serial_row.current_bin_id != issue_item.source_bin_id:
                        raise HTTPException(
                            status_code=status.HTTP_409_CONFLICT,
                            detail=f"Serial number {serial} is not available in source bin",
                        )
                    serial_row.status = "issued"
                    serial_row.current_bin_id = None
                    serial_row.last_movement_at = now

            db.add(
                StockMovement(
                    movement_type="goods_issue",
                    reference_type="goods_issue",
                    reference_number=item.issue_number,
                    product_id=issue_item.product_id,
                    from_bin_id=issue_item.source_bin_id,
                    to_bin_id=None,
                    quantity=quantity,
                    performed_by=current_user.id,
                    performed_at=now,
                    metadata_json={
                        "goods_issue_id": item.id,
                        "goods_issue_item_id": issue_item.id,
                        "batch_number": issue_item.batch_number,
                        "serial_numbers": serial_numbers or None,
                    },
                )
            )
            touched_product_ids.add(issue_item.product_id)

        item.status = "completed"
        item.completed_at = now
        if item.issued_at is None:
            item.issued_at = now
        if operation_signoff is not None:
            db.add(operation_signoff)

        await evaluate_alerts(
            db,
            trigger="goods_issue_completed",
            scoped_product_ids=touched_product_ids or None,
        )
        await db.commit()
    except HTTPException:
        await db.rollback()
        raise
