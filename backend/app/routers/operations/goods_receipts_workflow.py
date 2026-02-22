# ruff: noqa: F403, F405
from .common import *


@router.post("/goods-receipts/{receipt_id}/complete", response_model=MessageResponse)
async def complete_goods_receipt(
    receipt_id: int,
    payload: CompletionSignoffPayload | None = None,
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

    operation_signoff = await build_operation_signoff(
        db=db,
        payload=payload,
        current_user=current_user,
        operation_type="goods_receipt",
        operation_id=item.id,
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
        if operation_signoff is not None:
            db.add(operation_signoff)

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
