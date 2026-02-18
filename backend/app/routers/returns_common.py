import os
from datetime import UTC, datetime
from decimal import Decimal
from io import BytesIO
from pathlib import Path
from secrets import token_hex

from fastapi import APIRouter, Depends, HTTPException, status
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_permissions
from app.models.auth import User
from app.models.catalog import Product
from app.models.inventory import Inventory, StockMovement
from app.models.phase3 import ApprovalRequest, ApprovalRule, Document, ReturnOrder, ReturnOrderItem
from app.models.warehouse import BinLocation, Warehouse, WarehouseZone
from app.schemas.phase3 import (
    ReturnOrderCreate,
    ReturnOrderExternalDispatchPayload,
    ReturnOrderExternalDispatchResponse,
    ReturnOrderExternalReceivePayload,
    ReturnOrderItemCreate,
    ReturnOrderItemResponse,
    ReturnOrderItemUpdate,
    ReturnOrderResponse,
    ReturnOrderStatusUpdate,
    ReturnOrderUpdate,
)
from app.schemas.user import MessageResponse

router = APIRouter(prefix="/api/return-orders", tags=["returns"])

# Keep phase2 read parity (incl. controller/auditor) via role-permission mapping.
RETURNS_READ_PERMISSION = "module.returns.read"
RETURNS_WRITE_PERMISSION = "module.returns.write"

TRANSITIONS: dict[str, set[str]] = {
    "registered": {"received", "cancelled"},
    "received": {"inspected", "cancelled"},
    "inspected": {"resolved", "cancelled"},
    "resolved": set(),
    "cancelled": set(),
}

EXTERNAL_REPAIR_DOCUMENT_TYPE = "external_repair_form"
EXTERNAL_WAREHOUSE_CODE = "WH-ESP-REPAIR"
EXTERNAL_WAREHOUSE_NAME = "Lager Spanien / Reparatur extern"
EXTERNAL_ZONE_CODE = "ESP-REPAIR"
EXTERNAL_ZONE_NAME = "Reparatur Extern Spanien"
EXTERNAL_BIN_CODE = "ESP-REPAIR-BIN"
EXTERNAL_BIN_QR = "DS:BIN:ESP-REPAIR-BIN"


def _now() -> datetime:
    return datetime.now(UTC)


def _generate_number() -> str:
    return f"RO-{_now().strftime('%Y%m%d%H%M%S')}-{token_hex(2).upper()}"


def _to_order_response(item: ReturnOrder) -> ReturnOrderResponse:
    return ReturnOrderResponse(
        id=item.id,
        return_number=item.return_number,
        customer_id=item.customer_id,
        goods_issue_id=item.goods_issue_id,
        status=item.status,
        source_type=item.source_type,
        source_reference=item.source_reference,
        notes=item.notes,
        registered_at=item.registered_at,
        received_at=item.received_at,
        inspected_at=item.inspected_at,
        resolved_at=item.resolved_at,
        created_by=item.created_by,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _to_item_response(item: ReturnOrderItem) -> ReturnOrderItemResponse:
    return ReturnOrderItemResponse(
        id=item.id,
        return_order_id=item.return_order_id,
        product_id=item.product_id,
        quantity=item.quantity,
        unit=item.unit,
        decision=item.decision,
        repair_mode=item.repair_mode,
        external_status=item.external_status,
        external_partner=item.external_partner,
        external_dispatched_at=item.external_dispatched_at,
        external_returned_at=item.external_returned_at,
        target_bin_id=item.target_bin_id,
        reason=item.reason,
        created_at=item.created_at,
        updated_at=item.updated_at,
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


def _build_external_repair_form_pdf(
    *, order: ReturnOrder, item: ReturnOrderItem, external_partner: str | None
) -> bytes:
    output = BytesIO()
    pdf = canvas.Canvas(output, pagesize=A4)
    page_width, page_height = A4

    pdf.setFont("Helvetica-Bold", 18)
    pdf.drawString(40, page_height - 50, "Externes Reparaturformular")
    pdf.setFont("Helvetica", 11)

    lines = [
        f"Retourennummer: {order.return_number}",
        f"Retourenposition: {item.id}",
        f"Produkt-ID: {item.product_id}",
        f"Menge: {item.quantity} {item.unit}",
        f"Externer Partner: {external_partner or 'N/A'}",
        f"Status: Wartet auf externen Dienstleister",
        f"Erstellt am (UTC): {_now().isoformat()}",
    ]
    y = page_height - 90
    for line in lines:
        pdf.drawString(40, y, line)
        y -= 18

    pdf.setFont("Helvetica", 9)
    pdf.drawString(40, 70, "DirectStock - automatisch erzeugtes Dokument")
    pdf.showPage()
    pdf.save()
    return output.getvalue()


async def _load_order_or_404(db: AsyncSession, order_id: int) -> ReturnOrder:
    item = (await db.execute(select(ReturnOrder).where(ReturnOrder.id == order_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Return order not found")
    return item


async def _load_item_or_404(db: AsyncSession, order_id: int, item_id: int) -> ReturnOrderItem:
    item = (
        await db.execute(
            select(ReturnOrderItem).where(
                ReturnOrderItem.id == item_id,
                ReturnOrderItem.return_order_id == order_id,
            )
        )
    ).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Return order item not found")
    return item


async def _ensure_bin_exists(db: AsyncSession, *, bin_id: int, detail: str = "Target bin not found") -> BinLocation:
    item = (await db.execute(select(BinLocation).where(BinLocation.id == bin_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)
    return item


def _normalize_item_repair_state(
    values: dict,
    *,
    existing: ReturnOrderItem | None = None,
) -> dict:
    decision = values.get("decision", existing.decision if existing else None)
    repair_mode = values.get("repair_mode", existing.repair_mode if existing else None)
    touches_repair_fields = any(
        key in values for key in ("decision", "repair_mode", "external_status", "external_partner")
    )

    if decision != "repair":
        if touches_repair_fields:
            values["repair_mode"] = None
            values["external_status"] = None
            values["external_partner"] = None
            values["external_dispatched_at"] = None
            values["external_returned_at"] = None
        return values

    if repair_mode not in {"internal", "external"}:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="repair_mode is required when decision is 'repair'",
        )

    if repair_mode == "internal":
        if touches_repair_fields:
            values["external_status"] = None
            values["external_partner"] = None
            values["external_dispatched_at"] = None
            values["external_returned_at"] = None
        return values

    if existing is None or touches_repair_fields:
        requested_external_status = values.get("external_status")
        if requested_external_status not in {None, "waiting_external_provider"}:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="external_status must be 'waiting_external_provider' for external repair triage",
            )
        values["external_status"] = "waiting_external_provider"
        values["external_dispatched_at"] = None
        values["external_returned_at"] = None
    return values


def _ensure_external_dispatch_prerequisites(item: ReturnOrderItem) -> None:
    if item.decision != "repair":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Return item is not marked for repair")
    if item.repair_mode != "external":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Return item is not marked for external repair",
        )
    if item.external_status != "waiting_external_provider":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Return item is not waiting for external provider dispatch",
        )


def _ensure_external_receive_prerequisites(item: ReturnOrderItem) -> None:
    if item.decision != "repair":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Return item is not marked for repair")
    if item.repair_mode != "external":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Return item is not marked for external repair",
        )
    if item.external_status != "at_external_provider":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Return item is not currently at external provider",
        )


async def _get_inventory_or_create(
    db: AsyncSession,
    *,
    product_id: int,
    bin_id: int,
    unit: str,
) -> Inventory:
    item = (
        await db.execute(
            select(Inventory).where(
                Inventory.product_id == product_id,
                Inventory.bin_location_id == bin_id,
            )
        )
    ).scalar_one_or_none()
    if item is None:
        item = Inventory(
            product_id=product_id,
            bin_location_id=bin_id,
            quantity=Decimal("0"),
            reserved_quantity=Decimal("0"),
            unit=unit,
        )
        db.add(item)
        await db.flush()
    return item


async def _ensure_spain_external_bin(db: AsyncSession) -> BinLocation:
    warehouse = (
        await db.execute(select(Warehouse).where(Warehouse.code == EXTERNAL_WAREHOUSE_CODE))
    ).scalar_one_or_none()
    if warehouse is None:
        warehouse = Warehouse(
            code=EXTERNAL_WAREHOUSE_CODE,
            name=EXTERNAL_WAREHOUSE_NAME,
            address="Virtuelles Lager fuer externe Reparaturen",
            is_active=True,
        )
        db.add(warehouse)
        await db.flush()

    zone = (
        await db.execute(
            select(WarehouseZone).where(
                WarehouseZone.warehouse_id == warehouse.id,
                WarehouseZone.code == EXTERNAL_ZONE_CODE,
            )
        )
    ).scalar_one_or_none()
    if zone is None:
        zone = WarehouseZone(
            warehouse_id=warehouse.id,
            code=EXTERNAL_ZONE_CODE,
            name=EXTERNAL_ZONE_NAME,
            zone_type="returns",
            is_active=True,
        )
        db.add(zone)
        await db.flush()

    bin_location = (
        await db.execute(
            select(BinLocation).where(
                BinLocation.zone_id == zone.id,
                BinLocation.code == EXTERNAL_BIN_CODE,
            )
        )
    ).scalar_one_or_none()
    if bin_location is None:
        bin_location = BinLocation(
            zone_id=zone.id,
            code=EXTERNAL_BIN_CODE,
            bin_type="returns",
            qr_code_data=EXTERNAL_BIN_QR,
            is_active=True,
        )
        db.add(bin_location)
        await db.flush()
    return bin_location


__all__ = [name for name in globals() if not name.startswith("__")]
