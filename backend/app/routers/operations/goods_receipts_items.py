# ruff: noqa: F403, F405
from .common import *


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
