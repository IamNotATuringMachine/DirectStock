import os
from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path
from secrets import token_hex

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.phase3 import Document
from app.models.phase5 import Invoice, InvoiceItem, SalesOrder, SalesOrderItem
from app.schemas.phase5 import InvoiceDetailResponse, InvoiceItemResponse, InvoiceResponse


def _now() -> datetime:
    return datetime.now(UTC)


def _quantize_money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _gross_for_unit(net_unit_price: Decimal, vat_rate: Decimal) -> Decimal:
    return _quantize_money(net_unit_price * (Decimal("1") + vat_rate / Decimal("100")))


def _effective_storage_root() -> Path:
    configured = Path(os.getenv("DIRECTSTOCK_DOCUMENT_STORAGE_ROOT", "/app/data/documents"))
    try:
        configured.mkdir(parents=True, exist_ok=True)
        return configured
    except OSError:
        fallback = Path.cwd() / ".documents"
        fallback.mkdir(parents=True, exist_ok=True)
        return fallback


def _to_invoice_response(item: Invoice) -> InvoiceResponse:
    return InvoiceResponse(
        id=item.id,
        invoice_number=item.invoice_number,
        sales_order_id=item.sales_order_id,
        status=item.status,
        issued_at=item.issued_at,
        due_at=item.due_at,
        created_by=item.created_by,
        currency=item.currency,
        total_net=Decimal(item.total_net),
        total_tax=Decimal(item.total_tax),
        total_gross=Decimal(item.total_gross),
        notes=item.notes,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _to_invoice_item_response(item: InvoiceItem) -> InvoiceItemResponse:
    return InvoiceItemResponse(
        id=item.id,
        invoice_id=item.invoice_id,
        sales_order_item_id=item.sales_order_item_id,
        line_no=item.line_no,
        description=item.description,
        quantity=Decimal(item.quantity),
        unit=item.unit,
        net_unit_price=Decimal(item.net_unit_price),
        vat_rate=Decimal(item.vat_rate),
        net_total=Decimal(item.net_total),
        tax_total=Decimal(item.tax_total),
        gross_total=Decimal(item.gross_total),
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _generate_invoice_number() -> str:
    return f"INV-{_now().strftime('%Y%m%d%H%M%S')}-{token_hex(2).upper()}"


async def _load_invoice_detail(db: AsyncSession, invoice_id: int) -> InvoiceDetailResponse:
    invoice = (await db.execute(select(Invoice).where(Invoice.id == invoice_id))).scalar_one_or_none()
    if invoice is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    items = list(
        (
            await db.execute(
                select(InvoiceItem)
                .where(InvoiceItem.invoice_id == invoice_id)
                .order_by(InvoiceItem.line_no.asc(), InvoiceItem.id.asc())
            )
        ).scalars()
    )
    return InvoiceDetailResponse(
        invoice=_to_invoice_response(invoice),
        items=[_to_invoice_item_response(item) for item in items],
    )


async def _recompute_totals(db: AsyncSession, invoice: Invoice) -> None:
    rows = list((await db.execute(select(InvoiceItem).where(InvoiceItem.invoice_id == invoice.id))).scalars())
    total_net = sum((Decimal(row.net_total) for row in rows), Decimal("0"))
    total_tax = sum((Decimal(row.tax_total) for row in rows), Decimal("0"))
    total_gross = sum((Decimal(row.gross_total) for row in rows), Decimal("0"))
    invoice.total_net = _quantize_money(total_net)
    invoice.total_tax = _quantize_money(total_tax)
    invoice.total_gross = _quantize_money(total_gross)


async def _append_item_from_order_item(
    db: AsyncSession,
    *,
    invoice: Invoice,
    order_item: SalesOrderItem,
    quantity: Decimal,
) -> InvoiceItem:
    if quantity <= 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Quantity must be > 0")

    outstanding = Decimal(order_item.quantity) - Decimal(order_item.invoiced_quantity)
    if quantity > outstanding:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Over-invoicing blocked for sales_order_item_id={order_item.id}",
        )

    net_unit = Decimal(order_item.net_unit_price)
    vat_rate = Decimal(order_item.vat_rate)
    net_total = _quantize_money(net_unit * quantity)
    tax_total = _quantize_money(net_total * vat_rate / Decimal("100"))
    gross_total = _quantize_money(net_total + tax_total)

    next_line_no = int(
        (
            await db.execute(
                select(func.coalesce(func.max(InvoiceItem.line_no), 0)).where(InvoiceItem.invoice_id == invoice.id)
            )
        ).scalar_one()
    ) + 1

    item = InvoiceItem(
        invoice_id=invoice.id,
        sales_order_item_id=order_item.id,
        line_no=next_line_no,
        description=order_item.description,
        quantity=quantity,
        unit=order_item.unit,
        net_unit_price=net_unit,
        vat_rate=vat_rate,
        net_total=net_total,
        tax_total=tax_total,
        gross_total=gross_total,
    )
    db.add(item)

    order_item.invoiced_quantity = Decimal(order_item.invoiced_quantity) + quantity
    return item


async def _ensure_sales_order_exists(db: AsyncSession, sales_order_id: int) -> SalesOrder:
    order = (await db.execute(select(SalesOrder).where(SalesOrder.id == sales_order_id))).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sales order not found")
    return order


async def _store_invoice_document(
    db: AsyncSession,
    *,
    invoice: Invoice,
    document_type: str,
    file_name: str,
    mime_type: str,
    content: bytes,
    uploaded_by: int | None,
) -> Document:
    max_version = (
        await db.execute(
            select(func.coalesce(func.max(Document.version), 0)).where(
                Document.entity_type == "invoice",
                Document.entity_id == invoice.id,
                Document.document_type == document_type,
            )
        )
    ).scalar_one()
    version = int(max_version) + 1

    storage_dir = _effective_storage_root() / "invoice" / str(invoice.id) / document_type
    storage_dir.mkdir(parents=True, exist_ok=True)
    storage_name = f"v{version:03d}_{token_hex(4)}_{file_name}"
    storage_path = storage_dir / storage_name
    storage_path.write_bytes(content)

    document = Document(
        entity_type="invoice",
        entity_id=invoice.id,
        document_type=document_type,
        file_name=file_name,
        mime_type=mime_type,
        file_size=len(content),
        storage_path=str(storage_path),
        version=version,
        uploaded_by=uploaded_by,
    )
    db.add(document)
    await db.flush()
    return document
