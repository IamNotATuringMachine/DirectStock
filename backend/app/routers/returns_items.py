# ruff: noqa: F403, F405
from .returns_common import *


@router.get("/{order_id}/items", response_model=list[ReturnOrderItemResponse])
async def list_return_order_items(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(RETURNS_READ_PERMISSION)),
) -> list[ReturnOrderItemResponse]:
    await _load_order_or_404(db, order_id)
    rows = list(
        (
            await db.execute(
                select(ReturnOrderItem)
                .where(ReturnOrderItem.return_order_id == order_id)
                .order_by(ReturnOrderItem.id.asc())
            )
        ).scalars()
    )
    return [_to_item_response(item) for item in rows]


@router.post("/{order_id}/items", response_model=ReturnOrderItemResponse, status_code=status.HTTP_201_CREATED)
async def create_return_order_item(
    order_id: int,
    payload: ReturnOrderItemCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(RETURNS_WRITE_PERMISSION)),
) -> ReturnOrderItemResponse:
    order = await _load_order_or_404(db, order_id)
    if order.status in {"resolved", "cancelled"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Return order is not editable")

    product = (await db.execute(select(Product).where(Product.id == payload.product_id))).scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    if payload.target_bin_id is not None:
        await _ensure_bin_exists(db, bin_id=payload.target_bin_id)

    values = _normalize_item_repair_state(payload.model_dump(), existing=None)
    item = ReturnOrderItem(return_order_id=order_id, **values)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return _to_item_response(item)


@router.put("/{order_id}/items/{item_id}", response_model=ReturnOrderItemResponse)
async def update_return_order_item(
    order_id: int,
    item_id: int,
    payload: ReturnOrderItemUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(RETURNS_WRITE_PERMISSION)),
) -> ReturnOrderItemResponse:
    order = await _load_order_or_404(db, order_id)
    if order.status in {"resolved", "cancelled"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Return order is not editable")

    item = await _load_item_or_404(db, order_id, item_id)
    updates = payload.model_dump(exclude_unset=True)

    target_bin_id = updates.get("target_bin_id")
    if target_bin_id is not None:
        await _ensure_bin_exists(db, bin_id=target_bin_id)

    updates = _normalize_item_repair_state(updates, existing=item)

    for key, value in updates.items():
        setattr(item, key, value)

    await db.commit()
    await db.refresh(item)
    return _to_item_response(item)


@router.delete("/{order_id}/items/{item_id}", response_model=MessageResponse)
async def delete_return_order_item(
    order_id: int,
    item_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(RETURNS_WRITE_PERMISSION)),
) -> MessageResponse:
    order = await _load_order_or_404(db, order_id)
    if order.status in {"resolved", "cancelled"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Return order is not editable")

    item = await _load_item_or_404(db, order_id, item_id)
    await db.delete(item)
    await db.commit()
    return MessageResponse(message="return order item deleted")


@router.post(
    "/{order_id}/items/{item_id}/dispatch-external",
    response_model=ReturnOrderExternalDispatchResponse,
)
async def dispatch_return_order_item_external(
    order_id: int,
    item_id: int,
    payload: ReturnOrderExternalDispatchPayload | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(RETURNS_WRITE_PERMISSION)),
) -> ReturnOrderExternalDispatchResponse:
    order = await _load_order_or_404(db, order_id)
    if order.status in {"resolved", "cancelled"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Return order does not allow external dispatch in current status",
        )

    item = await _load_item_or_404(db, order_id, item_id)
    _ensure_external_dispatch_prerequisites(item)

    now = _now()
    spain_bin = await _ensure_spain_external_bin(db)

    spain_inventory = await _get_inventory_or_create(
        db,
        product_id=item.product_id,
        bin_id=spain_bin.id,
        unit=item.unit,
    )
    spain_inventory.quantity = Decimal(spain_inventory.quantity) + Decimal(item.quantity)

    if payload is not None and payload.external_partner:
        item.external_partner = payload.external_partner
    item.external_status = "at_external_provider"
    item.external_dispatched_at = now

    db.add(
        StockMovement(
            movement_type="return_external_dispatch",
            reference_type="return_order",
            reference_number=order.return_number,
            product_id=item.product_id,
            from_bin_id=item.target_bin_id,
            to_bin_id=spain_bin.id,
            quantity=item.quantity,
            performed_by=current_user.id,
            performed_at=now,
            metadata_json={
                "return_order_id": order.id,
                "return_order_item_id": item.id,
                "external_partner": item.external_partner,
            },
        )
    )

    repair_form = _build_external_repair_form_pdf(
        order=order,
        item=item,
        external_partner=item.external_partner,
    )
    version = (
        await db.execute(
            select(func.coalesce(func.max(Document.version), 0)).where(
                Document.entity_type == "return_order",
                Document.entity_id == order.id,
                Document.document_type == EXTERNAL_REPAIR_DOCUMENT_TYPE,
            )
        )
    ).scalar_one()
    next_version = int(version) + 1
    storage_dir = _effective_storage_root() / "return_order" / str(order.id) / EXTERNAL_REPAIR_DOCUMENT_TYPE
    storage_dir.mkdir(parents=True, exist_ok=True)
    file_name = f"{order.return_number}-externes-reparaturformular.pdf"
    storage_path = storage_dir / f"v{next_version:03d}_{token_hex(4)}_{file_name}"
    storage_path.write_bytes(repair_form)

    document = Document(
        entity_type="return_order",
        entity_id=order.id,
        document_type=EXTERNAL_REPAIR_DOCUMENT_TYPE,
        file_name=file_name,
        mime_type="application/pdf",
        file_size=len(repair_form),
        storage_path=str(storage_path),
        version=next_version,
        uploaded_by=current_user.id,
    )
    db.add(document)

    await db.commit()
    await db.refresh(item)
    await db.refresh(document)
    return ReturnOrderExternalDispatchResponse(
        item=_to_item_response(item),
        document_id=document.id,
    )


@router.post(
    "/{order_id}/items/{item_id}/receive-external",
    response_model=ReturnOrderItemResponse,
)
async def receive_return_order_item_external(
    order_id: int,
    item_id: int,
    payload: ReturnOrderExternalReceivePayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(RETURNS_WRITE_PERMISSION)),
) -> ReturnOrderItemResponse:
    order = await _load_order_or_404(db, order_id)
    if order.status in {"resolved", "cancelled"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Return order does not allow external receive in current status",
        )

    item = await _load_item_or_404(db, order_id, item_id)
    _ensure_external_receive_prerequisites(item)

    target_bin = await _ensure_bin_exists(db, bin_id=payload.target_bin_id)
    source_bin = await _ensure_spain_external_bin(db)
    now = _now()

    spain_inventory = (
        await db.execute(
            select(Inventory).where(
                Inventory.product_id == item.product_id,
                Inventory.bin_location_id == source_bin.id,
            )
        )
    ).scalar_one_or_none()
    if spain_inventory is None or Decimal(spain_inventory.quantity) < Decimal(item.quantity):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Insufficient quantity in external provider virtual bin",
        )
    spain_inventory.quantity = Decimal(spain_inventory.quantity) - Decimal(item.quantity)

    target_inventory = await _get_inventory_or_create(
        db,
        product_id=item.product_id,
        bin_id=target_bin.id,
        unit=item.unit,
    )
    target_inventory.quantity = Decimal(target_inventory.quantity) + Decimal(item.quantity)

    db.add(
        StockMovement(
            movement_type="return_external_receive",
            reference_type="return_order",
            reference_number=order.return_number,
            product_id=item.product_id,
            from_bin_id=source_bin.id,
            to_bin_id=target_bin.id,
            quantity=item.quantity,
            performed_by=current_user.id,
            performed_at=now,
            metadata_json={
                "return_order_id": order.id,
                "return_order_item_id": item.id,
                "external_partner": item.external_partner,
            },
        )
    )

    item.target_bin_id = payload.target_bin_id
    item.external_status = "ready_for_use"
    item.external_returned_at = now

    await db.commit()
    await db.refresh(item)
    return _to_item_response(item)
