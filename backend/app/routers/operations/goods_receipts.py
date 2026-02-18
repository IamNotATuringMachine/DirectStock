from .common import *


@router.get("/goods-receipts", response_model=list[GoodsReceiptResponse])
async def list_goods_receipts(
    status_filter: str | None = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(GOODS_RECEIPT_READ_PERMISSION)),
) -> list[GoodsReceiptResponse]:
    stmt = select(GoodsReceipt).order_by(GoodsReceipt.id.desc())
    if status_filter:
        stmt = stmt.where(GoodsReceipt.status == status_filter)
    rows = list((await db.execute(stmt)).scalars())
    return [_to_goods_receipt_response(item) for item in rows]


@router.post("/goods-receipts", response_model=GoodsReceiptResponse, status_code=status.HTTP_201_CREATED)
async def create_goods_receipt(
    payload: GoodsReceiptCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(GOODS_RECEIPT_WRITE_PERMISSION)),
) -> GoodsReceiptResponse:
    mode = _resolve_receipt_mode(
        explicit_mode=payload.mode,
        purchase_order_id=payload.purchase_order_id,
    )
    source_type = _resolve_receipt_source_type(
        explicit_source_type=payload.source_type,
        mode=mode,
    )
    _validate_receipt_mode_constraints(mode=mode, purchase_order_id=payload.purchase_order_id)

    purchase_order: PurchaseOrder | None = None
    if payload.purchase_order_id is not None:
        purchase_order = await _get_purchase_order_or_404(
            db,
            purchase_order_id=payload.purchase_order_id,
        )
        _ensure_purchase_order_ready_for_receipt(purchase_order)
        if payload.supplier_id is not None and purchase_order.supplier_id != payload.supplier_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Supplier does not match linked purchase order",
            )

    item = GoodsReceipt(
        receipt_number=payload.receipt_number or _generate_number("WE"),
        supplier_id=payload.supplier_id
        if payload.supplier_id is not None
        else purchase_order.supplier_id
        if purchase_order
        else None,
        purchase_order_id=payload.purchase_order_id,
        mode=mode,
        source_type=source_type,
        notes=payload.notes,
        created_by=current_user.id,
    )
    db.add(item)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Goods receipt already exists") from exc

    await db.refresh(item)
    return _to_goods_receipt_response(item)


@router.get("/products/{product_id}/bin-suggestions", response_model=list[BinSuggestion])
async def get_product_bin_suggestions(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(GOODS_RECEIPT_READ_PERMISSION)),
) -> list[BinSuggestion]:
    product = (await db.execute(select(Product).where(Product.id == product_id))).scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    suggestions: list[BinSuggestion] = []
    seen_bin_ids: set[int] = set()

    if product.default_bin_id is not None:
        row = (
            await db.execute(
                select(BinLocation, WarehouseZone, Warehouse)
                .join(WarehouseZone, BinLocation.zone_id == WarehouseZone.id)
                .join(Warehouse, WarehouseZone.warehouse_id == Warehouse.id)
                .where(BinLocation.id == product.default_bin_id)
            )
        ).one_or_none()
        if row is not None:
            bin_loc, zone, warehouse = row
            inv = (
                await db.execute(
                    select(Inventory).where(
                        Inventory.product_id == product_id,
                        Inventory.bin_location_id == bin_loc.id,
                    )
                )
            ).scalar_one_or_none()
            suggestions.append(
                BinSuggestion(
                    bin_id=bin_loc.id,
                    bin_code=bin_loc.code,
                    zone_id=zone.id,
                    zone_code=zone.code,
                    warehouse_id=warehouse.id,
                    warehouse_code=warehouse.code,
                    priority="default",
                    current_quantity=Decimal(inv.quantity) if inv else Decimal("0"),
                )
            )
            seen_bin_ids.add(bin_loc.id)

    existing_rows = list(
        (
            await db.execute(
                select(Inventory, BinLocation, WarehouseZone, Warehouse)
                .join(BinLocation, Inventory.bin_location_id == BinLocation.id)
                .join(WarehouseZone, BinLocation.zone_id == WarehouseZone.id)
                .join(Warehouse, WarehouseZone.warehouse_id == Warehouse.id)
                .where(
                    Inventory.product_id == product_id,
                    Inventory.quantity > 0,
                )
                .order_by(Inventory.quantity.desc())
                .limit(5)
            )
        ).all()
    )
    for inv, bin_loc, zone, warehouse in existing_rows:
        if bin_loc.id in seen_bin_ids:
            continue
        suggestions.append(
            BinSuggestion(
                bin_id=bin_loc.id,
                bin_code=bin_loc.code,
                zone_id=zone.id,
                zone_code=zone.code,
                warehouse_id=warehouse.id,
                warehouse_code=warehouse.code,
                priority="existing",
                current_quantity=Decimal(inv.quantity),
            )
        )
        seen_bin_ids.add(bin_loc.id)

    return suggestions


@router.post(
    "/goods-receipts/from-po/{po_id}",
    response_model=GoodsReceiptResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_goods_receipt_from_po(
    po_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(GOODS_RECEIPT_WRITE_PERMISSION)),
) -> GoodsReceiptResponse:
    purchase_order = (await db.execute(select(PurchaseOrder).where(PurchaseOrder.id == po_id))).scalar_one_or_none()
    if purchase_order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")

    _ensure_purchase_order_ready_for_receipt(purchase_order)

    existing_receipt = (
        await db.execute(
            select(GoodsReceipt).where(
                GoodsReceipt.purchase_order_id == po_id,
                GoodsReceipt.status == "draft",
            )
        )
    ).scalar_one_or_none()
    if existing_receipt is not None:
        return _to_goods_receipt_response(existing_receipt)

    receipt = GoodsReceipt(
        receipt_number=_generate_number("WE"),
        purchase_order_id=po_id,
        supplier_id=purchase_order.supplier_id,
        mode="po",
        source_type="supplier",
        created_by=current_user.id,
    )
    db.add(receipt)
    await db.flush()

    po_items = list(
        (await db.execute(select(PurchaseOrderItem).where(PurchaseOrderItem.purchase_order_id == po_id))).scalars()
    )
    for po_item in po_items:
        remaining = Decimal(po_item.ordered_quantity) - Decimal(po_item.received_quantity)
        if remaining > 0:
            db.add(
                GoodsReceiptItem(
                    goods_receipt_id=receipt.id,
                    product_id=po_item.product_id,
                    expected_quantity=remaining,
                    received_quantity=Decimal("0"),
                    unit=po_item.unit,
                    purchase_order_item_id=po_item.id,
                    input_method="manual",
                    condition="new",
                )
            )

    await db.commit()
    await db.refresh(receipt)
    return _to_goods_receipt_response(receipt)


@router.get("/goods-receipts/{receipt_id}", response_model=GoodsReceiptResponse)
async def get_goods_receipt(
    receipt_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(GOODS_RECEIPT_READ_PERMISSION)),
) -> GoodsReceiptResponse:
    item = (await db.execute(select(GoodsReceipt).where(GoodsReceipt.id == receipt_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods receipt not found")
    return _to_goods_receipt_response(item)


@router.put("/goods-receipts/{receipt_id}", response_model=GoodsReceiptResponse)
async def update_goods_receipt(
    receipt_id: int,
    payload: GoodsReceiptUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(GOODS_RECEIPT_WRITE_PERMISSION)),
) -> GoodsReceiptResponse:
    item = (await db.execute(select(GoodsReceipt).where(GoodsReceipt.id == receipt_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods receipt not found")

    _ensure_draft("Goods receipt", item.status)

    updates = payload.model_dump(exclude_unset=True)
    purchase_order_id = updates.get("purchase_order_id", item.purchase_order_id)
    mode = updates.get("mode", item.mode)
    source_type = updates.get("source_type", item.source_type)
    _validate_receipt_mode_constraints(mode=mode, purchase_order_id=purchase_order_id)

    if "mode" in updates and "source_type" not in updates:
        updates["source_type"] = _resolve_receipt_source_type(
            explicit_source_type=None,
            mode=mode,
        )
    elif source_type is not None:
        updates["source_type"] = source_type

    supplier_id = updates.get("supplier_id", item.supplier_id)
    if purchase_order_id is not None:
        purchase_order = await _get_purchase_order_or_404(
            db,
            purchase_order_id=purchase_order_id,
        )
        _ensure_purchase_order_ready_for_receipt(purchase_order)
        if supplier_id is not None and purchase_order.supplier_id != supplier_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Supplier does not match linked purchase order",
            )

    for key, value in updates.items():
        setattr(item, key, value)

    await db.commit()
    await db.refresh(item)
    return _to_goods_receipt_response(item)


@router.delete("/goods-receipts/{receipt_id}", response_model=MessageResponse)
async def delete_goods_receipt(
    receipt_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(GOODS_RECEIPT_WRITE_PERMISSION)),
) -> MessageResponse:
    item = (await db.execute(select(GoodsReceipt).where(GoodsReceipt.id == receipt_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods receipt not found")

    _ensure_draft("Goods receipt", item.status)

    await db.delete(item)
    await db.commit()
    return MessageResponse(message="goods receipt deleted")


@router.get("/goods-receipts/{receipt_id}/items", response_model=list[GoodsReceiptItemResponse])
async def list_goods_receipt_items(
    receipt_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(GOODS_RECEIPT_READ_PERMISSION)),
) -> list[GoodsReceiptItemResponse]:
    parent = (await db.execute(select(GoodsReceipt).where(GoodsReceipt.id == receipt_id))).scalar_one_or_none()
    if parent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods receipt not found")

    rows = list(
        (
            await db.execute(
                select(GoodsReceiptItem)
                .where(GoodsReceiptItem.goods_receipt_id == receipt_id)
                .order_by(GoodsReceiptItem.id.asc())
            )
        ).scalars()
    )
    product_cache: dict[int, Product] = {}
    bin_cache: dict[int, BinLocation] = {}
    purchase_order_item_cache: dict[int, PurchaseOrderItem] = {}
    return [
        await _build_goods_receipt_item_response(
            db,
            item,
            product_cache=product_cache,
            bin_cache=bin_cache,
            purchase_order_item_cache=purchase_order_item_cache,
        )
        for item in rows
    ]


@router.post(
    "/goods-receipts/{receipt_id}/items",
    response_model=GoodsReceiptItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_goods_receipt_item(
    receipt_id: int,
    payload: GoodsReceiptItemCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(GOODS_RECEIPT_WRITE_PERMISSION)),
) -> GoodsReceiptItemResponse:
    parent = (await db.execute(select(GoodsReceipt).where(GoodsReceipt.id == receipt_id))).scalar_one_or_none()
    if parent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods receipt not found")

    _ensure_draft("Goods receipt", parent.status)

    values = payload.model_dump()
    input_method = values.get("input_method") or "manual"
    values["input_method"] = input_method

    condition = values.get("condition")
    if _is_condition_required_for_receipt(parent):
        if condition is None:
            raise HTTPException(
                status_code=HTTP_422_UNPROCESSABLE,
                detail="condition is required when goods receipt mode is 'free'",
            )
    else:
        values["condition"] = condition or "new"
    if values.get("condition") is None:
        values["condition"] = "new"

    serial_numbers = _normalize_serial_numbers(values.get("serial_numbers"))
    values["serial_numbers"] = serial_numbers or None

    if (values.get("expiry_date") or values.get("manufactured_at")) and not values.get("batch_number"):
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE,
            detail="batch_number is required when expiry_date or manufactured_at is set",
        )

    purchase_order_item_id = values.get("purchase_order_item_id")
    if purchase_order_item_id is not None:
        purchase_order_item = await _get_purchase_order_item_or_404(
            db,
            purchase_order_item_id=purchase_order_item_id,
        )
        if purchase_order_item.product_id != values["product_id"]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Purchase order item does not match goods receipt item product",
            )
        if parent.purchase_order_id is not None and purchase_order_item.purchase_order_id != parent.purchase_order_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Purchase order item does not belong to linked purchase order",
            )
    elif parent.purchase_order_id is not None:
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE,
            detail="purchase_order_item_id is required when goods receipt is linked to a purchase order",
        )

    item = GoodsReceiptItem(goods_receipt_id=receipt_id, **values)
    db.add(item)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Conflict while creating receipt item"
        ) from exc

    await db.refresh(item)
    return await _build_goods_receipt_item_response(db, item)


@router.put(
    "/goods-receipts/{receipt_id}/items/{item_id}",
    response_model=GoodsReceiptItemResponse,
)
async def update_goods_receipt_item(
    receipt_id: int,
    item_id: int,
    payload: GoodsReceiptItemUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(GOODS_RECEIPT_WRITE_PERMISSION)),
) -> GoodsReceiptItemResponse:
    parent = (await db.execute(select(GoodsReceipt).where(GoodsReceipt.id == receipt_id))).scalar_one_or_none()
    if parent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods receipt not found")

    _ensure_draft("Goods receipt", parent.status)

    item = (
        await db.execute(
            select(GoodsReceiptItem).where(
                GoodsReceiptItem.id == item_id,
                GoodsReceiptItem.goods_receipt_id == receipt_id,
            )
        )
    ).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods receipt item not found")

    updates = payload.model_dump(exclude_unset=True)
    if updates.get("use_fefo") is None:
        updates.pop("use_fefo", None)
    if "input_method" in updates and updates["input_method"] is None:
        updates.pop("input_method", None)
    if "serial_numbers" in updates:
        serial_numbers = _normalize_serial_numbers(updates.get("serial_numbers"))
        updates["serial_numbers"] = serial_numbers or None
    if "condition" in updates and updates["condition"] is None:
        if _is_condition_required_for_receipt(parent):
            raise HTTPException(
                status_code=HTTP_422_UNPROCESSABLE,
                detail="condition is required when goods receipt mode is 'free'",
            )
        updates["condition"] = "new"
    if _is_condition_required_for_receipt(parent):
        candidate_condition = updates.get("condition", item.condition)
        if candidate_condition is None:
            raise HTTPException(
                status_code=HTTP_422_UNPROCESSABLE,
                detail="condition is required when goods receipt mode is 'free'",
            )
    candidate_batch_number = updates.get("batch_number", item.batch_number)
    candidate_expiry = updates.get("expiry_date", item.expiry_date)
    candidate_manufactured = updates.get("manufactured_at", item.manufactured_at)
    if (candidate_expiry or candidate_manufactured) and not candidate_batch_number:
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE,
            detail="batch_number is required when expiry_date or manufactured_at is set",
        )

    if "purchase_order_item_id" in updates and updates["purchase_order_item_id"] is not None:
        purchase_order_item = await _get_purchase_order_item_or_404(
            db,
            purchase_order_item_id=updates["purchase_order_item_id"],
        )
        if purchase_order_item.product_id != item.product_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Purchase order item does not match goods receipt item product",
            )
        if parent.purchase_order_id is not None and purchase_order_item.purchase_order_id != parent.purchase_order_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Purchase order item does not belong to linked purchase order",
            )
    if parent.purchase_order_id is not None:
        candidate_purchase_order_item_id = updates.get("purchase_order_item_id", item.purchase_order_item_id)
        if candidate_purchase_order_item_id is None:
            raise HTTPException(
                status_code=HTTP_422_UNPROCESSABLE,
                detail="purchase_order_item_id is required when goods receipt is linked to a purchase order",
            )

    for key, value in updates.items():
        setattr(item, key, value)

    await db.commit()
    await db.refresh(item)
    return await _build_goods_receipt_item_response(db, item)


@router.delete("/goods-receipts/{receipt_id}/items/{item_id}", response_model=MessageResponse)
async def delete_goods_receipt_item(
    receipt_id: int,
    item_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(GOODS_RECEIPT_WRITE_PERMISSION)),
) -> MessageResponse:
    parent = (await db.execute(select(GoodsReceipt).where(GoodsReceipt.id == receipt_id))).scalar_one_or_none()
    if parent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods receipt not found")

    _ensure_draft("Goods receipt", parent.status)

    item = (
        await db.execute(
            select(GoodsReceiptItem).where(
                GoodsReceiptItem.id == item_id,
                GoodsReceiptItem.goods_receipt_id == receipt_id,
            )
        )
    ).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods receipt item not found")

    await db.delete(item)
    await db.commit()
    return MessageResponse(message="goods receipt item deleted")


@router.post(
    "/goods-receipts/{receipt_id}/ad-hoc-product",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_goods_receipt_adhoc_product(
    receipt_id: int,
    payload: ProductAdHocCreate,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_permissions("module.products.quick_create", GOODS_RECEIPT_WRITE_PERMISSION)),
) -> ProductResponse:
    receipt = (await db.execute(select(GoodsReceipt).where(GoodsReceipt.id == receipt_id))).scalar_one_or_none()
    if receipt is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods receipt not found")
    _ensure_draft("Goods receipt", receipt.status)

    group_name = _normalize_group_name(payload.product_group_name)
    if payload.product_group_id is not None and group_name is not None:
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE,
            detail="Provide either product_group_id or product_group_name, not both",
        )

    group_id = payload.product_group_id
    if group_name is not None:
        group = (await db.execute(select(ProductGroup).where(ProductGroup.name == group_name))).scalar_one_or_none()
        if group is None:
            group = ProductGroup(name=group_name, description=None, is_active=True)
            db.add(group)
            try:
                await db.flush()
            except IntegrityError as exc:
                await db.rollback()
                group = (
                    await db.execute(select(ProductGroup).where(ProductGroup.name == group_name))
                ).scalar_one_or_none()
                if group is None:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Conflict while creating product group",
                    ) from exc
        group_id = group.id

    product_payload = payload.model_dump(exclude={"product_group_name"})
    product_payload["product_group_id"] = group_id
    product = Product(**product_payload)
    db.add(product)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Product already exists") from exc

    product = (
        await db.execute(select(Product).where(Product.id == product.id).options(joinedload(Product.group)))
    ).scalar_one()
    return _to_product_response(product)


@router.post("/goods-receipts/{receipt_id}/complete", response_model=MessageResponse)
async def complete_goods_receipt(
    receipt_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(GOODS_RECEIPT_WRITE_PERMISSION)),
) -> MessageResponse:
    item = (await db.execute(select(GoodsReceipt).where(GoodsReceipt.id == receipt_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods receipt not found")

    _ensure_draft("Goods receipt", item.status)

    receipt_items = list(
        (await db.execute(select(GoodsReceiptItem).where(GoodsReceiptItem.goods_receipt_id == receipt_id))).scalars()
    )
    if not receipt_items:
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE,
            detail="Goods receipt has no items",
        )

    now = _now()
    touched_product_ids: set[int] = set()
    touched_purchase_order_ids: set[int] = set()
    purchase_order_item_cache: dict[int, PurchaseOrderItem] = {}
    purchase_order_cache: dict[int, PurchaseOrder] = {}
    product_cache: dict[int, Product] = {}
    linked_purchase_order: PurchaseOrder | None = None
    if item.purchase_order_id is not None:
        linked_purchase_order = await _get_purchase_order_or_404(
            db,
            purchase_order_id=item.purchase_order_id,
        )
        _ensure_purchase_order_ready_for_receipt(linked_purchase_order)
    non_new_items = [ri for ri in receipt_items if (ri.condition or "new") != "new"]
    repair_bin: BinLocation | None = None
    if non_new_items:
        repair_bin = await _get_repair_center_bin_or_422(db)

    try:
        for receipt_item in receipt_items:
            effective_target_bin_id = receipt_item.target_bin_id
            if (receipt_item.condition or "new") != "new":
                effective_target_bin_id = repair_bin.id if repair_bin else None

            if effective_target_bin_id is None:
                raise HTTPException(
                    status_code=HTTP_422_UNPROCESSABLE,
                    detail=f"Receipt item {receipt_item.id} has no effective target bin",
                )

            quantity = Decimal(receipt_item.received_quantity)
            if quantity <= 0:
                raise HTTPException(
                    status_code=HTTP_422_UNPROCESSABLE,
                    detail=f"Receipt item {receipt_item.id} has invalid received quantity",
                )

            serial_numbers = _normalize_serial_numbers(receipt_item.serial_numbers)
            product = product_cache.get(receipt_item.product_id)
            if product is None:
                product = (
                    await db.execute(select(Product).where(Product.id == receipt_item.product_id))
                ).scalar_one_or_none()
                if product is None:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
                product_cache[receipt_item.product_id] = product

            if product.requires_item_tracking:
                if not serial_numbers:
                    raise HTTPException(
                        status_code=HTTP_422_UNPROCESSABLE,
                        detail=f"Receipt item {receipt_item.id} requires serial numbers for tracked product",
                    )
                _ensure_serial_tracked_quantity_is_integer(
                    quantity,
                    item_label=f"Receipt item {receipt_item.id}",
                )
            _ensure_quantity_matches_serials(quantity, serial_numbers, item_label=f"Receipt item {receipt_item.id}")

            purchase_order_item: PurchaseOrderItem | None = None
            if receipt_item.purchase_order_item_id is not None:
                purchase_order_item = purchase_order_item_cache.get(receipt_item.purchase_order_item_id)
                if purchase_order_item is None:
                    purchase_order_item = await _get_purchase_order_item_or_404(
                        db,
                        purchase_order_item_id=receipt_item.purchase_order_item_id,
                    )
                    purchase_order_item_cache[receipt_item.purchase_order_item_id] = purchase_order_item

                if purchase_order_item.product_id != receipt_item.product_id:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Receipt item {receipt_item.id} references a purchase order item with different product",
                    )
                if (
                    linked_purchase_order is not None
                    and purchase_order_item.purchase_order_id != linked_purchase_order.id
                ):
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Receipt item {receipt_item.id} does not belong to linked purchase order",
                    )

                purchase_order = purchase_order_cache.get(purchase_order_item.purchase_order_id)
                if purchase_order is None:
                    purchase_order = (
                        await db.execute(
                            select(PurchaseOrder).where(PurchaseOrder.id == purchase_order_item.purchase_order_id)
                        )
                    ).scalar_one_or_none()
                    if purchase_order is None:
                        raise HTTPException(
                            status_code=status.HTTP_404_NOT_FOUND,
                            detail="Purchase order not found",
                        )
                    purchase_order_cache[purchase_order.id] = purchase_order

                _ensure_purchase_order_ready_for_receipt(purchase_order)

                next_received = Decimal(purchase_order_item.received_quantity) + quantity
                if next_received > Decimal(purchase_order_item.ordered_quantity):
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Goods receipt quantity exceeds open quantity for purchase order item {purchase_order_item.id}",
                    )
                purchase_order_item.received_quantity = next_received
                touched_purchase_order_ids.add(purchase_order.id)
            elif linked_purchase_order is not None:
                raise HTTPException(
                    status_code=HTTP_422_UNPROCESSABLE,
                    detail=f"Receipt item {receipt_item.id} requires purchase_order_item_id for linked purchase order",
                )

            inventory = await _get_inventory(
                db,
                product_id=receipt_item.product_id,
                bin_location_id=effective_target_bin_id,
                unit=receipt_item.unit,
            )
            inventory.quantity = Decimal(inventory.quantity) + quantity

            batch: InventoryBatch | None = None
            if receipt_item.batch_number:
                batch = await _get_inventory_batch(
                    db,
                    product_id=receipt_item.product_id,
                    bin_location_id=effective_target_bin_id,
                    batch_number=receipt_item.batch_number,
                    unit=receipt_item.unit,
                    expiry_date=receipt_item.expiry_date,
                    manufactured_at=receipt_item.manufactured_at,
                )
                batch.quantity = Decimal(batch.quantity) + quantity
            elif receipt_item.expiry_date or receipt_item.manufactured_at:
                raise HTTPException(
                    status_code=HTTP_422_UNPROCESSABLE,
                    detail=f"Receipt item {receipt_item.id} requires batch_number for date tracking",
                )

            if serial_numbers:
                existing_rows = list(
                    (
                        await db.execute(
                            select(SerialNumber.serial_number).where(SerialNumber.serial_number.in_(serial_numbers))
                        )
                    ).scalars()
                )
                if existing_rows:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Serial number already exists: {existing_rows[0]}",
                    )
                for serial_number in serial_numbers:
                    db.add(
                        SerialNumber(
                            product_id=receipt_item.product_id,
                            serial_number=serial_number,
                            batch_id=batch.id if batch else None,
                            current_bin_id=effective_target_bin_id,
                            status="in_stock",
                            last_movement_at=now,
                        )
                    )

            db.add(
                StockMovement(
                    movement_type="goods_receipt",
                    reference_type="goods_receipt",
                    reference_number=item.receipt_number,
                    product_id=receipt_item.product_id,
                    from_bin_id=None,
                    to_bin_id=effective_target_bin_id,
                    quantity=quantity,
                    performed_by=current_user.id,
                    performed_at=now,
                    metadata_json={
                        "goods_receipt_id": item.id,
                        "goods_receipt_item_id": receipt_item.id,
                        "purchase_order_item_id": receipt_item.purchase_order_item_id,
                        "batch_number": receipt_item.batch_number,
                        "serial_numbers": serial_numbers or None,
                        "condition": receipt_item.condition,
                        "original_target_bin_id": receipt_item.target_bin_id,
                    },
                )
            )
            touched_product_ids.add(receipt_item.product_id)

        await db.flush()
        for purchase_order_id in touched_purchase_order_ids:
            purchase_order = purchase_order_cache[purchase_order_id]
            order_items = list(
                (
                    await db.execute(
                        select(PurchaseOrderItem).where(PurchaseOrderItem.purchase_order_id == purchase_order_id)
                    )
                ).scalars()
            )
            all_received = bool(order_items) and all(
                Decimal(order_item.received_quantity) >= Decimal(order_item.ordered_quantity)
                for order_item in order_items
            )
            any_received = any(Decimal(order_item.received_quantity) > 0 for order_item in order_items)
            if all_received:
                purchase_order.status = "completed"
                purchase_order.completed_at = now
            elif any_received:
                purchase_order.status = "partially_received"
                purchase_order.completed_at = None

        item.status = "completed"
        item.completed_at = now
        if item.received_at is None:
            item.received_at = now

        if non_new_items:
            return_order = ReturnOrder(
                return_number=_generate_number("RT"),
                source_type="technician",
                source_reference=item.receipt_number,
                status="registered",
                registered_at=now,
                created_by=current_user.id,
            )
            db.add(return_order)
            await db.flush()

            for ri in non_new_items:
                db.add(
                    ReturnOrderItem(
                        return_order_id=return_order.id,
                        product_id=ri.product_id,
                        quantity=ri.received_quantity,
                        unit=ri.unit,
                        decision="repair",
                        reason=f"Zustand bei Wareneingang: {ri.condition}",
                        target_bin_id=repair_bin.id if repair_bin else None,
                    )
                )

        await evaluate_alerts(
            db,
            trigger="goods_receipt_completed",
            scoped_product_ids=touched_product_ids or None,
        )
        await db.commit()
    except HTTPException:
        await db.rollback()
        raise

    return MessageResponse(message="goods receipt completed")


@router.post("/goods-receipts/{receipt_id}/cancel", response_model=MessageResponse)
async def cancel_goods_receipt(
    receipt_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(GOODS_RECEIPT_WRITE_PERMISSION)),
) -> MessageResponse:
    item = (await db.execute(select(GoodsReceipt).where(GoodsReceipt.id == receipt_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods receipt not found")

    _ensure_draft("Goods receipt", item.status)

    item.status = "cancelled"
    await db.commit()
    return MessageResponse(message="goods receipt cancelled")
