import os
from datetime import UTC, datetime
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from secrets import token_hex

from fastapi import APIRouter, Depends, HTTPException, Query, status
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_permissions
from app.models.auth import User
from app.models.catalog import Customer, Product
from app.models.inventory import GoodsIssue
from app.models.phase3 import Document
from app.models.phase5 import (
    CustomerProductPrice,
    ProductBasePrice,
    SalesOrder,
    SalesOrderGoodsIssueLink,
    SalesOrderItem,
    Service,
)
from app.schemas.phase5 import (
    SalesOrderCreate,
    SalesOrderDeliveryNoteLinkPayload,
    SalesOrderDetailResponse,
    SalesOrderItemCreate,
    SalesOrderItemResponse,
    SalesOrderListResponse,
    SalesOrderResponse,
    SalesOrderUpdate,
)

router = APIRouter(prefix="/api/sales-orders", tags=["sales-orders"])


def _now() -> datetime:
    return datetime.now(UTC)


def _normalize_vat_rate(value: Decimal) -> Decimal:
    normalized = Decimal(value).quantize(Decimal("0.01"))
    if normalized not in {Decimal("0"), Decimal("7"), Decimal("19")}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="vat_rate must be one of 0, 7, 19")
    return normalized


def _gross(net: Decimal, vat_rate: Decimal) -> Decimal:
    return (net * (Decimal("1") + vat_rate / Decimal("100"))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _generate_order_number() -> str:
    return f"SO-{_now().strftime('%Y%m%d%H%M%S')}-{token_hex(2).upper()}"


def _effective_storage_root() -> Path:
    configured = Path(os.getenv("DIRECTSTOCK_DOCUMENT_STORAGE_ROOT", "/app/data/documents"))
    try:
        configured.mkdir(parents=True, exist_ok=True)
        return configured
    except OSError:
        fallback = Path.cwd() / ".documents"
        fallback.mkdir(parents=True, exist_ok=True)
        return fallback


def _to_order_response(item: SalesOrder) -> SalesOrderResponse:
    return SalesOrderResponse(
        id=item.id,
        order_number=item.order_number,
        customer_id=item.customer_id,
        status=item.status,
        ordered_at=item.ordered_at,
        completed_at=item.completed_at,
        created_by=item.created_by,
        currency=item.currency,
        notes=item.notes,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _to_item_response(item: SalesOrderItem) -> SalesOrderItemResponse:
    net = Decimal(item.net_unit_price)
    vat = Decimal(item.vat_rate)
    return SalesOrderItemResponse(
        id=item.id,
        sales_order_id=item.sales_order_id,
        line_no=item.line_no,
        item_type=item.item_type,
        product_id=item.product_id,
        service_id=item.service_id,
        description=item.description,
        quantity=Decimal(item.quantity),
        delivered_quantity=Decimal(item.delivered_quantity),
        invoiced_quantity=Decimal(item.invoiced_quantity),
        unit=item.unit,
        net_unit_price=net,
        vat_rate=vat,
        gross_unit_price=_gross(net, vat),
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


async def _resolve_product_price(
    db: AsyncSession,
    *,
    product_id: int,
    customer_id: int | None,
) -> tuple[Decimal, Decimal]:
    now = _now()

    if customer_id is not None:
        customer_price = (
            await db.execute(
                select(CustomerProductPrice)
                .where(
                    CustomerProductPrice.customer_id == customer_id,
                    CustomerProductPrice.product_id == product_id,
                    CustomerProductPrice.is_active.is_(True),
                    CustomerProductPrice.valid_from <= now,
                    or_(CustomerProductPrice.valid_to.is_(None), CustomerProductPrice.valid_to >= now),
                )
                .order_by(CustomerProductPrice.valid_from.desc(), CustomerProductPrice.id.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if customer_price is not None:
            return Decimal(customer_price.net_price), Decimal(customer_price.vat_rate)

    base_price = (
        await db.execute(
            select(ProductBasePrice)
            .where(
                ProductBasePrice.product_id == product_id,
                ProductBasePrice.is_active.is_(True),
                or_(ProductBasePrice.valid_from.is_(None), ProductBasePrice.valid_from <= now),
                or_(ProductBasePrice.valid_to.is_(None), ProductBasePrice.valid_to >= now),
            )
            .order_by(ProductBasePrice.valid_from.desc().nullslast(), ProductBasePrice.id.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    if base_price is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No price found for product")
    return Decimal(base_price.net_price), Decimal(base_price.vat_rate)


async def _validate_item_reference(db: AsyncSession, payload: SalesOrderItemCreate) -> None:
    if payload.item_type == "product":
        if payload.product_id is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="product_id is required for product item")
        exists = (await db.execute(select(Product.id).where(Product.id == payload.product_id))).scalar_one_or_none()
        if exists is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    elif payload.item_type == "service":
        if payload.service_id is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="service_id is required for service item")
        exists = (await db.execute(select(Service.id).where(Service.id == payload.service_id))).scalar_one_or_none()
        if exists is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")


async def _create_order_item(db: AsyncSession, order: SalesOrder, payload: SalesOrderItemCreate) -> SalesOrderItem:
    await _validate_item_reference(db, payload)

    if payload.net_unit_price is not None and payload.vat_rate is not None:
        net_price = payload.net_unit_price
        vat_rate = _normalize_vat_rate(payload.vat_rate)
    elif payload.item_type == "service":
        service = (await db.execute(select(Service).where(Service.id == payload.service_id))).scalar_one()
        net_price = Decimal(service.net_price)
        vat_rate = Decimal(service.vat_rate)
    else:
        net_price, vat_rate = await _resolve_product_price(
            db,
            product_id=payload.product_id or 0,
            customer_id=order.customer_id,
        )

    next_line_no = int(
        (
            await db.execute(
                select(func.coalesce(func.max(SalesOrderItem.line_no), 0)).where(SalesOrderItem.sales_order_id == order.id)
            )
        ).scalar_one()
    ) + 1

    item = SalesOrderItem(
        sales_order_id=order.id,
        line_no=next_line_no,
        item_type=payload.item_type,
        product_id=payload.product_id,
        service_id=payload.service_id,
        description=payload.description,
        quantity=payload.quantity,
        delivered_quantity=Decimal("0"),
        invoiced_quantity=Decimal("0"),
        unit=payload.unit,
        net_unit_price=net_price,
        vat_rate=_normalize_vat_rate(vat_rate),
    )
    db.add(item)
    return item


async def _build_delivery_note_pdf(order: SalesOrder, goods_issue: GoodsIssue, items: list[SalesOrderItem]) -> bytes:
    from io import BytesIO

    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    pdf.setTitle(f"Lieferschein {order.order_number}")

    pdf.drawString(40, 800, f"DirectStock Lieferschein")
    pdf.drawString(40, 782, f"Sales Order: {order.order_number}")
    pdf.drawString(40, 764, f"Goods Issue: {goods_issue.issue_number}")
    pdf.drawString(40, 746, f"Created: {_now().isoformat()}")

    y = 710
    pdf.drawString(40, y, "Pos")
    pdf.drawString(70, y, "Typ")
    pdf.drawString(130, y, "Referenz")
    pdf.drawString(300, y, "Menge")
    y -= 18

    for item in items:
        ref = f"PRD:{item.product_id}" if item.item_type == "product" else f"SRV:{item.service_id}"
        pdf.drawString(40, y, str(item.line_no))
        pdf.drawString(70, y, item.item_type)
        pdf.drawString(130, y, ref)
        pdf.drawString(300, y, f"{item.quantity} {item.unit}")
        y -= 16
        if y < 80:
            pdf.showPage()
            y = 780

    pdf.save()
    return buffer.getvalue()


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
    return SalesOrderListResponse(items=[_to_order_response(row) for row in rows], total=total, page=page, page_size=page_size)


@router.post("", response_model=SalesOrderDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_sales_order(
    payload: SalesOrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("module.sales_orders.write")),
) -> SalesOrderDetailResponse:
    if payload.customer_id is not None:
        customer = (await db.execute(select(Customer.id).where(Customer.id == payload.customer_id))).scalar_one_or_none()
        if customer is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

    row = SalesOrder(
        order_number=(payload.order_number or _generate_order_number()).strip().upper(),
        customer_id=payload.customer_id,
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
    return SalesOrderDetailResponse(order=_to_order_response(order), items=[_to_item_response(item) for item in items])


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
    if "status" in updates and updates["status"] == "completed":
        updates["completed_at"] = _now()
    if "currency" in updates and updates["currency"] is not None:
        updates["currency"] = updates["currency"].upper()

    for key, value in updates.items():
        setattr(order, key, value)

    await db.commit()
    await db.refresh(order)
    return _to_order_response(order)


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
        goods_issue = (
            await db.execute(
                select(GoodsIssue)
                .where(GoodsIssue.customer_id == order.customer_id, GoodsIssue.status == "completed")
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
