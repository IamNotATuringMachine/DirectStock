from datetime import UTC, datetime
from decimal import Decimal
from secrets import token_hex

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_roles
from app.models.auth import User
from app.models.catalog import Product, Supplier
from app.models.phase3 import ApprovalRequest, ApprovalRule
from app.models.purchasing import PurchaseOrder, PurchaseOrderItem
from app.schemas.purchasing import (
    PurchaseOrderCreate,
    PurchaseOrderItemCreate,
    PurchaseOrderResolveItem,
    PurchaseOrderResolveResponse,
    PurchaseOrderItemResponse,
    PurchaseOrderItemUpdate,
    PurchaseOrderResponse,
    PurchaseOrderStatusUpdate,
    PurchaseOrderUpdate,
)
from app.schemas.user import MessageResponse

router = APIRouter(prefix="/api", tags=["purchasing"])

PURCHASING_READ_ROLES = ("admin", "lagerleiter", "einkauf")


TRANSITIONS: dict[str, set[str]] = {
    "draft": {"approved", "cancelled"},
    "approved": {"ordered", "cancelled"},
    "ordered": {"partially_received", "completed", "cancelled"},
    "partially_received": {"completed", "cancelled"},
    "completed": set(),
    "cancelled": set(),
}


def _now() -> datetime:
    return datetime.now(UTC)


def _generate_number(prefix: str) -> str:
    return f"{prefix}-{_now().strftime('%Y%m%d%H%M%S')}-{token_hex(2).upper()}"


def _to_order_response(item: PurchaseOrder) -> PurchaseOrderResponse:
    return PurchaseOrderResponse(
        id=item.id,
        order_number=item.order_number,
        supplier_id=item.supplier_id,
        status=item.status,
        expected_delivery_at=item.expected_delivery_at,
        ordered_at=item.ordered_at,
        completed_at=item.completed_at,
        created_by=item.created_by,
        notes=item.notes,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _to_item_response(item: PurchaseOrderItem) -> PurchaseOrderItemResponse:
    return PurchaseOrderItemResponse(
        id=item.id,
        purchase_order_id=item.purchase_order_id,
        product_id=item.product_id,
        ordered_quantity=item.ordered_quantity,
        received_quantity=item.received_quantity,
        unit=item.unit,
        unit_price=item.unit_price,
        expected_delivery_at=item.expected_delivery_at,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _ensure_editable(order: PurchaseOrder) -> None:
    if order.status not in {"draft", "approved"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Purchase order is not editable")


def _ensure_receivable(order: PurchaseOrder) -> None:
    if order.status not in {"ordered", "partially_received"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Purchase order {order.order_number} is not ready for goods receipt",
        )


async def _ensure_order_can_be_completed(db: AsyncSession, *, order_id: int) -> None:
    order_items = list(
        (
            await db.execute(
                select(PurchaseOrderItem).where(PurchaseOrderItem.purchase_order_id == order_id)
            )
        ).scalars()
    )
    if not order_items:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Purchase order cannot be completed without items",
        )

    open_items = [
        order_item.id
        for order_item in order_items
        if order_item.received_quantity < order_item.ordered_quantity
    ]
    if open_items:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Purchase order cannot be completed while open quantities remain",
        )


@router.get("/purchase-orders", response_model=list[PurchaseOrderResponse])
async def list_purchase_orders(
    status_filter: str | None = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*PURCHASING_READ_ROLES)),
) -> list[PurchaseOrderResponse]:
    stmt = select(PurchaseOrder).order_by(PurchaseOrder.id.desc())
    if status_filter:
        stmt = stmt.where(PurchaseOrder.status == status_filter)
    rows = list((await db.execute(stmt)).scalars())
    return [_to_order_response(item) for item in rows]


@router.get("/purchase-orders/resolve", response_model=PurchaseOrderResolveResponse)
async def resolve_purchase_order_by_number(
    order_number: str = Query(min_length=1),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*PURCHASING_READ_ROLES)),
) -> PurchaseOrderResolveResponse:
    normalized = order_number.strip()
    order = (
        await db.execute(select(PurchaseOrder).where(PurchaseOrder.order_number == normalized))
    ).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")

    _ensure_receivable(order)

    rows = list(
        (
            await db.execute(
                select(PurchaseOrderItem, Product)
                .join(Product, Product.id == PurchaseOrderItem.product_id)
                .where(PurchaseOrderItem.purchase_order_id == order.id)
                .order_by(PurchaseOrderItem.id.asc())
            )
        ).all()
    )

    items: list[PurchaseOrderResolveItem] = []
    for po_item, product in rows:
        ordered_quantity = Decimal(po_item.ordered_quantity)
        received_quantity = Decimal(po_item.received_quantity)
        open_quantity = ordered_quantity - received_quantity
        if open_quantity <= 0:
            continue
        items.append(
            PurchaseOrderResolveItem(
                id=po_item.id,
                product_id=po_item.product_id,
                product_number=product.product_number,
                product_name=product.name,
                ordered_quantity=ordered_quantity,
                received_quantity=received_quantity,
                open_quantity=open_quantity,
                unit=po_item.unit,
            )
        )

    if not items:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Purchase order {order.order_number} has no open quantities",
        )

    return PurchaseOrderResolveResponse(order=_to_order_response(order), items=items)


@router.post("/purchase-orders", response_model=PurchaseOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_purchase_order(
    payload: PurchaseOrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "lagerleiter", "einkauf")),
) -> PurchaseOrderResponse:
    if payload.supplier_id is not None:
        supplier = (await db.execute(select(Supplier).where(Supplier.id == payload.supplier_id))).scalar_one_or_none()
        if supplier is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")

    item = PurchaseOrder(
        order_number=payload.order_number or _generate_number("PO"),
        supplier_id=payload.supplier_id,
        expected_delivery_at=payload.expected_delivery_at,
        notes=payload.notes,
        created_by=current_user.id,
    )
    db.add(item)

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Purchase order already exists") from exc

    await db.refresh(item)
    return _to_order_response(item)


@router.get("/purchase-orders/{order_id}", response_model=PurchaseOrderResponse)
async def get_purchase_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*PURCHASING_READ_ROLES)),
) -> PurchaseOrderResponse:
    item = (await db.execute(select(PurchaseOrder).where(PurchaseOrder.id == order_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")
    return _to_order_response(item)


@router.put("/purchase-orders/{order_id}", response_model=PurchaseOrderResponse)
async def update_purchase_order(
    order_id: int,
    payload: PurchaseOrderUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles("admin", "lagerleiter", "einkauf")),
) -> PurchaseOrderResponse:
    item = (await db.execute(select(PurchaseOrder).where(PurchaseOrder.id == order_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")

    _ensure_editable(item)

    if payload.supplier_id is not None:
        supplier = (await db.execute(select(Supplier).where(Supplier.id == payload.supplier_id))).scalar_one_or_none()
        if supplier is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)

    await db.commit()
    await db.refresh(item)
    return _to_order_response(item)


@router.delete("/purchase-orders/{order_id}", response_model=MessageResponse)
async def delete_purchase_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles("admin", "lagerleiter", "einkauf")),
) -> MessageResponse:
    item = (await db.execute(select(PurchaseOrder).where(PurchaseOrder.id == order_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")

    _ensure_editable(item)

    await db.delete(item)
    await db.commit()
    return MessageResponse(message="purchase order deleted")


@router.post("/purchase-orders/{order_id}/status", response_model=PurchaseOrderResponse)
async def update_purchase_order_status(
    order_id: int,
    payload: PurchaseOrderStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "lagerleiter", "einkauf")),
) -> PurchaseOrderResponse:
    item = (await db.execute(select(PurchaseOrder).where(PurchaseOrder.id == order_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")

    allowed = TRANSITIONS[item.status]
    if payload.status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Invalid status transition: {item.status} -> {payload.status}",
        )

    if payload.status == "completed":
        await _ensure_order_can_be_completed(db, order_id=item.id)

    if payload.status in {"ordered", "completed"}:
        active_rule = (
            await db.execute(
                select(ApprovalRule)
                .where(
                    ApprovalRule.entity_type == "purchase_order",
                    ApprovalRule.is_active.is_(True),
                )
                .order_by(ApprovalRule.id.desc())
            )
        ).scalars().first()
        if active_rule is not None:
            total_amount = (
                await db.execute(
                    select(
                        func.coalesce(
                            func.sum(
                                PurchaseOrderItem.ordered_quantity * func.coalesce(PurchaseOrderItem.unit_price, 0)
                            ),
                            0,
                        )
                    ).where(PurchaseOrderItem.purchase_order_id == item.id)
                )
            ).scalar_one()
            threshold = active_rule.min_amount or 0
            if Decimal(total_amount) >= Decimal(threshold):
                approved = (
                    await db.execute(
                        select(ApprovalRequest.id).where(
                            ApprovalRequest.entity_type == "purchase_order",
                            ApprovalRequest.entity_id == item.id,
                            ApprovalRequest.status == "approved",
                        )
                    )
                ).scalar_one_or_none()
                if approved is None:
                    pending = (
                        await db.execute(
                            select(ApprovalRequest.id).where(
                                ApprovalRequest.entity_type == "purchase_order",
                                ApprovalRequest.entity_id == item.id,
                                ApprovalRequest.status == "pending",
                            )
                        )
                    ).scalar_one_or_none()
                    if pending is None:
                        db.add(
                            ApprovalRequest(
                                entity_type="purchase_order",
                                entity_id=item.id,
                                status="pending",
                                amount=Decimal(total_amount),
                                reason=f"Auto-created by approval rule {active_rule.id}",
                                requested_by=current_user.id,
                                requested_at=_now(),
                            )
                        )
                        await db.commit()
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Purchase order requires approval before this status transition",
                    )

    item.status = payload.status
    now = _now()
    if payload.status == "ordered" and item.ordered_at is None:
        item.ordered_at = now
    if payload.status == "completed":
        item.completed_at = now

    await db.commit()
    await db.refresh(item)
    return _to_order_response(item)


@router.get("/purchase-orders/{order_id}/items", response_model=list[PurchaseOrderItemResponse])
async def list_purchase_order_items(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*PURCHASING_READ_ROLES)),
) -> list[PurchaseOrderItemResponse]:
    order = (await db.execute(select(PurchaseOrder).where(PurchaseOrder.id == order_id))).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")

    rows = list(
        (
            await db.execute(
                select(PurchaseOrderItem)
                .where(PurchaseOrderItem.purchase_order_id == order_id)
                .order_by(PurchaseOrderItem.id.asc())
            )
        ).scalars()
    )
    return [_to_item_response(item) for item in rows]


@router.post("/purchase-orders/{order_id}/items", response_model=PurchaseOrderItemResponse, status_code=status.HTTP_201_CREATED)
async def create_purchase_order_item(
    order_id: int,
    payload: PurchaseOrderItemCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles("admin", "lagerleiter", "einkauf")),
) -> PurchaseOrderItemResponse:
    order = (await db.execute(select(PurchaseOrder).where(PurchaseOrder.id == order_id))).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")

    _ensure_editable(order)

    product = (await db.execute(select(Product).where(Product.id == payload.product_id))).scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    item = PurchaseOrderItem(purchase_order_id=order_id, **payload.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return _to_item_response(item)


@router.put("/purchase-orders/{order_id}/items/{item_id}", response_model=PurchaseOrderItemResponse)
async def update_purchase_order_item(
    order_id: int,
    item_id: int,
    payload: PurchaseOrderItemUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles("admin", "lagerleiter", "einkauf")),
) -> PurchaseOrderItemResponse:
    order = (await db.execute(select(PurchaseOrder).where(PurchaseOrder.id == order_id))).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")

    _ensure_editable(order)

    item = (
        await db.execute(
            select(PurchaseOrderItem).where(
                PurchaseOrderItem.id == item_id,
                PurchaseOrderItem.purchase_order_id == order_id,
            )
        )
    ).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order item not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)

    await db.commit()
    await db.refresh(item)
    return _to_item_response(item)


@router.delete("/purchase-orders/{order_id}/items/{item_id}", response_model=MessageResponse)
async def delete_purchase_order_item(
    order_id: int,
    item_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles("admin", "lagerleiter", "einkauf")),
) -> MessageResponse:
    order = (await db.execute(select(PurchaseOrder).where(PurchaseOrder.id == order_id))).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")

    _ensure_editable(order)

    item = (
        await db.execute(
            select(PurchaseOrderItem).where(
                PurchaseOrderItem.id == item_id,
                PurchaseOrderItem.purchase_order_id == order_id,
            )
        )
    ).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order item not found")

    await db.delete(item)
    await db.commit()
    return MessageResponse(message="purchase order item deleted")
