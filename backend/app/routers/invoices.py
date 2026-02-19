from datetime import timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_permissions
from app.models.auth import User
from app.models.phase5 import BillingSetting, Invoice, InvoiceExport, InvoiceItem, SalesOrderItem
from app.routers.invoices_helpers import (
    _append_item_from_order_item,
    _ensure_sales_order_exists,
    _generate_invoice_number,
    _load_invoice_detail,
    _now,
    _recompute_totals,
    _store_invoice_document,
    _to_invoice_response,
)
from app.schemas.phase5 import (
    InvoiceCreate,
    InvoiceDetailResponse,
    InvoiceExportResponse,
    InvoiceListResponse,
    InvoicePartialCreate,
)
from app.services.einvoice import (
    EinvoiceValidationError,
    build_xrechnung_xml,
    build_zugferd_pdf,
    validate_en16931,
    validate_export_prerequisites,
)

router = APIRouter(prefix="/api/invoices", tags=["invoices"])


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
