from datetime import UTC, datetime
from decimal import Decimal
from secrets import token_hex

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_roles
from app.models.auth import User
from app.models.catalog import Product
from app.models.inventory import Inventory, StockMovement
from app.models.phase3 import ApprovalRequest, ApprovalRule, ReturnOrder, ReturnOrderItem
from app.models.warehouse import BinLocation
from app.schemas.phase3 import (
    ReturnOrderCreate,
    ReturnOrderItemCreate,
    ReturnOrderItemResponse,
    ReturnOrderItemUpdate,
    ReturnOrderResponse,
    ReturnOrderStatusUpdate,
    ReturnOrderUpdate,
)
from app.schemas.user import MessageResponse

router = APIRouter(prefix="/api/return-orders", tags=["returns"])

READ_ROLES = ("admin", "lagerleiter", "versand", "controller", "auditor")
WRITE_ROLES = ("admin", "lagerleiter", "versand")

TRANSITIONS: dict[str, set[str]] = {
    "registered": {"received", "cancelled"},
    "received": {"inspected", "cancelled"},
    "inspected": {"resolved", "cancelled"},
    "resolved": set(),
    "cancelled": set(),
}


def _now() -> datetime:
    return datetime.now(UTC)


def _generate_number() -> str:
    return f"RO-{_now().strftime('%Y%m%d%H%M%S')}-{token_hex(2).upper()}"


def _to_order_response(item: ReturnOrder) -> ReturnOrderResponse:
    return ReturnOrderResponse(
        id=item.id,
        return_number=item.return_number,
        customer_id=item.customer_id,
        goods_issue_id=item.goods_issue_id,
        status=item.status,
        notes=item.notes,
        registered_at=item.registered_at,
        received_at=item.received_at,
        inspected_at=item.inspected_at,
        resolved_at=item.resolved_at,
        created_by=item.created_by,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _to_item_response(item: ReturnOrderItem) -> ReturnOrderItemResponse:
    return ReturnOrderItemResponse(
        id=item.id,
        return_order_id=item.return_order_id,
        product_id=item.product_id,
        quantity=item.quantity,
        unit=item.unit,
        decision=item.decision,
        target_bin_id=item.target_bin_id,
        reason=item.reason,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


async def _load_order_or_404(db: AsyncSession, order_id: int) -> ReturnOrder:
    item = (await db.execute(select(ReturnOrder).where(ReturnOrder.id == order_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Return order not found")
    return item


async def _load_item_or_404(db: AsyncSession, order_id: int, item_id: int) -> ReturnOrderItem:
    item = (
        await db.execute(
            select(ReturnOrderItem).where(
                ReturnOrderItem.id == item_id,
                ReturnOrderItem.return_order_id == order_id,
            )
        )
    ).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Return order item not found")
    return item


@router.get("", response_model=list[ReturnOrderResponse])
async def list_return_orders(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*READ_ROLES)),
) -> list[ReturnOrderResponse]:
    rows = list((await db.execute(select(ReturnOrder).order_by(ReturnOrder.id.desc()))).scalars())
    return [_to_order_response(item) for item in rows]


@router.post("", response_model=ReturnOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_return_order(
    payload: ReturnOrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*WRITE_ROLES)),
) -> ReturnOrderResponse:
    order = ReturnOrder(
        return_number=payload.return_number or _generate_number(),
        customer_id=payload.customer_id,
        goods_issue_id=payload.goods_issue_id,
        status="registered",
        notes=payload.notes,
        registered_at=_now(),
        created_by=current_user.id,
    )
    db.add(order)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Return order already exists") from exc
    await db.refresh(order)
    return _to_order_response(order)


@router.get("/{order_id}", response_model=ReturnOrderResponse)
async def get_return_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*READ_ROLES)),
) -> ReturnOrderResponse:
    order = await _load_order_or_404(db, order_id)
    return _to_order_response(order)


@router.put("/{order_id}", response_model=ReturnOrderResponse)
async def update_return_order(
    order_id: int,
    payload: ReturnOrderUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*WRITE_ROLES)),
) -> ReturnOrderResponse:
    order = await _load_order_or_404(db, order_id)
    if order.status in {"resolved", "cancelled"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Return order is not editable")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(order, key, value)

    await db.commit()
    await db.refresh(order)
    return _to_order_response(order)


@router.delete("/{order_id}", response_model=MessageResponse)
async def delete_return_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*WRITE_ROLES)),
) -> MessageResponse:
    order = await _load_order_or_404(db, order_id)
    if order.status not in {"registered", "cancelled"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Return order cannot be deleted")

    await db.delete(order)
    await db.commit()
    return MessageResponse(message="return order deleted")


@router.post("/{order_id}/status", response_model=ReturnOrderResponse)
async def update_return_order_status(
    order_id: int,
    payload: ReturnOrderStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*WRITE_ROLES)),
) -> ReturnOrderResponse:
    order = await _load_order_or_404(db, order_id)
    if payload.status not in TRANSITIONS[order.status]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Invalid status transition: {order.status} -> {payload.status}",
        )

    items = list(
        (
            await db.execute(
                select(ReturnOrderItem).where(ReturnOrderItem.return_order_id == order.id)
            )
        ).scalars()
    )

    now = _now()
    if payload.status == "received":
        order.received_at = now
        for item in items:
            db.add(
                StockMovement(
                    movement_type="return_receipt",
                    reference_type="return_order",
                    reference_number=order.return_number,
                    product_id=item.product_id,
                    from_bin_id=None,
                    to_bin_id=item.target_bin_id,
                    quantity=item.quantity,
                    performed_by=current_user.id,
                    performed_at=now,
                    metadata_json={"return_order_id": order.id, "decision": item.decision},
                )
            )
    elif payload.status == "inspected":
        order.inspected_at = now
    elif payload.status == "resolved":
        if not items:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Return order has no items")

        active_rule = (
            await db.execute(
                select(ApprovalRule)
                .where(
                    ApprovalRule.entity_type == "return_order",
                    ApprovalRule.is_active.is_(True),
                )
                .order_by(ApprovalRule.id.desc())
            )
        ).scalars().first()
        if active_rule is not None:
            total_amount = sum(Decimal(item.quantity or 0) for item in items)
            threshold = Decimal(active_rule.min_amount or 0)
            if total_amount >= threshold:
                approved = (
                    await db.execute(
                        select(ApprovalRequest.id).where(
                            ApprovalRequest.entity_type == "return_order",
                            ApprovalRequest.entity_id == order.id,
                            ApprovalRequest.status == "approved",
                        )
                    )
                ).scalar_one_or_none()
                if approved is None:
                    pending = (
                        await db.execute(
                            select(ApprovalRequest.id).where(
                                ApprovalRequest.entity_type == "return_order",
                                ApprovalRequest.entity_id == order.id,
                                ApprovalRequest.status == "pending",
                            )
                        )
                    ).scalar_one_or_none()
                    if pending is None:
                        db.add(
                            ApprovalRequest(
                                entity_type="return_order",
                                entity_id=order.id,
                                status="pending",
                                amount=total_amount,
                                reason=f"Auto-created by approval rule {active_rule.id}",
                                requested_by=current_user.id,
                                requested_at=now,
                            )
                        )
                        await db.commit()
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Return order requires approval before resolving",
                    )

        for item in items:
            if item.decision == "restock":
                if item.target_bin_id is None:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Return item {item.id} requires target_bin_id for restock",
                    )

                existing = (
                    await db.execute(
                        select(Inventory).where(
                            Inventory.product_id == item.product_id,
                            Inventory.bin_location_id == item.target_bin_id,
                        )
                    )
                ).scalar_one_or_none()
                if existing is None:
                    existing = Inventory(
                        product_id=item.product_id,
                        bin_location_id=item.target_bin_id,
                        quantity=item.quantity,
                        reserved_quantity=Decimal("0"),
                        unit=item.unit,
                    )
                    db.add(existing)
                else:
                    existing.quantity = Decimal(existing.quantity) + Decimal(item.quantity)

                db.add(
                    StockMovement(
                        movement_type="return_restock",
                        reference_type="return_order",
                        reference_number=order.return_number,
                        product_id=item.product_id,
                        from_bin_id=None,
                        to_bin_id=item.target_bin_id,
                        quantity=item.quantity,
                        performed_by=current_user.id,
                        performed_at=now,
                        metadata_json={"return_order_id": order.id},
                    )
                )
            elif item.decision == "scrap":
                db.add(
                    StockMovement(
                        movement_type="return_scrap",
                        reference_type="return_order",
                        reference_number=order.return_number,
                        product_id=item.product_id,
                        from_bin_id=item.target_bin_id,
                        to_bin_id=None,
                        quantity=item.quantity,
                        performed_by=current_user.id,
                        performed_at=now,
                        metadata_json={"return_order_id": order.id, "reason": item.reason},
                    )
                )
            elif item.decision == "return_supplier":
                db.add(
                    StockMovement(
                        movement_type="return_supplier",
                        reference_type="return_order",
                        reference_number=order.return_number,
                        product_id=item.product_id,
                        from_bin_id=item.target_bin_id,
                        to_bin_id=None,
                        quantity=item.quantity,
                        performed_by=current_user.id,
                        performed_at=now,
                        metadata_json={"return_order_id": order.id, "reason": item.reason},
                    )
                )

        order.resolved_at = now

    order.status = payload.status
    await db.commit()
    await db.refresh(order)
    return _to_order_response(order)


@router.get("/{order_id}/items", response_model=list[ReturnOrderItemResponse])
async def list_return_order_items(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*READ_ROLES)),
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
    _=Depends(require_roles(*WRITE_ROLES)),
) -> ReturnOrderItemResponse:
    order = await _load_order_or_404(db, order_id)
    if order.status in {"resolved", "cancelled"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Return order is not editable")

    product = (await db.execute(select(Product).where(Product.id == payload.product_id))).scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    if payload.target_bin_id is not None:
        bin_location = (
            await db.execute(select(BinLocation).where(BinLocation.id == payload.target_bin_id))
        ).scalar_one_or_none()
        if bin_location is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target bin not found")

    item = ReturnOrderItem(return_order_id=order_id, **payload.model_dump())
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
    _=Depends(require_roles(*WRITE_ROLES)),
) -> ReturnOrderItemResponse:
    order = await _load_order_or_404(db, order_id)
    if order.status in {"resolved", "cancelled"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Return order is not editable")

    item = await _load_item_or_404(db, order_id, item_id)
    updates = payload.model_dump(exclude_unset=True)

    target_bin_id = updates.get("target_bin_id")
    if target_bin_id is not None:
        bin_location = (
            await db.execute(select(BinLocation).where(BinLocation.id == target_bin_id))
        ).scalar_one_or_none()
        if bin_location is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target bin not found")

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
    _=Depends(require_roles(*WRITE_ROLES)),
) -> MessageResponse:
    order = await _load_order_or_404(db, order_id)
    if order.status in {"resolved", "cancelled"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Return order is not editable")

    item = await _load_item_or_404(db, order_id, item_id)
    await db.delete(item)
    await db.commit()
    return MessageResponse(message="return order item deleted")
