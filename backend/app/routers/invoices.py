import os
from datetime import UTC, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from secrets import token_hex

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_permissions
from app.models.auth import User
from app.models.phase3 import Document
from app.models.phase5 import BillingSetting, Invoice, InvoiceExport, InvoiceItem, SalesOrder, SalesOrderItem
from app.schemas.phase5 import (
    InvoiceCreate,
    InvoiceDetailResponse,
    InvoiceExportResponse,
    InvoiceItemResponse,
    InvoiceListResponse,
    InvoicePartialCreate,
    InvoiceResponse,
)
from app.services.einvoice import (
    EinvoiceValidationError,
    build_xrechnung_xml,
    build_zugferd_pdf,
    validate_en16931,
    validate_export_prerequisites,
)

router = APIRouter(prefix="/api/invoices", tags=["invoices"])


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

    items = list((await db.execute(select(InvoiceItem).where(InvoiceItem.invoice_id == invoice_id).order_by(InvoiceItem.line_no.asc(), InvoiceItem.id.asc()))).scalars())
    return InvoiceDetailResponse(invoice=_to_invoice_response(invoice), items=[_to_invoice_item_response(item) for item in items])


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


@router.get("", response_model=InvoiceListResponse)
async def list_invoices(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions("module.invoices.read")),
) -> InvoiceListResponse:
    total = int((await db.execute(select(func.count(Invoice.id)))).scalar_one())
    rows = list((await db.execute(select(Invoice).order_by(Invoice.id.desc()).offset((page - 1) * page_size).limit(page_size))).scalars())
    return InvoiceListResponse(items=[_to_invoice_response(row) for row in rows], total=total, page=page, page_size=page_size)


@router.post("", response_model=InvoiceDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_invoice(
    payload: InvoiceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("module.invoices.write")),
) -> InvoiceDetailResponse:
    order = await _ensure_sales_order_exists(db, payload.sales_order_id)

    items = list((await db.execute(select(SalesOrderItem).where(SalesOrderItem.sales_order_id == order.id).order_by(SalesOrderItem.line_no.asc(), SalesOrderItem.id.asc()))).scalars())
    if not items:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Sales order has no items")

    outstanding_items = [
        (item, Decimal(item.quantity) - Decimal(item.invoiced_quantity))
        for item in items
        if Decimal(item.quantity) - Decimal(item.invoiced_quantity) > 0
    ]
    if not outstanding_items:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Sales order already fully invoiced")

    due_at = payload.due_at
    if due_at is None:
        billing = (await db.execute(select(BillingSetting).order_by(BillingSetting.id.asc()))).scalar_one_or_none()
        days = int(billing.payment_terms_days) if billing is not None else 14
        due_at = _now() + timedelta(days=days)

    invoice = Invoice(
        invoice_number=(payload.invoice_number or _generate_invoice_number()).strip().upper(),
        sales_order_id=order.id,
        status="issued",
        issued_at=_now(),
        due_at=due_at,
        created_by=current_user.id,
        currency=order.currency,
        notes=payload.notes,
    )
    db.add(invoice)
    await db.flush()

    for order_item, quantity in outstanding_items:
        await _append_item_from_order_item(db, invoice=invoice, order_item=order_item, quantity=quantity)

    await _recompute_totals(db, invoice)
    await db.commit()

    return await _load_invoice_detail(db, invoice.id)


@router.get("/{invoice_id}", response_model=InvoiceDetailResponse)
async def get_invoice(
    invoice_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions("module.invoices.read")),
) -> InvoiceDetailResponse:
    return await _load_invoice_detail(db, invoice_id)


@router.post("/{invoice_id}/partial", response_model=InvoiceDetailResponse)
async def create_invoice_partial(
    invoice_id: int,
    payload: InvoicePartialCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions("module.invoices.write")),
) -> InvoiceDetailResponse:
    invoice = (await db.execute(select(Invoice).where(Invoice.id == invoice_id))).scalar_one_or_none()
    if invoice is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    if invoice.status == "cancelled":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cannot add partial items to cancelled invoice")

    if not payload.items:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="items must not be empty")

    order_items_by_id = {
        row.id: row
        for row in (
            await db.execute(select(SalesOrderItem).where(SalesOrderItem.sales_order_id == invoice.sales_order_id))
        ).scalars()
    }

    for raw in payload.items:
        sales_order_item_id = raw.get("sales_order_item_id")
        quantity_raw = raw.get("quantity")
        if sales_order_item_id is None or quantity_raw is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Each partial item requires sales_order_item_id and quantity",
            )

        order_item = order_items_by_id.get(int(sales_order_item_id))
        if order_item is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Sales order item not found: {sales_order_item_id}",
            )

        quantity = Decimal(str(quantity_raw))
        await _append_item_from_order_item(db, invoice=invoice, order_item=order_item, quantity=quantity)

    await _recompute_totals(db, invoice)
    await db.commit()

    return await _load_invoice_detail(db, invoice.id)


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


@router.post("/{invoice_id}/exports/xrechnung", response_model=InvoiceExportResponse)
async def export_xrechnung(
    invoice_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions("module.invoices.export")),
) -> InvoiceExportResponse:
    invoice = (await db.execute(select(Invoice).where(Invoice.id == invoice_id))).scalar_one_or_none()
    if invoice is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    items = list((await db.execute(select(InvoiceItem).where(InvoiceItem.invoice_id == invoice.id))).scalars())
    billing = (await db.execute(select(BillingSetting).order_by(BillingSetting.id.asc()))).scalar_one_or_none()
    if billing is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Billing settings missing")

    try:
        validate_export_prerequisites(invoice=invoice, invoice_items=items, billing_settings=billing)
        xml_bytes = build_xrechnung_xml(invoice=invoice, invoice_items=items, billing_settings=billing)
        report = validate_en16931(xml_bytes)
    except EinvoiceValidationError as exc:
        export = InvoiceExport(
            invoice_id=invoice.id,
            export_type="xrechnung",
            status="validation_error",
            document_id=None,
            validator_report_json=exc.report,
            exported_at=None,
            error_message=exc.message,
        )
        db.add(export)
        await db.commit()
        await db.refresh(export)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=exc.message,
        ) from exc

    document = await _store_invoice_document(
        db,
        invoice=invoice,
        document_type="xrechnung",
        file_name=f"{invoice.invoice_number}-xrechnung.xml",
        mime_type="application/xml",
        content=xml_bytes,
        uploaded_by=invoice.created_by,
    )
    export = InvoiceExport(
        invoice_id=invoice.id,
        export_type="xrechnung",
        status="generated",
        document_id=document.id,
        validator_report_json=report,
        exported_at=_now(),
        error_message=None,
    )
    db.add(export)
    await db.commit()
    await db.refresh(export)

    return InvoiceExportResponse(
        export_id=export.id,
        invoice_id=invoice.id,
        export_type=export.export_type,
        status=export.status,
        document_id=export.document_id,
        error_message=export.error_message,
        validator_report=export.validator_report_json,
    )


@router.post("/{invoice_id}/exports/zugferd", response_model=InvoiceExportResponse)
async def export_zugferd(
    invoice_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions("module.invoices.export")),
) -> InvoiceExportResponse:
    invoice = (await db.execute(select(Invoice).where(Invoice.id == invoice_id))).scalar_one_or_none()
    if invoice is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    items = list((await db.execute(select(InvoiceItem).where(InvoiceItem.invoice_id == invoice.id))).scalars())
    billing = (await db.execute(select(BillingSetting).order_by(BillingSetting.id.asc()))).scalar_one_or_none()
    if billing is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Billing settings missing")

    try:
        validate_export_prerequisites(invoice=invoice, invoice_items=items, billing_settings=billing)
        xml_bytes = build_xrechnung_xml(invoice=invoice, invoice_items=items, billing_settings=billing)
        report = validate_en16931(xml_bytes)
        pdf_bytes = build_zugferd_pdf(invoice=invoice, invoice_items=items, xml_bytes=xml_bytes)
    except EinvoiceValidationError as exc:
        export = InvoiceExport(
            invoice_id=invoice.id,
            export_type="zugferd",
            status="validation_error",
            document_id=None,
            validator_report_json=exc.report,
            exported_at=None,
            error_message=exc.message,
        )
        db.add(export)
        await db.commit()
        await db.refresh(export)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=exc.message,
        ) from exc

    document = await _store_invoice_document(
        db,
        invoice=invoice,
        document_type="zugferd",
        file_name=f"{invoice.invoice_number}-zugferd.pdf",
        mime_type="application/pdf",
        content=pdf_bytes,
        uploaded_by=invoice.created_by,
    )
    export = InvoiceExport(
        invoice_id=invoice.id,
        export_type="zugferd",
        status="generated",
        document_id=document.id,
        validator_report_json=report,
        exported_at=_now(),
        error_message=None,
    )
    db.add(export)
    await db.commit()
    await db.refresh(export)

    return InvoiceExportResponse(
        export_id=export.id,
        invoice_id=invoice.id,
        export_type=export.export_type,
        status=export.status,
        document_id=export.document_id,
        error_message=export.error_message,
        validator_report=export.validator_report_json,
    )
