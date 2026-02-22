from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_permissions
from app.models.auth import User
from app.models.catalog import Product, Supplier
from app.models.purchasing import PurchaseOrder, PurchaseOrderEmailEvent, PurchaseOrderItem
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
    PurchaseOrderEmailSendResponse,
    PurchaseOrderItemCreate,
    PurchaseOrderResolveResponse,
    PurchaseOrderCommunicationEventResponse,
    PurchaseOrderCommunicationListResponse,
    PurchaseOrderItemResponse,
    PurchaseOrderResolveItem,
    PurchaseOrderMailSyncResponse,
    PurchaseOrderSupplierConfirmationUpdate,
    PurchaseOrderItemUpdate,
    PurchaseOrderResponse,
    PurchaseOrderStatusUpdate,
    PurchaseOrderUpdate,
)
from app.schemas.user import MessageResponse
from app.services.purchasing import send_purchase_order_email, sync_purchase_order_replies

router = APIRouter(prefix="/api", tags=["purchasing"])

PURCHASING_READ_PERMISSION = "module.purchasing.read"
PURCHASING_WRITE_PERMISSION = "module.purchasing.write"


@router.get("/purchase-orders", response_model=list[PurchaseOrderResponse])
async def list_purchase_orders(
    status_filter: str | None = Query(default=None, alias="status"),
    supplier_comm_status_filter: str | None = Query(default=None, alias="supplier_comm_status"),
    receivable_only: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(PURCHASING_READ_PERMISSION)),
) -> list[PurchaseOrderResponse]:
    stmt = select(PurchaseOrder).order_by(PurchaseOrder.id.desc())
    if status_filter:
        stmt = stmt.where(PurchaseOrder.status == status_filter)
    if supplier_comm_status_filter:
        stmt = stmt.where(PurchaseOrder.supplier_comm_status == supplier_comm_status_filter)
    if receivable_only:
        stmt = stmt.where(
            PurchaseOrder.status.in_(["ordered", "partially_received"]),
            PurchaseOrder.supplier_comm_status.in_(["confirmed_with_date", "confirmed_undetermined"]),
        )
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


@router.post("/purchase-orders/mail-sync", response_model=PurchaseOrderMailSyncResponse)
async def sync_purchase_order_mailbox(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(PURCHASING_WRITE_PERMISSION)),
) -> PurchaseOrderMailSyncResponse:
    result = await sync_purchase_order_replies(
        db,
        current_user_id=current_user.id,
    )
    return PurchaseOrderMailSyncResponse(
        processed=result.processed,
        matched=result.matched,
        skipped=result.skipped,
        imported_document_ids=result.imported_document_ids or [],
    )


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


def _to_communication_event_response(item: PurchaseOrderEmailEvent) -> PurchaseOrderCommunicationEventResponse:
    return PurchaseOrderCommunicationEventResponse(
        id=item.id,
        purchase_order_id=item.purchase_order_id,
        direction=item.direction,
        event_type=item.event_type,
        message_id=item.message_id,
        in_reply_to=item.in_reply_to,
        subject=item.subject,
        from_address=item.from_address,
        to_address=item.to_address,
        occurred_at=item.occurred_at,
        document_id=item.document_id,
        created_by=item.created_by,
        metadata_json=item.metadata_json,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.post(
    "/purchase-orders/{order_id}/send-email",
    response_model=PurchaseOrderEmailSendResponse,
)
async def send_purchase_order_supplier_email(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(PURCHASING_WRITE_PERMISSION)),
) -> PurchaseOrderEmailSendResponse:
    order, event, document, message_id = await send_purchase_order_email(
        db,
        order_id=order_id,
        current_user_id=current_user.id,
    )
    return PurchaseOrderEmailSendResponse(
        order=_to_order_response(order),
        communication_event_id=event.id,
        document_id=document.id,
        message_id=message_id,
    )


@router.patch(
    "/purchase-orders/{order_id}/supplier-confirmation",
    response_model=PurchaseOrderResponse,
)
async def update_purchase_order_supplier_confirmation(
    order_id: int,
    payload: PurchaseOrderSupplierConfirmationUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(PURCHASING_WRITE_PERMISSION)),
) -> PurchaseOrderResponse:
    order = (await db.execute(select(PurchaseOrder).where(PurchaseOrder.id == order_id))).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")

    if payload.supplier_comm_status == "confirmed_with_date" and payload.supplier_delivery_date is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="supplier_delivery_date is required for confirmed_with_date",
        )
    if payload.supplier_comm_status == "confirmed_undetermined" and payload.supplier_delivery_date is not None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="supplier_delivery_date must be null for confirmed_undetermined",
        )

    order.supplier_comm_status = payload.supplier_comm_status
    order.supplier_delivery_date = payload.supplier_delivery_date
    order.supplier_last_reply_note = payload.supplier_last_reply_note
    await db.commit()
    await db.refresh(order)
    return _to_order_response(order)


@router.get(
    "/purchase-orders/{order_id}/communications",
    response_model=PurchaseOrderCommunicationListResponse,
)
async def list_purchase_order_communications(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(PURCHASING_READ_PERMISSION)),
) -> PurchaseOrderCommunicationListResponse:
    order = (await db.execute(select(PurchaseOrder).where(PurchaseOrder.id == order_id))).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")

    rows = list(
        (
            await db.execute(
                select(PurchaseOrderEmailEvent)
                .where(PurchaseOrderEmailEvent.purchase_order_id == order_id)
                .order_by(PurchaseOrderEmailEvent.occurred_at.desc(), PurchaseOrderEmailEvent.id.desc())
            )
        ).scalars()
    )
    return PurchaseOrderCommunicationListResponse(items=[_to_communication_event_response(item) for item in rows])


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
