import os
from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path
from secrets import token_hex

from fastapi import HTTPException, status
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.catalog import Customer, CustomerLocation, Product
from app.models.inventory import GoodsIssue
from app.models.phase5 import CustomerProductPrice, ProductBasePrice, SalesOrder, SalesOrderItem
from app.schemas.operators import OperationSignoffSummary
from app.schemas.phase5 import SalesOrderItemCreate, SalesOrderItemResponse, SalesOrderResponse


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


def _to_order_response(
    item: SalesOrder,
    *,
    operation_signoff: OperationSignoffSummary | None = None,
) -> SalesOrderResponse:
    return SalesOrderResponse(
        id=item.id,
        order_number=item.order_number,
        customer_id=item.customer_id,
        customer_location_id=item.customer_location_id,
        status=item.status,
        ordered_at=item.ordered_at,
        completed_at=item.completed_at,
        created_by=item.created_by,
        operation_signoff=operation_signoff,
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


async def _resolve_customer_scope(
    db: AsyncSession,
    *,
    customer_id: int | None,
    customer_location_id: int | None,
) -> tuple[int | None, int | None]:
    if customer_location_id is None:
        if customer_id is None:
            return None, None
        customer = (await db.execute(select(Customer.id).where(Customer.id == customer_id))).scalar_one_or_none()
        if customer is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
        return customer_id, None

    location = (
        await db.execute(select(CustomerLocation).where(CustomerLocation.id == customer_location_id))
    ).scalar_one_or_none()
    if location is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer location not found")

    resolved_customer_id = int(location.customer_id)
    if customer_id is not None and customer_id != resolved_customer_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Customer location does not belong to selected customer",
        )

    return resolved_customer_id, customer_location_id


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
    exists = (await db.execute(select(Product.id).where(Product.id == payload.product_id))).scalar_one_or_none()
    if exists is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")


async def _create_order_item(db: AsyncSession, order: SalesOrder, payload: SalesOrderItemCreate) -> SalesOrderItem:
    await _validate_item_reference(db, payload)

    if payload.net_unit_price is not None and payload.vat_rate is not None:
        net_price = payload.net_unit_price
        vat_rate = _normalize_vat_rate(payload.vat_rate)
    else:
        net_price, vat_rate = await _resolve_product_price(
            db,
            product_id=payload.product_id,
            customer_id=order.customer_id,
        )

    next_line_no = int(
        (
            await db.execute(
                select(
                    func.coalesce(func.max(SalesOrderItem.line_no), 0)
                )
                .where(SalesOrderItem.sales_order_id == order.id)
            )
        ).scalar_one()
    ) + 1

    item = SalesOrderItem(
        sales_order_id=order.id,
        line_no=next_line_no,
        item_type=payload.item_type,
        product_id=payload.product_id,
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

    pdf.drawString(40, 800, "DirectStock Lieferschein")
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
        ref = f"PRD:{item.product_id}"
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
