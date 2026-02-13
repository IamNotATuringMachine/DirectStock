from datetime import UTC, datetime
from decimal import Decimal
from secrets import token_hex

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, require_roles
from app.models.auth import User
from app.models.inventory import (
    GoodsIssue,
    GoodsIssueItem,
    GoodsReceipt,
    GoodsReceiptItem,
    Inventory,
    StockMovement,
    StockTransfer,
    StockTransferItem,
)
from app.schemas.operations import (
    GoodsIssueCreate,
    GoodsIssueItemCreate,
    GoodsIssueItemResponse,
    GoodsIssueItemUpdate,
    GoodsIssueResponse,
    GoodsIssueUpdate,
    GoodsReceiptCreate,
    GoodsReceiptItemCreate,
    GoodsReceiptItemResponse,
    GoodsReceiptItemUpdate,
    GoodsReceiptResponse,
    GoodsReceiptUpdate,
    StockTransferCreate,
    StockTransferItemCreate,
    StockTransferItemResponse,
    StockTransferItemUpdate,
    StockTransferResponse,
    StockTransferUpdate,
)
from app.schemas.user import MessageResponse

router = APIRouter(prefix="/api", tags=["operations"])


def _now() -> datetime:
    return datetime.now(UTC)


def _generate_number(prefix: str) -> str:
    return f"{prefix}-{_now().strftime('%Y%m%d%H%M%S')}-{token_hex(2).upper()}"


async def _get_inventory(
    db: AsyncSession,
    *,
    product_id: int,
    bin_location_id: int,
    unit: str,
) -> Inventory:
    stmt = select(Inventory).where(
        Inventory.product_id == product_id,
        Inventory.bin_location_id == bin_location_id,
    )
    inventory = (await db.execute(stmt)).scalar_one_or_none()
    if inventory is None:
        inventory = Inventory(
            product_id=product_id,
            bin_location_id=bin_location_id,
            quantity=Decimal("0"),
            reserved_quantity=Decimal("0"),
            unit=unit,
        )
        db.add(inventory)
        await db.flush()
    return inventory


def _ensure_draft(entity_name: str, current_status: str) -> None:
    if current_status != "draft":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{entity_name} is not in draft status",
        )


def _to_goods_receipt_response(item: GoodsReceipt) -> GoodsReceiptResponse:
    return GoodsReceiptResponse(
        id=item.id,
        receipt_number=item.receipt_number,
        supplier_id=item.supplier_id,
        status=item.status,
        received_at=item.received_at,
        completed_at=item.completed_at,
        created_by=item.created_by,
        notes=item.notes,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _to_goods_receipt_item_response(item: GoodsReceiptItem) -> GoodsReceiptItemResponse:
    return GoodsReceiptItemResponse(
        id=item.id,
        goods_receipt_id=item.goods_receipt_id,
        product_id=item.product_id,
        expected_quantity=item.expected_quantity,
        received_quantity=item.received_quantity,
        unit=item.unit,
        target_bin_id=item.target_bin_id,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _to_goods_issue_response(item: GoodsIssue) -> GoodsIssueResponse:
    return GoodsIssueResponse(
        id=item.id,
        issue_number=item.issue_number,
        customer_reference=item.customer_reference,
        status=item.status,
        issued_at=item.issued_at,
        completed_at=item.completed_at,
        created_by=item.created_by,
        notes=item.notes,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _to_goods_issue_item_response(item: GoodsIssueItem) -> GoodsIssueItemResponse:
    return GoodsIssueItemResponse(
        id=item.id,
        goods_issue_id=item.goods_issue_id,
        product_id=item.product_id,
        requested_quantity=item.requested_quantity,
        issued_quantity=item.issued_quantity,
        unit=item.unit,
        source_bin_id=item.source_bin_id,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _to_stock_transfer_response(item: StockTransfer) -> StockTransferResponse:
    return StockTransferResponse(
        id=item.id,
        transfer_number=item.transfer_number,
        status=item.status,
        transferred_at=item.transferred_at,
        completed_at=item.completed_at,
        created_by=item.created_by,
        notes=item.notes,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _to_stock_transfer_item_response(item: StockTransferItem) -> StockTransferItemResponse:
    return StockTransferItemResponse(
        id=item.id,
        stock_transfer_id=item.stock_transfer_id,
        product_id=item.product_id,
        quantity=item.quantity,
        unit=item.unit,
        from_bin_id=item.from_bin_id,
        to_bin_id=item.to_bin_id,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.get("/goods-receipts", response_model=list[GoodsReceiptResponse])
async def list_goods_receipts(
    status_filter: str | None = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
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
    current_user: User = Depends(require_roles("admin", "lagerleiter", "lagermitarbeiter")),
) -> GoodsReceiptResponse:
    item = GoodsReceipt(
        receipt_number=payload.receipt_number or _generate_number("WE"),
        supplier_id=payload.supplier_id,
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


@router.get("/goods-receipts/{receipt_id}", response_model=GoodsReceiptResponse)
async def get_goods_receipt(
    receipt_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
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
    _=Depends(require_roles("admin", "lagerleiter", "lagermitarbeiter")),
) -> GoodsReceiptResponse:
    item = (await db.execute(select(GoodsReceipt).where(GoodsReceipt.id == receipt_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods receipt not found")

    _ensure_draft("Goods receipt", item.status)

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)

    await db.commit()
    await db.refresh(item)
    return _to_goods_receipt_response(item)


@router.delete("/goods-receipts/{receipt_id}", response_model=MessageResponse)
async def delete_goods_receipt(
    receipt_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles("admin", "lagerleiter", "lagermitarbeiter")),
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
    _=Depends(get_current_user),
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
    return [_to_goods_receipt_item_response(item) for item in rows]


@router.post(
    "/goods-receipts/{receipt_id}/items",
    response_model=GoodsReceiptItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_goods_receipt_item(
    receipt_id: int,
    payload: GoodsReceiptItemCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles("admin", "lagerleiter", "lagermitarbeiter")),
) -> GoodsReceiptItemResponse:
    parent = (await db.execute(select(GoodsReceipt).where(GoodsReceipt.id == receipt_id))).scalar_one_or_none()
    if parent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods receipt not found")

    _ensure_draft("Goods receipt", parent.status)

    item = GoodsReceiptItem(goods_receipt_id=receipt_id, **payload.model_dump())
    db.add(item)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Conflict while creating receipt item") from exc

    await db.refresh(item)
    return _to_goods_receipt_item_response(item)


@router.put(
    "/goods-receipts/{receipt_id}/items/{item_id}",
    response_model=GoodsReceiptItemResponse,
)
async def update_goods_receipt_item(
    receipt_id: int,
    item_id: int,
    payload: GoodsReceiptItemUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles("admin", "lagerleiter", "lagermitarbeiter")),
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

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)

    await db.commit()
    await db.refresh(item)
    return _to_goods_receipt_item_response(item)


@router.delete("/goods-receipts/{receipt_id}/items/{item_id}", response_model=MessageResponse)
async def delete_goods_receipt_item(
    receipt_id: int,
    item_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles("admin", "lagerleiter", "lagermitarbeiter")),
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


@router.post("/goods-receipts/{receipt_id}/complete", response_model=MessageResponse)
async def complete_goods_receipt(
    receipt_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "lagerleiter", "lagermitarbeiter")),
) -> MessageResponse:
    item = (await db.execute(select(GoodsReceipt).where(GoodsReceipt.id == receipt_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods receipt not found")

    _ensure_draft("Goods receipt", item.status)

    receipt_items = list(
        (
            await db.execute(select(GoodsReceiptItem).where(GoodsReceiptItem.goods_receipt_id == receipt_id))
        ).scalars()
    )
    if not receipt_items:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Goods receipt has no items",
        )

    now = _now()

    try:
        for receipt_item in receipt_items:
            if receipt_item.target_bin_id is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Receipt item {receipt_item.id} has no target_bin_id",
                )

            quantity = Decimal(receipt_item.received_quantity)
            if quantity <= 0:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Receipt item {receipt_item.id} has invalid received quantity",
                )

            inventory = await _get_inventory(
                db,
                product_id=receipt_item.product_id,
                bin_location_id=receipt_item.target_bin_id,
                unit=receipt_item.unit,
            )
            inventory.quantity = Decimal(inventory.quantity) + quantity

            db.add(
                StockMovement(
                    movement_type="goods_receipt",
                    reference_type="goods_receipt",
                    reference_number=item.receipt_number,
                    product_id=receipt_item.product_id,
                    from_bin_id=None,
                    to_bin_id=receipt_item.target_bin_id,
                    quantity=quantity,
                    performed_by=current_user.id,
                    performed_at=now,
                    metadata_json={
                        "goods_receipt_id": item.id,
                        "goods_receipt_item_id": receipt_item.id,
                    },
                )
            )

        item.status = "completed"
        item.completed_at = now
        if item.received_at is None:
            item.received_at = now

        await db.commit()
    except HTTPException:
        await db.rollback()
        raise

    return MessageResponse(message="goods receipt completed")


@router.post("/goods-receipts/{receipt_id}/cancel", response_model=MessageResponse)
async def cancel_goods_receipt(
    receipt_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles("admin", "lagerleiter", "lagermitarbeiter")),
) -> MessageResponse:
    item = (await db.execute(select(GoodsReceipt).where(GoodsReceipt.id == receipt_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods receipt not found")

    _ensure_draft("Goods receipt", item.status)

    item.status = "cancelled"
    await db.commit()
    return MessageResponse(message="goods receipt cancelled")


@router.get("/goods-issues", response_model=list[GoodsIssueResponse])
async def list_goods_issues(
    status_filter: str | None = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
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
    current_user: User = Depends(require_roles("admin", "lagerleiter", "lagermitarbeiter")),
) -> GoodsIssueResponse:
    item = GoodsIssue(
        issue_number=payload.issue_number or _generate_number("WA"),
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
    _=Depends(get_current_user),
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
    _=Depends(require_roles("admin", "lagerleiter", "lagermitarbeiter")),
) -> GoodsIssueResponse:
    item = (await db.execute(select(GoodsIssue).where(GoodsIssue.id == issue_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods issue not found")

    _ensure_draft("Goods issue", item.status)

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)

    await db.commit()
    await db.refresh(item)
    return _to_goods_issue_response(item)


@router.delete("/goods-issues/{issue_id}", response_model=MessageResponse)
async def delete_goods_issue(
    issue_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles("admin", "lagerleiter", "lagermitarbeiter")),
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
    _=Depends(get_current_user),
) -> list[GoodsIssueItemResponse]:
    parent = (await db.execute(select(GoodsIssue).where(GoodsIssue.id == issue_id))).scalar_one_or_none()
    if parent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods issue not found")

    rows = list(
        (
            await db.execute(
                select(GoodsIssueItem).where(GoodsIssueItem.goods_issue_id == issue_id).order_by(GoodsIssueItem.id.asc())
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
    _=Depends(require_roles("admin", "lagerleiter", "lagermitarbeiter")),
) -> GoodsIssueItemResponse:
    parent = (await db.execute(select(GoodsIssue).where(GoodsIssue.id == issue_id))).scalar_one_or_none()
    if parent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods issue not found")

    _ensure_draft("Goods issue", parent.status)

    item = GoodsIssueItem(goods_issue_id=issue_id, **payload.model_dump())
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
    _=Depends(require_roles("admin", "lagerleiter", "lagermitarbeiter")),
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

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)

    await db.commit()
    await db.refresh(item)
    return _to_goods_issue_item_response(item)


@router.delete("/goods-issues/{issue_id}/items/{item_id}", response_model=MessageResponse)
async def delete_goods_issue_item(
    issue_id: int,
    item_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles("admin", "lagerleiter", "lagermitarbeiter")),
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
    current_user: User = Depends(require_roles("admin", "lagerleiter", "lagermitarbeiter")),
) -> MessageResponse:
    item = (await db.execute(select(GoodsIssue).where(GoodsIssue.id == issue_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods issue not found")

    _ensure_draft("Goods issue", item.status)

    issue_items = list(
        (
            await db.execute(select(GoodsIssueItem).where(GoodsIssueItem.goods_issue_id == issue_id))
        ).scalars()
    )
    if not issue_items:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Goods issue has no items",
        )

    now = _now()

    try:
        for issue_item in issue_items:
            if issue_item.source_bin_id is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Issue item {issue_item.id} has no source_bin_id",
                )

            quantity = Decimal(issue_item.issued_quantity or 0)
            if quantity <= 0:
                quantity = Decimal(issue_item.requested_quantity)

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
                    },
                )
            )

        item.status = "completed"
        item.completed_at = now
        if item.issued_at is None:
            item.issued_at = now

        await db.commit()
    except HTTPException:
        await db.rollback()
        raise

    return MessageResponse(message="goods issue completed")


@router.post("/goods-issues/{issue_id}/cancel", response_model=MessageResponse)
async def cancel_goods_issue(
    issue_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles("admin", "lagerleiter", "lagermitarbeiter")),
) -> MessageResponse:
    item = (await db.execute(select(GoodsIssue).where(GoodsIssue.id == issue_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods issue not found")

    _ensure_draft("Goods issue", item.status)

    item.status = "cancelled"
    await db.commit()
    return MessageResponse(message="goods issue cancelled")


@router.get("/stock-transfers", response_model=list[StockTransferResponse])
async def list_stock_transfers(
    status_filter: str | None = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
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
    current_user: User = Depends(require_roles("admin", "lagerleiter", "lagermitarbeiter")),
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
    _=Depends(get_current_user),
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
    _=Depends(require_roles("admin", "lagerleiter", "lagermitarbeiter")),
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
    _=Depends(require_roles("admin", "lagerleiter", "lagermitarbeiter")),
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
    _=Depends(get_current_user),
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
    _=Depends(require_roles("admin", "lagerleiter", "lagermitarbeiter")),
) -> StockTransferItemResponse:
    parent = (await db.execute(select(StockTransfer).where(StockTransfer.id == transfer_id))).scalar_one_or_none()
    if parent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock transfer not found")

    _ensure_draft("Stock transfer", parent.status)

    if payload.from_bin_id == payload.to_bin_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="from_bin_id and to_bin_id must differ",
        )

    item = StockTransferItem(stock_transfer_id=transfer_id, **payload.model_dump())
    db.add(item)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Conflict while creating transfer item") from exc

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
    _=Depends(require_roles("admin", "lagerleiter", "lagermitarbeiter")),
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

    from_bin = updates.get("from_bin_id", item.from_bin_id)
    to_bin = updates.get("to_bin_id", item.to_bin_id)
    if from_bin == to_bin:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
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
    _=Depends(require_roles("admin", "lagerleiter", "lagermitarbeiter")),
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
    current_user: User = Depends(require_roles("admin", "lagerleiter", "lagermitarbeiter")),
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
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Stock transfer has no items",
        )

    now = _now()

    try:
        for transfer_item in transfer_items:
            if transfer_item.from_bin_id == transfer_item.to_bin_id:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Transfer item {transfer_item.id} has same source and target bin",
                )

            quantity = Decimal(transfer_item.quantity)
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
                    },
                )
            )

        item.status = "completed"
        item.completed_at = now
        if item.transferred_at is None:
            item.transferred_at = now

        await db.commit()
    except HTTPException:
        await db.rollback()
        raise

    return MessageResponse(message="stock transfer completed")


@router.post("/stock-transfers/{transfer_id}/cancel", response_model=MessageResponse)
async def cancel_stock_transfer(
    transfer_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles("admin", "lagerleiter", "lagermitarbeiter")),
) -> MessageResponse:
    item = (await db.execute(select(StockTransfer).where(StockTransfer.id == transfer_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock transfer not found")

    _ensure_draft("Stock transfer", item.status)

    item.status = "cancelled"
    await db.commit()
    return MessageResponse(message="stock transfer cancelled")
