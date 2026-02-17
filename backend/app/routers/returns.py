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

from app.dependencies import get_db, require_roles
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

READ_ROLES = ("admin", "lagerleiter", "versand", "controller", "auditor")
WRITE_ROLES = ("admin", "lagerleiter", "versand")

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


def _build_external_repair_form_pdf(*, order: ReturnOrder, item: ReturnOrderItem, external_partner: str | None) -> bytes:
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
    warehouse = (await db.execute(select(Warehouse).where(Warehouse.code == EXTERNAL_WAREHOUSE_CODE))).scalar_one_or_none()
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


@router.get("", response_model=list[ReturnOrderResponse])
async def list_return_orders(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*READ_ROLES)),
) -> list[ReturnOrderResponse]:
    rows = list((await db.execute(select(ReturnOrder).order_by(ReturnOrder.id.desc()))).scalars())
    return [_to_order_response(item) for item in rows]


@router.post("", response_model=ReturnOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_return_order(
    payload: ReturnOrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*WRITE_ROLES)),
) -> ReturnOrderResponse:
    order = ReturnOrder(
        return_number=payload.return_number or _generate_number(),
        customer_id=payload.customer_id,
        goods_issue_id=payload.goods_issue_id,
        status="registered",
        source_type=payload.source_type,
        source_reference=payload.source_reference,
        notes=payload.notes,
        registered_at=_now(),
        created_by=current_user.id,
    )
    db.add(order)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Return order already exists") from exc
    await db.refresh(order)
    return _to_order_response(order)


@router.get("/{order_id}", response_model=ReturnOrderResponse)
async def get_return_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*READ_ROLES)),
) -> ReturnOrderResponse:
    order = await _load_order_or_404(db, order_id)
    return _to_order_response(order)


@router.put("/{order_id}", response_model=ReturnOrderResponse)
async def update_return_order(
    order_id: int,
    payload: ReturnOrderUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*WRITE_ROLES)),
) -> ReturnOrderResponse:
    order = await _load_order_or_404(db, order_id)
    if order.status in {"resolved", "cancelled"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Return order is not editable")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(order, key, value)

    await db.commit()
    await db.refresh(order)
    return _to_order_response(order)


@router.delete("/{order_id}", response_model=MessageResponse)
async def delete_return_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*WRITE_ROLES)),
) -> MessageResponse:
    order = await _load_order_or_404(db, order_id)
    if order.status not in {"registered", "cancelled"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Return order cannot be deleted")

    await db.delete(order)
    await db.commit()
    return MessageResponse(message="return order deleted")


@router.post("/{order_id}/status", response_model=ReturnOrderResponse)
async def update_return_order_status(
    order_id: int,
    payload: ReturnOrderStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*WRITE_ROLES)),
) -> ReturnOrderResponse:
    order = await _load_order_or_404(db, order_id)
    if payload.status not in TRANSITIONS[order.status]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Invalid status transition: {order.status} -> {payload.status}",
        )

    items = list(
        (
            await db.execute(
                select(ReturnOrderItem).where(ReturnOrderItem.return_order_id == order.id)
            )
        ).scalars()
    )

    now = _now()
    if payload.status == "received":
        order.received_at = now
        for item in items:
            db.add(
                StockMovement(
                    movement_type="return_receipt",
                    reference_type="return_order",
                    reference_number=order.return_number,
                    product_id=item.product_id,
                    from_bin_id=None,
                    to_bin_id=item.target_bin_id,
                    quantity=item.quantity,
                    performed_by=current_user.id,
                    performed_at=now,
                    metadata_json={"return_order_id": order.id, "decision": item.decision},
                )
                )
    elif payload.status == "inspected":
        order.inspected_at = now
    elif payload.status == "resolved":
        if not items:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Return order has no items")

        active_rule = (
            await db.execute(
                select(ApprovalRule)
                .where(
                    ApprovalRule.entity_type == "return_order",
                    ApprovalRule.is_active.is_(True),
                )
                .order_by(ApprovalRule.id.desc())
            )
        ).scalars().first()
        if active_rule is not None:
            total_amount = sum(Decimal(item.quantity or 0) for item in items)
            threshold = Decimal(active_rule.min_amount or 0)
            if total_amount >= threshold:
                approved = (
                    await db.execute(
                        select(ApprovalRequest.id).where(
                            ApprovalRequest.entity_type == "return_order",
                            ApprovalRequest.entity_id == order.id,
                            ApprovalRequest.status == "approved",
                        )
                    )
                ).scalar_one_or_none()
                if approved is None:
                    pending = (
                        await db.execute(
                            select(ApprovalRequest.id).where(
                                ApprovalRequest.entity_type == "return_order",
                                ApprovalRequest.entity_id == order.id,
                                ApprovalRequest.status == "pending",
                            )
                        )
                    ).scalar_one_or_none()
                    if pending is None:
                        db.add(
                            ApprovalRequest(
                                entity_type="return_order",
                                entity_id=order.id,
                                status="pending",
                                amount=total_amount,
                                reason=f"Auto-created by approval rule {active_rule.id}",
                                requested_by=current_user.id,
                                requested_at=now,
                            )
                        )
                        await db.commit()
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Return order requires approval before resolving",
                    )

        for item in items:
            if item.decision == "restock":
                if item.target_bin_id is None:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Return item {item.id} requires target_bin_id for restock",
                    )

                existing = (
                    await db.execute(
                        select(Inventory).where(
                            Inventory.product_id == item.product_id,
                            Inventory.bin_location_id == item.target_bin_id,
                        )
                    )
                ).scalar_one_or_none()
                if existing is None:
                    existing = Inventory(
                        product_id=item.product_id,
                        bin_location_id=item.target_bin_id,
                        quantity=item.quantity,
                        reserved_quantity=Decimal("0"),
                        unit=item.unit,
                    )
                    db.add(existing)
                else:
                    existing.quantity = Decimal(existing.quantity) + Decimal(item.quantity)

                db.add(
                    StockMovement(
                        movement_type="return_restock",
                        reference_type="return_order",
                        reference_number=order.return_number,
                        product_id=item.product_id,
                        from_bin_id=None,
                        to_bin_id=item.target_bin_id,
                        quantity=item.quantity,
                        performed_by=current_user.id,
                        performed_at=now,
                        metadata_json={"return_order_id": order.id},
                    )
                )
            elif item.decision == "scrap":
                db.add(
                    StockMovement(
                        movement_type="return_scrap",
                        reference_type="return_order",
                        reference_number=order.return_number,
                        product_id=item.product_id,
                        from_bin_id=item.target_bin_id,
                        to_bin_id=None,
                        quantity=item.quantity,
                        performed_by=current_user.id,
                        performed_at=now,
                        metadata_json={"return_order_id": order.id, "reason": item.reason},
                    )
                )
            elif item.decision == "return_supplier":
                db.add(
                    StockMovement(
                        movement_type="return_supplier",
                        reference_type="return_order",
                        reference_number=order.return_number,
                        product_id=item.product_id,
                        from_bin_id=item.target_bin_id,
                        to_bin_id=None,
                        quantity=item.quantity,
                        performed_by=current_user.id,
                        performed_at=now,
                        metadata_json={"return_order_id": order.id, "reason": item.reason},
                    )
                )

        order.resolved_at = now

    order.status = payload.status
    await db.commit()
    await db.refresh(order)
    return _to_order_response(order)


@router.get("/{order_id}/items", response_model=list[ReturnOrderItemResponse])
async def list_return_order_items(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*READ_ROLES)),
) -> list[ReturnOrderItemResponse]:
    await _load_order_or_404(db, order_id)
    rows = list(
        (
            await db.execute(
                select(ReturnOrderItem)
                .where(ReturnOrderItem.return_order_id == order_id)
                .order_by(ReturnOrderItem.id.asc())
            )
        ).scalars()
    )
    return [_to_item_response(item) for item in rows]


@router.post("/{order_id}/items", response_model=ReturnOrderItemResponse, status_code=status.HTTP_201_CREATED)
async def create_return_order_item(
    order_id: int,
    payload: ReturnOrderItemCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*WRITE_ROLES)),
) -> ReturnOrderItemResponse:
    order = await _load_order_or_404(db, order_id)
    if order.status in {"resolved", "cancelled"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Return order is not editable")

    product = (await db.execute(select(Product).where(Product.id == payload.product_id))).scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    if payload.target_bin_id is not None:
        await _ensure_bin_exists(db, bin_id=payload.target_bin_id)

    values = _normalize_item_repair_state(payload.model_dump(), existing=None)
    item = ReturnOrderItem(return_order_id=order_id, **values)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return _to_item_response(item)


@router.put("/{order_id}/items/{item_id}", response_model=ReturnOrderItemResponse)
async def update_return_order_item(
    order_id: int,
    item_id: int,
    payload: ReturnOrderItemUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*WRITE_ROLES)),
) -> ReturnOrderItemResponse:
    order = await _load_order_or_404(db, order_id)
    if order.status in {"resolved", "cancelled"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Return order is not editable")

    item = await _load_item_or_404(db, order_id, item_id)
    updates = payload.model_dump(exclude_unset=True)

    target_bin_id = updates.get("target_bin_id")
    if target_bin_id is not None:
        await _ensure_bin_exists(db, bin_id=target_bin_id)

    updates = _normalize_item_repair_state(updates, existing=item)

    for key, value in updates.items():
        setattr(item, key, value)

    await db.commit()
    await db.refresh(item)
    return _to_item_response(item)


@router.delete("/{order_id}/items/{item_id}", response_model=MessageResponse)
async def delete_return_order_item(
    order_id: int,
    item_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*WRITE_ROLES)),
) -> MessageResponse:
    order = await _load_order_or_404(db, order_id)
    if order.status in {"resolved", "cancelled"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Return order is not editable")

    item = await _load_item_or_404(db, order_id, item_id)
    await db.delete(item)
    await db.commit()
    return MessageResponse(message="return order item deleted")


@router.post(
    "/{order_id}/items/{item_id}/dispatch-external",
    response_model=ReturnOrderExternalDispatchResponse,
)
async def dispatch_return_order_item_external(
    order_id: int,
    item_id: int,
    payload: ReturnOrderExternalDispatchPayload | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*WRITE_ROLES)),
) -> ReturnOrderExternalDispatchResponse:
    order = await _load_order_or_404(db, order_id)
    if order.status in {"resolved", "cancelled"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Return order does not allow external dispatch in current status",
        )

    item = await _load_item_or_404(db, order_id, item_id)
    _ensure_external_dispatch_prerequisites(item)

    now = _now()
    spain_bin = await _ensure_spain_external_bin(db)

    spain_inventory = await _get_inventory_or_create(
        db,
        product_id=item.product_id,
        bin_id=spain_bin.id,
        unit=item.unit,
    )
    spain_inventory.quantity = Decimal(spain_inventory.quantity) + Decimal(item.quantity)

    if payload is not None and payload.external_partner:
        item.external_partner = payload.external_partner
    item.external_status = "at_external_provider"
    item.external_dispatched_at = now

    db.add(
        StockMovement(
            movement_type="return_external_dispatch",
            reference_type="return_order",
            reference_number=order.return_number,
            product_id=item.product_id,
            from_bin_id=item.target_bin_id,
            to_bin_id=spain_bin.id,
            quantity=item.quantity,
            performed_by=current_user.id,
            performed_at=now,
            metadata_json={
                "return_order_id": order.id,
                "return_order_item_id": item.id,
                "external_partner": item.external_partner,
            },
        )
    )

    repair_form = _build_external_repair_form_pdf(
        order=order,
        item=item,
        external_partner=item.external_partner,
    )
    version = (
        await db.execute(
            select(func.coalesce(func.max(Document.version), 0)).where(
                Document.entity_type == "return_order",
                Document.entity_id == order.id,
                Document.document_type == EXTERNAL_REPAIR_DOCUMENT_TYPE,
            )
        )
    ).scalar_one()
    next_version = int(version) + 1
    storage_dir = _effective_storage_root() / "return_order" / str(order.id) / EXTERNAL_REPAIR_DOCUMENT_TYPE
    storage_dir.mkdir(parents=True, exist_ok=True)
    file_name = f"{order.return_number}-externes-reparaturformular.pdf"
    storage_path = storage_dir / f"v{next_version:03d}_{token_hex(4)}_{file_name}"
    storage_path.write_bytes(repair_form)

    document = Document(
        entity_type="return_order",
        entity_id=order.id,
        document_type=EXTERNAL_REPAIR_DOCUMENT_TYPE,
        file_name=file_name,
        mime_type="application/pdf",
        file_size=len(repair_form),
        storage_path=str(storage_path),
        version=next_version,
        uploaded_by=current_user.id,
    )
    db.add(document)

    await db.commit()
    await db.refresh(item)
    await db.refresh(document)
    return ReturnOrderExternalDispatchResponse(
        item=_to_item_response(item),
        document_id=document.id,
    )


@router.post(
    "/{order_id}/items/{item_id}/receive-external",
    response_model=ReturnOrderItemResponse,
)
async def receive_return_order_item_external(
    order_id: int,
    item_id: int,
    payload: ReturnOrderExternalReceivePayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*WRITE_ROLES)),
) -> ReturnOrderItemResponse:
    order = await _load_order_or_404(db, order_id)
    if order.status in {"resolved", "cancelled"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Return order does not allow external receive in current status",
        )

    item = await _load_item_or_404(db, order_id, item_id)
    _ensure_external_receive_prerequisites(item)

    target_bin = await _ensure_bin_exists(db, bin_id=payload.target_bin_id)
    source_bin = await _ensure_spain_external_bin(db)
    now = _now()

    spain_inventory = (
        await db.execute(
            select(Inventory).where(
                Inventory.product_id == item.product_id,
                Inventory.bin_location_id == source_bin.id,
            )
        )
    ).scalar_one_or_none()
    if spain_inventory is None or Decimal(spain_inventory.quantity) < Decimal(item.quantity):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Insufficient quantity in external provider virtual bin",
        )
    spain_inventory.quantity = Decimal(spain_inventory.quantity) - Decimal(item.quantity)

    target_inventory = await _get_inventory_or_create(
        db,
        product_id=item.product_id,
        bin_id=target_bin.id,
        unit=item.unit,
    )
    target_inventory.quantity = Decimal(target_inventory.quantity) + Decimal(item.quantity)

    db.add(
        StockMovement(
            movement_type="return_external_receive",
            reference_type="return_order",
            reference_number=order.return_number,
            product_id=item.product_id,
            from_bin_id=source_bin.id,
            to_bin_id=target_bin.id,
            quantity=item.quantity,
            performed_by=current_user.id,
            performed_at=now,
            metadata_json={
                "return_order_id": order.id,
                "return_order_item_id": item.id,
                "external_partner": item.external_partner,
            },
        )
    )

    item.target_bin_id = payload.target_bin_id
    item.external_status = "ready_for_use"
    item.external_returned_at = now

    await db.commit()
    await db.refresh(item)
    return _to_item_response(item)
