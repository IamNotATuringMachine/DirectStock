from .common import *
from .stock_transfers_workflow import complete_stock_transfer_workflow


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

    await complete_stock_transfer_workflow(
        db=db,
        transfer=item,
        current_user_id=current_user.id,
    )

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
