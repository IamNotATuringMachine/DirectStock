# ruff: noqa: F403, F405
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
