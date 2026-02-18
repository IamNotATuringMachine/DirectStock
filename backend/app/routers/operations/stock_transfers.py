from .common import *


@router.get("/stock-transfers", response_model=list[StockTransferResponse])
async def list_stock_transfers(
    status_filter: str | None = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(STOCK_TRANSFER_READ_PERMISSION)),
) -> list[StockTransferResponse]:
    stmt = select(StockTransfer).order_by(StockTransfer.id.desc())
    if status_filter:
        stmt = stmt.where(StockTransfer.status == status_filter)
    rows = list((await db.execute(stmt)).scalars())
    return [_to_stock_transfer_response(item) for item in rows]


@router.post("/stock-transfers", response_model=StockTransferResponse, status_code=status.HTTP_201_CREATED)
async def create_stock_transfer(
    payload: StockTransferCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(STOCK_TRANSFER_WRITE_PERMISSION)),
) -> StockTransferResponse:
    item = StockTransfer(
        transfer_number=payload.transfer_number or _generate_number("ST"),
        notes=payload.notes,
        created_by=current_user.id,
    )
    db.add(item)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Stock transfer already exists") from exc

    await db.refresh(item)
    return _to_stock_transfer_response(item)


@router.get("/stock-transfers/{transfer_id}", response_model=StockTransferResponse)
async def get_stock_transfer(
    transfer_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(STOCK_TRANSFER_READ_PERMISSION)),
) -> StockTransferResponse:
    item = (await db.execute(select(StockTransfer).where(StockTransfer.id == transfer_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock transfer not found")
    return _to_stock_transfer_response(item)


@router.put("/stock-transfers/{transfer_id}", response_model=StockTransferResponse)
async def update_stock_transfer(
    transfer_id: int,
    payload: StockTransferUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(STOCK_TRANSFER_WRITE_PERMISSION)),
) -> StockTransferResponse:
    item = (await db.execute(select(StockTransfer).where(StockTransfer.id == transfer_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock transfer not found")

    _ensure_draft("Stock transfer", item.status)

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)

    await db.commit()
    await db.refresh(item)
    return _to_stock_transfer_response(item)


@router.delete("/stock-transfers/{transfer_id}", response_model=MessageResponse)
async def delete_stock_transfer(
    transfer_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(STOCK_TRANSFER_WRITE_PERMISSION)),
) -> MessageResponse:
    item = (await db.execute(select(StockTransfer).where(StockTransfer.id == transfer_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock transfer not found")

    _ensure_draft("Stock transfer", item.status)

    await db.delete(item)
    await db.commit()
    return MessageResponse(message="stock transfer deleted")


@router.get("/stock-transfers/{transfer_id}/items", response_model=list[StockTransferItemResponse])
async def list_stock_transfer_items(
    transfer_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(STOCK_TRANSFER_READ_PERMISSION)),
) -> list[StockTransferItemResponse]:
    parent = (await db.execute(select(StockTransfer).where(StockTransfer.id == transfer_id))).scalar_one_or_none()
    if parent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock transfer not found")

    rows = list(
        (
            await db.execute(
                select(StockTransferItem)
                .where(StockTransferItem.stock_transfer_id == transfer_id)
                .order_by(StockTransferItem.id.asc())
            )
        ).scalars()
    )
    return [_to_stock_transfer_item_response(item) for item in rows]


@router.post(
    "/stock-transfers/{transfer_id}/items",
    response_model=StockTransferItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_stock_transfer_item(
    transfer_id: int,
    payload: StockTransferItemCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(STOCK_TRANSFER_WRITE_PERMISSION)),
) -> StockTransferItemResponse:
    parent = (await db.execute(select(StockTransfer).where(StockTransfer.id == transfer_id))).scalar_one_or_none()
    if parent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock transfer not found")

    _ensure_draft("Stock transfer", parent.status)

    if payload.from_bin_id == payload.to_bin_id:
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE,
            detail="from_bin_id and to_bin_id must differ",
        )

    values = payload.model_dump()
    serial_numbers = _normalize_serial_numbers(values.get("serial_numbers"))
    values["serial_numbers"] = serial_numbers or None
    item = StockTransferItem(stock_transfer_id=transfer_id, **values)
    db.add(item)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Conflict while creating transfer item"
        ) from exc

    await db.refresh(item)
    return _to_stock_transfer_item_response(item)


@router.put(
    "/stock-transfers/{transfer_id}/items/{item_id}",
    response_model=StockTransferItemResponse,
)
async def update_stock_transfer_item(
    transfer_id: int,
    item_id: int,
    payload: StockTransferItemUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(STOCK_TRANSFER_WRITE_PERMISSION)),
) -> StockTransferItemResponse:
    parent = (await db.execute(select(StockTransfer).where(StockTransfer.id == transfer_id))).scalar_one_or_none()
    if parent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock transfer not found")

    _ensure_draft("Stock transfer", parent.status)

    item = (
        await db.execute(
            select(StockTransferItem).where(
                StockTransferItem.id == item_id,
                StockTransferItem.stock_transfer_id == transfer_id,
            )
        )
    ).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock transfer item not found")

    updates = payload.model_dump(exclude_unset=True)
    if "serial_numbers" in updates:
        serial_numbers = _normalize_serial_numbers(updates.get("serial_numbers"))
        updates["serial_numbers"] = serial_numbers or None

    from_bin = updates.get("from_bin_id", item.from_bin_id)
    to_bin = updates.get("to_bin_id", item.to_bin_id)
    if from_bin == to_bin:
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE,
            detail="from_bin_id and to_bin_id must differ",
        )

    for key, value in updates.items():
        setattr(item, key, value)

    await db.commit()
    await db.refresh(item)
    return _to_stock_transfer_item_response(item)


@router.delete("/stock-transfers/{transfer_id}/items/{item_id}", response_model=MessageResponse)
async def delete_stock_transfer_item(
    transfer_id: int,
    item_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(STOCK_TRANSFER_WRITE_PERMISSION)),
) -> MessageResponse:
    parent = (await db.execute(select(StockTransfer).where(StockTransfer.id == transfer_id))).scalar_one_or_none()
    if parent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock transfer not found")

    _ensure_draft("Stock transfer", parent.status)

    item = (
        await db.execute(
            select(StockTransferItem).where(
                StockTransferItem.id == item_id,
                StockTransferItem.stock_transfer_id == transfer_id,
            )
        )
    ).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock transfer item not found")

    await db.delete(item)
    await db.commit()
    return MessageResponse(message="stock transfer item deleted")


@router.post("/stock-transfers/{transfer_id}/complete", response_model=MessageResponse)
async def complete_stock_transfer(
    transfer_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(STOCK_TRANSFER_WRITE_PERMISSION)),
) -> MessageResponse:
    item = (await db.execute(select(StockTransfer).where(StockTransfer.id == transfer_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock transfer not found")

    _ensure_draft("Stock transfer", item.status)

    transfer_items = list(
        (
            await db.execute(select(StockTransferItem).where(StockTransferItem.stock_transfer_id == transfer_id))
        ).scalars()
    )
    if not transfer_items:
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE,
            detail="Stock transfer has no items",
        )

    now = _now()
    touched_product_ids: set[int] = set()

    try:
        for transfer_item in transfer_items:
            if transfer_item.from_bin_id == transfer_item.to_bin_id:
                raise HTTPException(
                    status_code=HTTP_422_UNPROCESSABLE,
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
                    reference_number=item.transfer_number,
                    product_id=transfer_item.product_id,
                    from_bin_id=transfer_item.from_bin_id,
                    to_bin_id=transfer_item.to_bin_id,
                    quantity=quantity,
                    performed_by=current_user.id,
                    performed_at=now,
                    metadata_json={
                        "stock_transfer_id": item.id,
                        "stock_transfer_item_id": transfer_item.id,
                        "batch_number": transfer_item.batch_number,
                        "serial_numbers": serial_numbers or None,
                    },
                )
            )
            touched_product_ids.add(transfer_item.product_id)

        item.status = "completed"
        item.completed_at = now
        if item.transferred_at is None:
            item.transferred_at = now

        await evaluate_alerts(
            db,
            trigger="stock_transfer_completed",
            scoped_product_ids=touched_product_ids or None,
        )
        await db.commit()
    except HTTPException:
        await db.rollback()
        raise

    return MessageResponse(message="stock transfer completed")


@router.post("/stock-transfers/{transfer_id}/cancel", response_model=MessageResponse)
async def cancel_stock_transfer(
    transfer_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(STOCK_TRANSFER_WRITE_PERMISSION)),
) -> MessageResponse:
    item = (await db.execute(select(StockTransfer).where(StockTransfer.id == transfer_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock transfer not found")

    _ensure_draft("Stock transfer", item.status)

    item.status = "cancelled"
    await db.commit()
    return MessageResponse(message="stock transfer cancelled")
