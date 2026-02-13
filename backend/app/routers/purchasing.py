from datetime import UTC, datetime
from secrets import token_hex

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, require_roles
from app.models.auth import User
from app.models.catalog import Product, Supplier
from app.models.purchasing import PurchaseOrder, PurchaseOrderItem
from app.schemas.purchasing import (
    PurchaseOrderCreate,
    PurchaseOrderItemCreate,
    PurchaseOrderItemResponse,
    PurchaseOrderItemUpdate,
    PurchaseOrderResponse,
    PurchaseOrderStatusUpdate,
    PurchaseOrderUpdate,
)
from app.schemas.user import MessageResponse

router = APIRouter(prefix="/api", tags=["purchasing"])


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


@router.get("/purchase-orders", response_model=list[PurchaseOrderResponse])
async def list_purchase_orders(
    status_filter: str | None = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
) -> list[PurchaseOrderResponse]:
    stmt = select(PurchaseOrder).order_by(PurchaseOrder.id.desc())
    if status_filter:
        stmt = stmt.where(PurchaseOrder.status == status_filter)
    rows = list((await db.execute(stmt)).scalars())
    return [_to_order_response(item) for item in rows]


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
    _=Depends(get_current_user),
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
    _=Depends(require_roles("admin", "lagerleiter", "einkauf")),
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
    _=Depends(get_current_user),
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
