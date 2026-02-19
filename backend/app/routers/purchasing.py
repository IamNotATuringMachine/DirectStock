from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_permissions
from app.models.auth import User
from app.models.catalog import Product, Supplier
from app.models.purchasing import PurchaseOrder, PurchaseOrderItem
from app.routers.purchasing_helpers import (
    _ensure_editable,
    _ensure_receivable,
    _generate_number,
    _to_item_response,
    _to_order_response,
)
from app.routers.purchasing_workflow import update_purchase_order_status_workflow
from app.schemas.purchasing import (
    PurchaseOrderCreate,
    PurchaseOrderItemCreate,
    PurchaseOrderResolveResponse,
    PurchaseOrderItemResponse,
    PurchaseOrderResolveItem,
    PurchaseOrderItemUpdate,
    PurchaseOrderResponse,
    PurchaseOrderStatusUpdate,
    PurchaseOrderUpdate,
)
from app.schemas.user import MessageResponse

router = APIRouter(prefix="/api", tags=["purchasing"])

PURCHASING_READ_PERMISSION = "module.purchasing.read"
PURCHASING_WRITE_PERMISSION = "module.purchasing.write"


@router.get("/purchase-orders", response_model=list[PurchaseOrderResponse])
async def list_purchase_orders(
    status_filter: str | None = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(PURCHASING_READ_PERMISSION)),
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
    _=Depends(require_permissions(PURCHASING_READ_PERMISSION)),
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
    current_user: User = Depends(require_permissions(PURCHASING_WRITE_PERMISSION)),
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
    _=Depends(require_permissions(PURCHASING_READ_PERMISSION)),
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
    _=Depends(require_permissions(PURCHASING_WRITE_PERMISSION)),
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
    _=Depends(require_permissions(PURCHASING_WRITE_PERMISSION)),
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
    current_user: User = Depends(require_permissions(PURCHASING_WRITE_PERMISSION)),
) -> PurchaseOrderResponse:
    item = await update_purchase_order_status_workflow(
        db=db,
        order_id=order_id,
        status_value=payload.status,
        current_user=current_user,
    )
    return _to_order_response(item)


@router.get("/purchase-orders/{order_id}/items", response_model=list[PurchaseOrderItemResponse])
async def list_purchase_order_items(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(PURCHASING_READ_PERMISSION)),
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
    _=Depends(require_permissions(PURCHASING_WRITE_PERMISSION)),
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
    _=Depends(require_permissions(PURCHASING_WRITE_PERMISSION)),
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
    _=Depends(require_permissions(PURCHASING_WRITE_PERMISSION)),
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
