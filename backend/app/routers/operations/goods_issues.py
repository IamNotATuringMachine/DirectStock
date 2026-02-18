from .common import *


@router.get("/goods-issues", response_model=list[GoodsIssueResponse])
async def list_goods_issues(
    status_filter: str | None = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(GOODS_ISSUE_READ_PERMISSION)),
) -> list[GoodsIssueResponse]:
    stmt = select(GoodsIssue).order_by(GoodsIssue.id.desc())
    if status_filter:
        stmt = stmt.where(GoodsIssue.status == status_filter)
    rows = list((await db.execute(stmt)).scalars())
    return [_to_goods_issue_response(item) for item in rows]


@router.post("/goods-issues", response_model=GoodsIssueResponse, status_code=status.HTTP_201_CREATED)
async def create_goods_issue(
    payload: GoodsIssueCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(GOODS_ISSUE_WRITE_PERMISSION)),
) -> GoodsIssueResponse:
    customer_id, customer_location_id = await _resolve_customer_scope(
        db,
        customer_id=payload.customer_id,
        customer_location_id=payload.customer_location_id,
    )

    item = GoodsIssue(
        issue_number=payload.issue_number or _generate_number("WA"),
        customer_id=customer_id,
        customer_location_id=customer_location_id,
        customer_reference=payload.customer_reference,
        notes=payload.notes,
        created_by=current_user.id,
    )
    db.add(item)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Goods issue already exists") from exc

    await db.refresh(item)
    return _to_goods_issue_response(item)


@router.get("/goods-issues/{issue_id}", response_model=GoodsIssueResponse)
async def get_goods_issue(
    issue_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(GOODS_ISSUE_READ_PERMISSION)),
) -> GoodsIssueResponse:
    item = (await db.execute(select(GoodsIssue).where(GoodsIssue.id == issue_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods issue not found")
    return _to_goods_issue_response(item)


@router.put("/goods-issues/{issue_id}", response_model=GoodsIssueResponse)
async def update_goods_issue(
    issue_id: int,
    payload: GoodsIssueUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(GOODS_ISSUE_WRITE_PERMISSION)),
) -> GoodsIssueResponse:
    item = (await db.execute(select(GoodsIssue).where(GoodsIssue.id == issue_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods issue not found")

    _ensure_draft("Goods issue", item.status)

    updates = payload.model_dump(exclude_unset=True)
    if "customer_id" in updates or "customer_location_id" in updates:
        requested_customer_id = updates.get("customer_id", item.customer_id)
        requested_location_id = updates.get("customer_location_id", item.customer_location_id)
        if "customer_id" in updates and updates["customer_id"] is None and "customer_location_id" not in updates:
            requested_location_id = None
        resolved_customer_id, resolved_location_id = await _resolve_customer_scope(
            db,
            customer_id=requested_customer_id,
            customer_location_id=requested_location_id,
        )
        updates["customer_id"] = resolved_customer_id
        updates["customer_location_id"] = resolved_location_id

    for key, value in updates.items():
        setattr(item, key, value)

    await db.commit()
    await db.refresh(item)
    return _to_goods_issue_response(item)


@router.delete("/goods-issues/{issue_id}", response_model=MessageResponse)
async def delete_goods_issue(
    issue_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(GOODS_ISSUE_WRITE_PERMISSION)),
) -> MessageResponse:
    item = (await db.execute(select(GoodsIssue).where(GoodsIssue.id == issue_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods issue not found")

    _ensure_draft("Goods issue", item.status)

    await db.delete(item)
    await db.commit()
    return MessageResponse(message="goods issue deleted")


@router.get("/goods-issues/{issue_id}/items", response_model=list[GoodsIssueItemResponse])
async def list_goods_issue_items(
    issue_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(GOODS_ISSUE_READ_PERMISSION)),
) -> list[GoodsIssueItemResponse]:
    parent = (await db.execute(select(GoodsIssue).where(GoodsIssue.id == issue_id))).scalar_one_or_none()
    if parent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods issue not found")

    rows = list(
        (
            await db.execute(
                select(GoodsIssueItem)
                .where(GoodsIssueItem.goods_issue_id == issue_id)
                .order_by(GoodsIssueItem.id.asc())
            )
        ).scalars()
    )
    return [_to_goods_issue_item_response(item) for item in rows]


@router.post(
    "/goods-issues/{issue_id}/items",
    response_model=GoodsIssueItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_goods_issue_item(
    issue_id: int,
    payload: GoodsIssueItemCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(GOODS_ISSUE_WRITE_PERMISSION)),
) -> GoodsIssueItemResponse:
    parent = (await db.execute(select(GoodsIssue).where(GoodsIssue.id == issue_id))).scalar_one_or_none()
    if parent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods issue not found")

    _ensure_draft("Goods issue", parent.status)

    values = payload.model_dump()
    serial_numbers = _normalize_serial_numbers(values.get("serial_numbers"))
    values["serial_numbers"] = serial_numbers or None
    item = GoodsIssueItem(goods_issue_id=issue_id, **values)
    db.add(item)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Conflict while creating issue item") from exc

    await db.refresh(item)
    return _to_goods_issue_item_response(item)


@router.put(
    "/goods-issues/{issue_id}/items/{item_id}",
    response_model=GoodsIssueItemResponse,
)
async def update_goods_issue_item(
    issue_id: int,
    item_id: int,
    payload: GoodsIssueItemUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(GOODS_ISSUE_WRITE_PERMISSION)),
) -> GoodsIssueItemResponse:
    parent = (await db.execute(select(GoodsIssue).where(GoodsIssue.id == issue_id))).scalar_one_or_none()
    if parent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods issue not found")

    _ensure_draft("Goods issue", parent.status)

    item = (
        await db.execute(
            select(GoodsIssueItem).where(
                GoodsIssueItem.id == item_id,
                GoodsIssueItem.goods_issue_id == issue_id,
            )
        )
    ).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods issue item not found")

    updates = payload.model_dump(exclude_unset=True)
    if "serial_numbers" in updates:
        serial_numbers = _normalize_serial_numbers(updates.get("serial_numbers"))
        updates["serial_numbers"] = serial_numbers or None

    for key, value in updates.items():
        setattr(item, key, value)

    await db.commit()
    await db.refresh(item)
    return _to_goods_issue_item_response(item)


@router.delete("/goods-issues/{issue_id}/items/{item_id}", response_model=MessageResponse)
async def delete_goods_issue_item(
    issue_id: int,
    item_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(GOODS_ISSUE_WRITE_PERMISSION)),
) -> MessageResponse:
    parent = (await db.execute(select(GoodsIssue).where(GoodsIssue.id == issue_id))).scalar_one_or_none()
    if parent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods issue not found")

    _ensure_draft("Goods issue", parent.status)

    item = (
        await db.execute(
            select(GoodsIssueItem).where(
                GoodsIssueItem.id == item_id,
                GoodsIssueItem.goods_issue_id == issue_id,
            )
        )
    ).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods issue item not found")

    await db.delete(item)
    await db.commit()
    return MessageResponse(message="goods issue item deleted")


@router.post("/goods-issues/{issue_id}/complete", response_model=MessageResponse)
async def complete_goods_issue(
    issue_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(GOODS_ISSUE_WRITE_PERMISSION)),
) -> MessageResponse:
    item = (await db.execute(select(GoodsIssue).where(GoodsIssue.id == issue_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods issue not found")

    _ensure_draft("Goods issue", item.status)

    issue_items = list(
        (await db.execute(select(GoodsIssueItem).where(GoodsIssueItem.goods_issue_id == issue_id))).scalars()
    )
    if not issue_items:
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE,
            detail="Goods issue has no items",
        )

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

        await evaluate_alerts(
            db,
            trigger="goods_issue_completed",
            scoped_product_ids=touched_product_ids or None,
        )
        await db.commit()
    except HTTPException:
        await db.rollback()
        raise

    return MessageResponse(message="goods issue completed")


@router.post("/goods-issues/{issue_id}/cancel", response_model=MessageResponse)
async def cancel_goods_issue(
    issue_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(GOODS_ISSUE_WRITE_PERMISSION)),
) -> MessageResponse:
    item = (await db.execute(select(GoodsIssue).where(GoodsIssue.id == issue_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods issue not found")

    _ensure_draft("Goods issue", item.status)

    item.status = "cancelled"
    await db.commit()
    return MessageResponse(message="goods issue cancelled")
