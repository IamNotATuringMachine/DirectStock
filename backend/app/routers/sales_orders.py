from datetime import datetime
from secrets import token_hex

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_permissions
from app.models.auth import User
from app.models.inventory import GoodsIssue
from app.models.phase3 import Document
from app.models.phase5 import SalesOrder, SalesOrderGoodsIssueLink, SalesOrderItem
from app.schemas.phase5 import (
    SalesOrderCreate,
    SalesOrderCompleteRequest,
    SalesOrderDeliveryNoteLinkPayload,
    SalesOrderDetailResponse,
    SalesOrderItemCreate,
    SalesOrderItemResponse,
    SalesOrderListResponse,
    SalesOrderResponse,
    SalesOrderUpdate,
)
from app.schemas.user import MessageResponse
from app.services.operation_signoff_service import (
    build_operation_signoff,
    fetch_operation_signoff_map,
    fetch_operation_signoff_summary,
)
from .sales_orders_helpers import (
    _build_delivery_note_pdf,
    _create_order_item,
    _effective_storage_root,
    _generate_order_number,
    _now,
    _resolve_customer_scope,
    _to_item_response,
    _to_order_response,
)

router = APIRouter(prefix="/api/sales-orders", tags=["sales-orders"])


@router.get("", response_model=SalesOrderListResponse)
async def list_sales_orders(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions("module.sales_orders.read")),
) -> SalesOrderListResponse:
    total = int((await db.execute(select(func.count(SalesOrder.id)))).scalar_one())
    rows = list(
        (
            await db.execute(
                select(SalesOrder)
                .order_by(SalesOrder.id.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        ).scalars()
    )
    signoff_map = await fetch_operation_signoff_map(
        db=db,
        operation_type="sales_order",
        operation_ids=[row.id for row in rows],
    )
    return SalesOrderListResponse(
        items=[_to_order_response(row, operation_signoff=signoff_map.get(row.id)) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=SalesOrderDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_sales_order(
    payload: SalesOrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("module.sales_orders.write")),
) -> SalesOrderDetailResponse:
    customer_id, customer_location_id = await _resolve_customer_scope(
        db,
        customer_id=payload.customer_id,
        customer_location_id=payload.customer_location_id,
    )

    row = SalesOrder(
        order_number=(payload.order_number or _generate_order_number()).strip().upper(),
        customer_id=customer_id,
        customer_location_id=customer_location_id,
        status="draft",
        ordered_at=_now(),
        created_by=current_user.id,
        currency=payload.currency.upper(),
        notes=payload.notes,
    )
    db.add(row)

    try:
        await db.flush()
        for item_payload in payload.items:
            await _create_order_item(db, row, item_payload)
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Sales order already exists") from exc

    return await get_sales_order(order_id=row.id, db=db)


@router.get("/{order_id}", response_model=SalesOrderDetailResponse)
async def get_sales_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions("module.sales_orders.read")),
) -> SalesOrderDetailResponse:
    order = (await db.execute(select(SalesOrder).where(SalesOrder.id == order_id))).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sales order not found")

    items = list((await db.execute(select(SalesOrderItem).where(SalesOrderItem.sales_order_id == order_id).order_by(SalesOrderItem.line_no.asc(), SalesOrderItem.id.asc()))).scalars())
    operation_signoff = await fetch_operation_signoff_summary(
        db=db,
        operation_type="sales_order",
        operation_id=order.id,
    )
    return SalesOrderDetailResponse(
        order=_to_order_response(order, operation_signoff=operation_signoff),
        items=[_to_item_response(item) for item in items],
    )


@router.put("/{order_id}", response_model=SalesOrderResponse)
async def update_sales_order(
    order_id: int,
    payload: SalesOrderUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions("module.sales_orders.write")),
) -> SalesOrderResponse:
    order = (await db.execute(select(SalesOrder).where(SalesOrder.id == order_id))).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sales order not found")

    updates = payload.model_dump(exclude_unset=True)
    if "customer_id" in updates or "customer_location_id" in updates:
        requested_customer_id = updates.get("customer_id", order.customer_id)
        requested_location_id = updates.get("customer_location_id", order.customer_location_id)
        if "customer_id" in updates and updates["customer_id"] is None and "customer_location_id" not in updates:
            requested_location_id = None
        resolved_customer_id, resolved_location_id = await _resolve_customer_scope(
            db,
            customer_id=requested_customer_id,
            customer_location_id=requested_location_id,
        )
        updates["customer_id"] = resolved_customer_id
        updates["customer_location_id"] = resolved_location_id

    if "status" in updates and updates["status"] == "completed":
        updates["completed_at"] = _now()
    if "currency" in updates and updates["currency"] is not None:
        updates["currency"] = updates["currency"].upper()

    for key, value in updates.items():
        setattr(order, key, value)

    await db.commit()
    await db.refresh(order)
    operation_signoff = await fetch_operation_signoff_summary(
        db=db,
        operation_type="sales_order",
        operation_id=order.id,
    )
    return _to_order_response(order, operation_signoff=operation_signoff)


@router.post("/{order_id}/complete", response_model=MessageResponse)
async def complete_sales_order(
    order_id: int,
    payload: SalesOrderCompleteRequest | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("module.sales_orders.write")),
) -> MessageResponse:
    order = (await db.execute(select(SalesOrder).where(SalesOrder.id == order_id))).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sales order not found")
    if order.status == "cancelled":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cancelled sales order cannot be completed")
    if order.status == "completed":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Sales order already completed")

    operation_signoff = await build_operation_signoff(
        db=db,
        payload=payload,
        current_user=current_user,
        operation_type="sales_order",
        operation_id=order.id,
    )

    order.status = "completed"
    order.completed_at = _now()
    if operation_signoff is not None:
        db.add(operation_signoff)
    await db.commit()
    return MessageResponse(message="sales order completed")


@router.post("/{order_id}/items", response_model=SalesOrderItemResponse, status_code=status.HTTP_201_CREATED)
async def add_sales_order_item(
    order_id: int,
    payload: SalesOrderItemCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions("module.sales_orders.write")),
) -> SalesOrderItemResponse:
    order = (await db.execute(select(SalesOrder).where(SalesOrder.id == order_id))).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sales order not found")
    if order.status == "cancelled":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cannot add items to cancelled order")

    item = await _create_order_item(db, order, payload)
    await db.commit()
    await db.refresh(item)
    return _to_item_response(item)


@router.post("/{order_id}/delivery-note")
async def create_delivery_note(
    order_id: int,
    payload: SalesOrderDeliveryNoteLinkPayload | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("module.sales_orders.write")),
) -> dict:
    order = (await db.execute(select(SalesOrder).where(SalesOrder.id == order_id))).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sales order not found")

    if payload is not None:
        goods_issue = (
            await db.execute(select(GoodsIssue).where(GoodsIssue.id == payload.goods_issue_id))
        ).scalar_one_or_none()
        if goods_issue is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods issue not found")
        link = (
            await db.execute(
                select(SalesOrderGoodsIssueLink).where(
                    SalesOrderGoodsIssueLink.sales_order_id == order_id,
                    SalesOrderGoodsIssueLink.goods_issue_id == goods_issue.id,
                )
            )
        ).scalar_one_or_none()
        if link is None:
            db.add(SalesOrderGoodsIssueLink(sales_order_id=order_id, goods_issue_id=goods_issue.id))
            await db.commit()

    link = (
        await db.execute(
            select(SalesOrderGoodsIssueLink)
            .where(SalesOrderGoodsIssueLink.sales_order_id == order_id)
            .order_by(SalesOrderGoodsIssueLink.id.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    goods_issue = None
    if link is not None:
        goods_issue = (await db.execute(select(GoodsIssue).where(GoodsIssue.id == link.goods_issue_id))).scalar_one_or_none()

    if goods_issue is None and order.customer_id is not None:
        location_filters = [GoodsIssue.customer_id == order.customer_id, GoodsIssue.status == "completed"]
        if order.customer_location_id is not None:
            location_filters.append(GoodsIssue.customer_location_id == order.customer_location_id)
        goods_issue = (
            await db.execute(
                select(GoodsIssue)
                .where(*location_filters)
                .order_by(GoodsIssue.completed_at.desc().nullslast(), GoodsIssue.id.desc())
                .limit(1)
            )
        ).scalar_one_or_none()

    if goods_issue is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No linked completed goods issue for delivery note")

    items = list(
        (
            await db.execute(
                select(SalesOrderItem)
                .where(SalesOrderItem.sales_order_id == order.id)
                .order_by(SalesOrderItem.line_no.asc(), SalesOrderItem.id.asc())
            )
        ).scalars()
    )
    if not items:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Sales order has no items")

    pdf_bytes = await _build_delivery_note_pdf(order, goods_issue, items)

    max_version = (
        await db.execute(
            select(func.coalesce(func.max(Document.version), 0)).where(
                Document.entity_type == "sales_order",
                Document.entity_id == order.id,
                Document.document_type == "delivery_note",
            )
        )
    ).scalar_one()
    version = int(max_version) + 1

    storage_dir = _effective_storage_root() / "sales_order" / str(order.id) / "delivery_note"
    storage_dir.mkdir(parents=True, exist_ok=True)
    file_name = f"{order.order_number}-lieferschein.pdf"
    storage_name = f"v{version:03d}_{token_hex(4)}_{file_name}"
    storage_path = storage_dir / storage_name
    storage_path.write_bytes(pdf_bytes)

    doc = Document(
        entity_type="sales_order",
        entity_id=order.id,
        document_type="delivery_note",
        file_name=file_name,
        mime_type="application/pdf",
        file_size=len(pdf_bytes),
        storage_path=str(storage_path),
        version=version,
        uploaded_by=current_user.id,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    return {"document_id": doc.id, "message": "delivery note generated"}
