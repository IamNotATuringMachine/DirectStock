from __future__ import annotations

import asyncio
import imaplib
import os
import re
import smtplib
from dataclasses import dataclass
from datetime import UTC, datetime
from email import policy
from email.message import EmailMessage
from email.parser import BytesParser
from email.utils import make_msgid, parseaddr, parsedate_to_datetime
from io import BytesIO
from pathlib import Path

from fastapi import HTTPException, status
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.models.catalog import Product, Supplier
from app.models.phase5 import PurchaseEmailSetting
from app.models.phase3 import Document
from app.models.purchasing import PurchaseOrder, PurchaseOrderEmailEvent, PurchaseOrderItem

ALLOWED_TEMPLATE_PLACEHOLDERS = {
    "supplier_company_name",
    "supplier_contact_name",
    "salutation",
    "order_number",
    "items_table",
    "sender_name",
    "sender_email",
}

_ORDER_NUMBER_PATTERN = re.compile(r"\bPO-\d{14}-[A-F0-9]{4}\b")
_PLACEHOLDER_PATTERN = re.compile(r"\{([a-zA-Z0-9_]+)\}")


@dataclass(slots=True)
class MailSyncResult:
    processed: int = 0
    matched: int = 0
    skipped: int = 0
    imported_document_ids: list[int] | None = None


class _SafeDict(dict):
    def __missing__(self, key: str) -> str:
        return "{" + key + "}"


def _now() -> datetime:
    return datetime.now(UTC)


def _normalize_message_id(raw: str | None) -> str | None:
    if raw is None:
        return None
    value = raw.strip()
    return value or None


def _parse_email_addresses(value: str | None) -> list[str]:
    if not value:
        return []
    normalized = value.replace(";", ",").replace("\n", ",")
    values = [chunk.strip() for chunk in normalized.split(",")]
    deduped: list[str] = []
    seen: set[str] = set()
    for candidate in values:
        if not candidate:
            continue
        key = candidate.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(candidate)
    return deduped


def _merge_email_addresses(*groups: list[str]) -> list[str]:
    merged: list[str] = []
    seen: set[str] = set()
    for group in groups:
        for entry in group:
            key = entry.lower()
            if key in seen:
                continue
            seen.add(key)
            merged.append(entry)
    return merged


async def _load_active_purchase_email_profile(db: AsyncSession) -> PurchaseEmailSetting | None:
    active = (
        await db.execute(
            select(PurchaseEmailSetting)
            .where(PurchaseEmailSetting.is_active.is_(True))
            .order_by(PurchaseEmailSetting.id.asc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if active is not None:
        return active
    return (
        await db.execute(select(PurchaseEmailSetting).order_by(PurchaseEmailSetting.id.asc()).limit(1))
    ).scalar_one_or_none()


async def resolve_purchase_email_settings(
    db: AsyncSession,
    *,
    base_settings: Settings | None = None,
) -> Settings:
    settings = base_settings or get_settings()
    row = await _load_active_purchase_email_profile(db)
    if row is None:
        return settings

    return settings.model_copy(
        update={
            "purchase_email_smtp_enabled": row.smtp_enabled,
            "purchase_email_smtp_host": row.smtp_host or "",
            "purchase_email_smtp_port": row.smtp_port,
            "purchase_email_smtp_username": row.smtp_username or "",
            "purchase_email_smtp_password": row.smtp_password or "",
            "purchase_email_smtp_use_tls": row.smtp_use_tls,
            "purchase_email_from_address": row.from_address,
            "purchase_email_reply_to_address": row.reply_to_address,
            "purchase_email_sender_name": row.sender_name,
            "purchase_email_imap_enabled": row.imap_enabled,
            "purchase_email_imap_host": row.imap_host or "",
            "purchase_email_imap_port": row.imap_port,
            "purchase_email_imap_username": row.imap_username or "",
            "purchase_email_imap_password": row.imap_password or "",
            "purchase_email_imap_mailbox": row.imap_mailbox,
            "purchase_email_imap_use_ssl": row.imap_use_ssl,
            "purchase_email_poll_interval_seconds": row.poll_interval_seconds,
        }
    )


def _extract_placeholders(value: str | None) -> set[str]:
    if not value:
        return set()
    return set(_PLACEHOLDER_PATTERN.findall(value))


def validate_purchase_email_templates(
    *,
    salutation: str | None,
    subject_template: str | None,
    body_template: str | None,
    signature: str | None,
) -> None:
    invalid = (
        _extract_placeholders(salutation)
        | _extract_placeholders(subject_template)
        | _extract_placeholders(body_template)
        | _extract_placeholders(signature)
    ) - ALLOWED_TEMPLATE_PLACEHOLDERS
    if invalid:
        allowed = ", ".join(sorted(ALLOWED_TEMPLATE_PLACEHOLDERS))
        invalid_values = ", ".join(sorted(invalid))
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unknown template placeholders: {invalid_values}. Allowed placeholders: {allowed}",
        )


def _effective_storage_root() -> Path:
    configured = Path(os.getenv("DIRECTSTOCK_DOCUMENT_STORAGE_ROOT", "/app/data/documents"))
    try:
        configured.mkdir(parents=True, exist_ok=True)
        return configured
    except OSError:
        fallback = Path.cwd() / ".documents"
        fallback.mkdir(parents=True, exist_ok=True)
        return fallback


def _render_template(template: str, context: dict[str, str]) -> str:
    try:
        return template.format_map(_SafeDict(context))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid template formatting: {exc}",
        ) from exc


def _build_items_table(rows: list[tuple[PurchaseOrderItem, Product]]) -> str:
    lines = ["Anzahl | Artikelnummer | Produktname", "------ | ------------- | ----------"]
    for po_item, product in rows:
        lines.append(f"{po_item.ordered_quantity} | {product.product_number or '-'} | {product.name or '-'}")
    return "\n".join(lines)


def _build_purchase_order_pdf(
    *,
    order: PurchaseOrder,
    supplier: Supplier,
    rows: list[tuple[PurchaseOrderItem, Product]],
) -> bytes:
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    pdf.setTitle(f"Bestellung {order.order_number}")

    pdf.drawString(40, 800, "DirectStock Bestellung")
    pdf.drawString(40, 782, f"Bestellnummer: {order.order_number}")
    pdf.drawString(40, 764, f"Lieferant: {supplier.company_name}")
    pdf.drawString(40, 746, f"Erstellt: {order.created_at.isoformat()}")
    if order.notes:
        pdf.drawString(40, 728, f"Notiz: {order.notes[:120]}")

    y = 690
    pdf.drawString(40, y, "Pos")
    pdf.drawString(80, y, "Anzahl")
    pdf.drawString(170, y, "Artikelnummer")
    pdf.drawString(320, y, "Produktname")
    y -= 18

    for idx, (po_item, product) in enumerate(rows, start=1):
        pdf.drawString(40, y, str(idx))
        pdf.drawString(80, y, str(po_item.ordered_quantity))
        pdf.drawString(170, y, str(product.product_number or "-"))
        pdf.drawString(320, y, str(product.name or "-"))
        y -= 16
        if y < 80:
            pdf.showPage()
            y = 780

    pdf.save()
    return buffer.getvalue()


async def _store_purchase_order_document(
    db: AsyncSession,
    *,
    order: PurchaseOrder,
    document_type: str,
    file_name: str,
    mime_type: str,
    content: bytes,
    uploaded_by: int | None,
) -> Document:
    max_version = (
        await db.execute(
            select(func.coalesce(func.max(Document.version), 0)).where(
                Document.entity_type == "purchase_order",
                Document.entity_id == order.id,
                Document.document_type == document_type,
            )
        )
    ).scalar_one()
    version = int(max_version) + 1

    storage_dir = _effective_storage_root() / "purchase_order" / str(order.id) / document_type
    storage_dir.mkdir(parents=True, exist_ok=True)
    storage_name = f"v{version:03d}_{file_name}"
    storage_path = storage_dir / storage_name
    storage_path.write_bytes(content)

    document = Document(
        entity_type="purchase_order",
        entity_id=order.id,
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


def _send_email_sync(
    *,
    settings: Settings,
    to_addresses: list[str],
    cc_addresses: list[str],
    subject: str,
    body: str,
    message_id: str,
    pdf_bytes: bytes,
    pdf_file_name: str,
) -> dict[str, bool]:
    if not settings.purchase_email_smtp_enabled:
        return {"simulated": True}

    if not settings.purchase_email_smtp_host.strip():
        raise RuntimeError("SMTP is enabled but PURCHASE_EMAIL_SMTP_HOST is empty")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.purchase_email_from_address
    msg["To"] = ", ".join(to_addresses)
    if cc_addresses:
        msg["Cc"] = ", ".join(cc_addresses)
    msg["Reply-To"] = settings.purchase_email_reply_to_address
    msg["Message-ID"] = message_id
    msg.set_content(body)
    msg.add_attachment(
        pdf_bytes,
        maintype="application",
        subtype="pdf",
        filename=pdf_file_name,
    )

    with smtplib.SMTP(settings.purchase_email_smtp_host, settings.purchase_email_smtp_port, timeout=30) as smtp:
        smtp.ehlo()
        if settings.purchase_email_smtp_use_tls:
            smtp.starttls()
            smtp.ehlo()
        if settings.purchase_email_smtp_username:
            smtp.login(settings.purchase_email_smtp_username, settings.purchase_email_smtp_password)
        smtp.send_message(msg, to_addrs=[*to_addresses, *cc_addresses])

    return {"simulated": False}


async def send_purchase_order_email(
    db: AsyncSession,
    *,
    order_id: int,
    current_user_id: int | None,
) -> tuple[PurchaseOrder, PurchaseOrderEmailEvent, Document, str]:
    order = (await db.execute(select(PurchaseOrder).where(PurchaseOrder.id == order_id))).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")

    if order.supplier_comm_status != "open_unsent":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Purchase order is not in open_unsent state",
        )

    if order.supplier_id is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Purchase order requires a supplier before sending",
        )

    supplier = (await db.execute(select(Supplier).where(Supplier.id == order.supplier_id))).scalar_one_or_none()
    if supplier is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
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
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Purchase order has no items",
        )

    settings = await resolve_purchase_email_settings(db)
    active_profile = await _load_active_purchase_email_profile(db)
    supplier_addresses = _parse_email_addresses(supplier.email)
    default_to_addresses = _parse_email_addresses(
        active_profile.default_to_addresses if active_profile is not None else settings.purchase_email_default_to_addresses
    )
    default_cc_addresses = _parse_email_addresses(
        active_profile.default_cc_addresses if active_profile is not None else settings.purchase_email_default_cc_addresses
    )
    to_addresses = _merge_email_addresses(supplier_addresses, default_to_addresses)
    cc_addresses = _merge_email_addresses(default_cc_addresses)
    if not to_addresses:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No recipient email addresses configured for this supplier/order",
        )
    salutation_template = supplier.purchase_email_salutation or settings.purchase_email_default_salutation
    subject_template = supplier.purchase_email_subject_template or settings.purchase_email_default_subject_template
    body_template = supplier.purchase_email_body_template or settings.purchase_email_default_body_template
    signature_template = supplier.purchase_email_signature or settings.purchase_email_default_signature

    validate_purchase_email_templates(
        salutation=salutation_template,
        subject_template=subject_template,
        body_template=body_template,
        signature=signature_template,
    )

    context = {
        "supplier_company_name": supplier.company_name,
        "supplier_contact_name": supplier.contact_name or "",
        "salutation": _render_template(salutation_template, {
            "supplier_company_name": supplier.company_name,
            "supplier_contact_name": supplier.contact_name or "",
            "sender_name": settings.purchase_email_sender_name,
            "sender_email": settings.purchase_email_from_address,
            "order_number": order.order_number,
            "items_table": "",
            "salutation": "",
        }),
        "order_number": order.order_number,
        "items_table": _build_items_table(rows),
        "sender_name": settings.purchase_email_sender_name,
        "sender_email": settings.purchase_email_from_address,
    }

    subject = _render_template(subject_template, context).strip()
    body_main = _render_template(body_template, context).strip()
    signature = _render_template(signature_template, context).strip()
    body = f"{body_main}\n\n{signature}" if signature else body_main

    pdf_bytes = _build_purchase_order_pdf(order=order, supplier=supplier, rows=rows)
    pdf_file_name = f"{order.order_number}-bestellung.pdf"
    pdf_document = await _store_purchase_order_document(
        db,
        order=order,
        document_type="purchase_order_pdf",
        file_name=pdf_file_name,
        mime_type="application/pdf",
        content=pdf_bytes,
        uploaded_by=current_user_id,
    )

    message_id = make_msgid(domain="directstock.local")
    now = _now()
    try:
        dispatch_result = await asyncio.to_thread(
            _send_email_sync,
            settings=settings,
            to_addresses=to_addresses,
            cc_addresses=cc_addresses,
            subject=subject,
            body=body,
            message_id=message_id,
            pdf_bytes=pdf_bytes,
            pdf_file_name=pdf_file_name,
        )
    except Exception as exc:
        event = PurchaseOrderEmailEvent(
            purchase_order_id=order.id,
            direction="outbound",
            event_type="failed",
            message_id=message_id,
            in_reply_to=None,
            subject=subject,
            from_address=settings.purchase_email_from_address,
            to_address=", ".join(to_addresses),
            occurred_at=now,
            document_id=pdf_document.id,
            created_by=current_user_id,
            metadata_json={"error": str(exc), "cc_addresses": cc_addresses},
        )
        db.add(event)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to send purchase order email: {exc}",
        ) from exc

    order.supplier_comm_status = "waiting_reply"
    order.supplier_email_sent_at = now
    order.supplier_outbound_message_id = message_id
    order.supplier_last_sync_at = now
    if order.status == "approved":
        order.status = "ordered"
        if order.ordered_at is None:
            order.ordered_at = now

    event = PurchaseOrderEmailEvent(
        purchase_order_id=order.id,
        direction="outbound",
        event_type="sent",
        message_id=message_id,
        in_reply_to=None,
        subject=subject,
        from_address=settings.purchase_email_from_address,
        to_address=", ".join(to_addresses),
        occurred_at=now,
        document_id=pdf_document.id,
        created_by=current_user_id,
        metadata_json={"simulated": dispatch_result.get("simulated", False), "cc_addresses": cc_addresses},
    )
    db.add(event)
    await db.commit()
    await db.refresh(order)
    await db.refresh(event)

    return order, event, pdf_document, message_id


def _fetch_imap_messages_sync(settings: Settings, *, max_messages: int) -> list[bytes]:
    if settings.purchase_email_imap_use_ssl:
        client = imaplib.IMAP4_SSL(settings.purchase_email_imap_host, settings.purchase_email_imap_port)
    else:
        client = imaplib.IMAP4(settings.purchase_email_imap_host, settings.purchase_email_imap_port)

    try:
        client.login(settings.purchase_email_imap_username, settings.purchase_email_imap_password)
        client.select(settings.purchase_email_imap_mailbox)
        status_code, payload = client.search(None, "ALL")
        if status_code != "OK" or not payload:
            return []

        ids = payload[0].split()
        if not ids:
            return []

        messages: list[bytes] = []
        for message_id in ids[-max_messages:]:
            fetch_status, data = client.fetch(message_id, "(RFC822)")
            if fetch_status != "OK" or not data:
                continue
            for part in data:
                if isinstance(part, tuple) and len(part) >= 2 and isinstance(part[1], bytes):
                    messages.append(part[1])
                    break
        return messages
    finally:
        try:
            client.close()
        except Exception:
            pass
        client.logout()


def _extract_reference_ids(value: str | None) -> list[str]:
    if not value:
        return []
    return [chunk.strip() for chunk in value.split() if chunk.strip()]


async def _match_order_for_reply(
    db: AsyncSession,
    *,
    in_reply_to: str | None,
    references: list[str],
    subject: str | None,
) -> PurchaseOrder | None:
    message_ids = [mid for mid in [in_reply_to, *references] if mid]
    for outbound_message_id in message_ids:
        matched = (
            await db.execute(
                select(PurchaseOrder).where(PurchaseOrder.supplier_outbound_message_id == outbound_message_id)
            )
        ).scalar_one_or_none()
        if matched is not None:
            return matched

    if subject:
        order_number = _ORDER_NUMBER_PATTERN.search(subject)
        if order_number:
            return (
                await db.execute(
                    select(PurchaseOrder).where(PurchaseOrder.order_number == order_number.group(0))
                )
            ).scalar_one_or_none()
        rows = list((await db.execute(select(PurchaseOrder))).scalars())
        for row in rows:
            if row.order_number and row.order_number in subject:
                return row

    return None


async def sync_purchase_order_replies(
    db: AsyncSession,
    *,
    current_user_id: int | None,
    max_messages: int = 100,
) -> MailSyncResult:
    settings = await resolve_purchase_email_settings(db)
    result = MailSyncResult(imported_document_ids=[])

    if not settings.purchase_email_imap_enabled:
        return result

    if not settings.purchase_email_imap_host.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="IMAP is enabled but PURCHASE_EMAIL_IMAP_HOST is empty",
        )

    raw_messages = await asyncio.to_thread(_fetch_imap_messages_sync, settings, max_messages=max_messages)

    now = _now()
    for raw in raw_messages:
        result.processed += 1
        message = BytesParser(policy=policy.default).parsebytes(raw)

        message_id = _normalize_message_id(message.get("Message-ID"))
        if message_id is not None:
            existing = (
                await db.execute(
                    select(PurchaseOrderEmailEvent.id).where(PurchaseOrderEmailEvent.message_id == message_id)
                )
            ).scalar_one_or_none()
            if existing is not None:
                result.skipped += 1
                continue

        in_reply_to = _normalize_message_id(message.get("In-Reply-To"))
        references_raw = " ".join(message.get_all("References", []))
        references = [_normalize_message_id(chunk) for chunk in _extract_reference_ids(references_raw)]
        references = [item for item in references if item]

        subject = str(message.get("Subject") or "").strip() or None
        from_address = parseaddr(str(message.get("From") or ""))[1] or str(message.get("From") or "")
        to_address = parseaddr(str(message.get("To") or ""))[1] or str(message.get("To") or "")

        order = await _match_order_for_reply(
            db,
            in_reply_to=in_reply_to,
            references=references,
            subject=subject,
        )
        if order is None:
            result.skipped += 1
            continue

        occurred_raw = message.get("Date")
        occurred_at = now
        if occurred_raw:
            try:
                occurred_at = parsedate_to_datetime(occurred_raw)
                if occurred_at.tzinfo is None:
                    occurred_at = occurred_at.replace(tzinfo=UTC)
                else:
                    occurred_at = occurred_at.astimezone(UTC)
            except (TypeError, ValueError):
                occurred_at = now

        file_name = f"{order.order_number}-supplier-reply-{result.processed}.eml"
        document = await _store_purchase_order_document(
            db,
            order=order,
            document_type="supplier_reply_email",
            file_name=file_name,
            mime_type="message/rfc822",
            content=raw,
            uploaded_by=current_user_id,
        )

        event = PurchaseOrderEmailEvent(
            purchase_order_id=order.id,
            direction="inbound",
            event_type="received",
            message_id=message_id,
            in_reply_to=in_reply_to,
            subject=subject,
            from_address=from_address,
            to_address=to_address,
            occurred_at=occurred_at,
            document_id=document.id,
            created_by=current_user_id,
            metadata_json={"references": references},
        )
        db.add(event)

        if order.supplier_comm_status not in {"confirmed_with_date", "confirmed_undetermined"}:
            order.supplier_comm_status = "reply_received_pending"
        order.supplier_reply_received_at = occurred_at
        order.supplier_last_sync_at = now

        result.matched += 1
        result.imported_document_ids.append(document.id)

    await db.commit()
    return result
