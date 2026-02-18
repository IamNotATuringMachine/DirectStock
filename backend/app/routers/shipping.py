import hmac
import json
import os
from datetime import UTC, datetime
from hashlib import sha256
from pathlib import Path
from secrets import token_hex

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.dependencies import get_db, require_roles
from app.models.auth import User
from app.models.catalog import Customer, CustomerLocation
from app.models.inventory import GoodsIssue
from app.models.phase3 import Document
from app.models.phase4 import Shipment, ShipmentEvent
from app.schemas.phase4 import (
    CarrierWebhookPayload,
    ShipmentCreate,
    ShipmentEventResponse,
    ShipmentResponse,
    ShipmentTrackingResponse,
)
from app.schemas.user import MessageResponse
from app.services.carriers import get_carrier_adapter
from app.services.carriers.base import CarrierAdapterError

router = APIRouter(prefix="/api", tags=["shipping"])
settings = get_settings()

READ_ROLES = ("admin", "lagerleiter", "versand", "controller", "auditor")
WRITE_ROLES = ("admin", "lagerleiter", "versand")


def _now() -> datetime:
    return datetime.now(UTC)


def _generate_number(prefix: str) -> str:
    return f"{prefix}-{_now().strftime('%Y%m%d%H%M%S')}-{token_hex(2).upper()}"


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


def _effective_storage_root() -> Path:
    configured = Path(os.getenv("DIRECTSTOCK_DOCUMENT_STORAGE_ROOT", "/app/data/documents"))
    try:
        configured.mkdir(parents=True, exist_ok=True)
        return configured
    except OSError:
        fallback = Path.cwd() / ".documents"
        fallback.mkdir(parents=True, exist_ok=True)
        return fallback


def _to_shipment_response(item: Shipment) -> ShipmentResponse:
    return ShipmentResponse(
        id=item.id,
        shipment_number=item.shipment_number,
        carrier=item.carrier,
        status=item.status,
        goods_issue_id=item.goods_issue_id,
        customer_id=item.customer_id,
        customer_location_id=item.customer_location_id,
        tracking_number=item.tracking_number,
        recipient_name=item.recipient_name,
        shipping_address=item.shipping_address,
        label_document_id=item.label_document_id,
        created_by=item.created_by,
        shipped_at=item.shipped_at,
        cancelled_at=item.cancelled_at,
        metadata_json=item.metadata_json,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _to_event_response(item: ShipmentEvent) -> ShipmentEventResponse:
    return ShipmentEventResponse(
        id=item.id,
        shipment_id=item.shipment_id,
        event_type=item.event_type,
        status=item.status,
        description=item.description,
        event_at=item.event_at,
        source=item.source,
        payload_json=item.payload_json,
        created_by=item.created_by,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _webhook_secret_for_carrier(carrier: str) -> str:
    normalized = carrier.lower()
    if normalized == "dhl":
        return settings.dhl_webhook_secret
    if normalized == "dhl_express":
        return settings.dhl_express_webhook_secret
    if normalized == "dpd":
        return settings.dpd_webhook_secret
    if normalized == "ups":
        return settings.ups_webhook_secret
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unsupported carrier")


def _format_dhl_express_address(dhl_payload: dict[str, object]) -> str:
    line1 = str(dhl_payload.get("recipient_address_line1") or "").strip()
    line2 = str(dhl_payload.get("recipient_address_line2") or "").strip()
    postal = str(dhl_payload.get("recipient_postal_code") or "").strip()
    city = str(dhl_payload.get("recipient_city") or "").strip()
    country = str(dhl_payload.get("recipient_country_code") or "").strip().upper()
    parts = [line1]
    if line2:
        parts.append(line2)
    location = " ".join(part for part in [postal, city] if part).strip()
    if location:
        parts.append(location)
    if country:
        parts.append(country)
    return ", ".join(part for part in parts if part)


def _build_shipment_metadata(payload: ShipmentCreate) -> dict[str, object] | None:
    metadata: dict[str, object] = {}
    if payload.notes:
        metadata["notes"] = payload.notes
    if payload.dhl_express is not None:
        metadata["dhl_express"] = payload.dhl_express.model_dump(mode="json")
    return metadata or None


@router.get("/shipments", response_model=list[ShipmentResponse])
async def list_shipments(
    status_filter: str | None = Query(default=None, alias="status"),
    carrier: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*READ_ROLES)),
) -> list[ShipmentResponse]:
    stmt = select(Shipment).order_by(Shipment.id.desc())
    if status_filter:
        stmt = stmt.where(Shipment.status == status_filter)
    if carrier:
        stmt = stmt.where(Shipment.carrier == carrier.strip().lower())
    rows = list(
        (
            await db.execute(
                stmt.offset((page - 1) * page_size).limit(page_size)
            )
        ).scalars()
    )
    return [_to_shipment_response(row) for row in rows]


@router.post("/shipments", response_model=ShipmentResponse, status_code=status.HTTP_201_CREATED)
async def create_shipment(
    payload: ShipmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*WRITE_ROLES)),
) -> ShipmentResponse:
    if payload.goods_issue_id is not None:
        goods_issue = (await db.execute(select(GoodsIssue).where(GoodsIssue.id == payload.goods_issue_id))).scalar_one_or_none()
        if goods_issue is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods issue not found")

    customer_id, customer_location_id = await _resolve_customer_scope(
        db,
        customer_id=payload.customer_id,
        customer_location_id=payload.customer_location_id,
    )

    recipient_name = payload.recipient_name
    shipping_address = payload.shipping_address
    if payload.carrier == "dhl_express" and payload.dhl_express is not None:
        dhl_payload = payload.dhl_express.model_dump(mode="json")
        if not recipient_name:
            recipient_name = payload.dhl_express.recipient_contact_name
        if not shipping_address:
            shipping_address = _format_dhl_express_address(dhl_payload)

    item = Shipment(
        shipment_number=payload.shipment_number or _generate_number("SHP"),
        carrier=payload.carrier,
        status="draft",
        goods_issue_id=payload.goods_issue_id,
        customer_id=customer_id,
        customer_location_id=customer_location_id,
        recipient_name=recipient_name,
        shipping_address=shipping_address,
        created_by=current_user.id,
        metadata_json=_build_shipment_metadata(payload),
    )
    db.add(item)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Shipment already exists") from exc
    await db.refresh(item)
    return _to_shipment_response(item)


@router.get("/shipments/{shipment_id}", response_model=ShipmentResponse)
async def get_shipment(
    shipment_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*READ_ROLES)),
) -> ShipmentResponse:
    item = (await db.execute(select(Shipment).where(Shipment.id == shipment_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shipment not found")
    return _to_shipment_response(item)


@router.post("/shipments/{shipment_id}/create-label", response_model=ShipmentResponse)
async def create_shipment_label(
    shipment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*WRITE_ROLES)),
) -> ShipmentResponse:
    item = (await db.execute(select(Shipment).where(Shipment.id == shipment_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shipment not found")
    if item.status == "cancelled":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Shipment already cancelled")

    adapter = get_carrier_adapter(item.carrier)
    try:
        result = adapter.create_label(
            shipment_number=item.shipment_number,
            recipient_name=item.recipient_name,
            shipping_address=item.shipping_address,
            metadata=item.metadata_json,
        )
    except CarrierAdapterError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    max_version = (
        await db.execute(
            select(func.coalesce(func.max(Document.version), 0)).where(
                Document.entity_type == "shipment",
                Document.entity_id == item.id,
                Document.document_type == "shipping_label",
            )
        )
    ).scalar_one()
    next_version = int(max_version) + 1

    storage_dir = _effective_storage_root() / "shipment" / str(item.id) / "shipping_label"
    storage_dir.mkdir(parents=True, exist_ok=True)
    file_name = f"{item.shipment_number}-{item.carrier}.pdf"
    storage_name = f"v{next_version:03d}_{token_hex(4)}_{file_name}"
    storage_path = storage_dir / storage_name
    storage_path.write_bytes(result.label_bytes)

    document = Document(
        entity_type="shipment",
        entity_id=item.id,
        document_type="shipping_label",
        file_name=file_name,
        mime_type=result.mime_type,
        file_size=len(result.label_bytes),
        storage_path=str(storage_path),
        version=next_version,
        uploaded_by=current_user.id,
    )
    db.add(document)
    await db.flush()

    item.label_document_id = document.id
    item.tracking_number = result.tracking_number
    item.status = "label_created"
    item.shipped_at = _now()
    if result.metadata:
        metadata = dict(item.metadata_json or {})
        runtime = metadata.get("carrier_runtime")
        runtime_payload = runtime if isinstance(runtime, dict) else {}
        runtime_payload[item.carrier] = result.metadata
        metadata["carrier_runtime"] = runtime_payload
        item.metadata_json = metadata

    db.add(
        ShipmentEvent(
            shipment_id=item.id,
            event_type="label_created",
            status="label_created",
            description="Shipping label created",
            event_at=_now(),
            source="system",
            payload_json={"tracking_number": result.tracking_number, "document_id": document.id},
            created_by=current_user.id,
        )
    )

    await db.commit()
    await db.refresh(item)
    return _to_shipment_response(item)


@router.get("/shipments/{shipment_id}/tracking", response_model=ShipmentTrackingResponse)
async def get_shipment_tracking(
    shipment_id: int,
    refresh: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*READ_ROLES)),
) -> ShipmentTrackingResponse:
    item = (await db.execute(select(Shipment).where(Shipment.id == shipment_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shipment not found")

    if refresh and item.tracking_number:
        adapter = get_carrier_adapter(item.carrier)
        try:
            events = adapter.track(tracking_number=item.tracking_number)
        except CarrierAdapterError as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
        for event in events:
            event_time = datetime.fromisoformat(event.event_at_iso)
            existing = (
                await db.execute(
                    select(ShipmentEvent).where(
                        ShipmentEvent.shipment_id == item.id,
                        ShipmentEvent.event_type == event.event_type,
                        ShipmentEvent.status == event.status,
                        ShipmentEvent.event_at == event_time,
                        ShipmentEvent.source == "carrier_poll",
                    )
                )
            ).scalar_one_or_none()
            if existing is None:
                db.add(
                    ShipmentEvent(
                        shipment_id=item.id,
                        event_type=event.event_type,
                        status=event.status,
                        description=event.description,
                        event_at=event_time,
                        source="carrier_poll",
                        payload_json=None,
                    )
                )
        await db.commit()

    rows = list(
        (
            await db.execute(
                select(ShipmentEvent)
                .where(ShipmentEvent.shipment_id == item.id)
                .order_by(ShipmentEvent.event_at.desc(), ShipmentEvent.id.desc())
            )
        ).scalars()
    )
    return ShipmentTrackingResponse(shipment=_to_shipment_response(item), events=[_to_event_response(row) for row in rows])


@router.post("/shipments/{shipment_id}/cancel", response_model=MessageResponse)
async def cancel_shipment(
    shipment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*WRITE_ROLES)),
) -> MessageResponse:
    item = (await db.execute(select(Shipment).where(Shipment.id == shipment_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shipment not found")
    if item.status == "cancelled":
        return MessageResponse(message="shipment already cancelled")

    if item.tracking_number:
        adapter = get_carrier_adapter(item.carrier)
        try:
            adapter.cancel(tracking_number=item.tracking_number, metadata=item.metadata_json)
        except CarrierAdapterError as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    item.status = "cancelled"
    item.cancelled_at = _now()
    db.add(
        ShipmentEvent(
            shipment_id=item.id,
            event_type="shipment_cancelled",
            status="cancelled",
            description="Shipment cancelled",
            event_at=_now(),
            source="system",
            payload_json=None,
            created_by=current_user.id,
        )
    )
    await db.commit()
    return MessageResponse(message="shipment cancelled")


@router.post("/carriers/{carrier}/webhook", response_model=MessageResponse)
async def carrier_webhook(
    carrier: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    normalized = carrier.strip().lower()
    secret = _webhook_secret_for_carrier(normalized)
    signature = request.headers.get("X-Carrier-Signature")
    if not signature:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing signature")

    raw_body = await request.body()
    expected = hmac.new(secret.encode("utf-8"), raw_body, sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid signature")

    try:
        parsed = CarrierWebhookPayload.model_validate(json.loads(raw_body.decode("utf-8")))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid webhook payload") from exc

    shipment = (
        await db.execute(
            select(Shipment).where(Shipment.tracking_number == parsed.tracking_number, Shipment.carrier == normalized)
        )
    ).scalar_one_or_none()
    if shipment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shipment not found")

    event_time = parsed.event_at or _now()
    existing = (
        await db.execute(
            select(ShipmentEvent).where(
                ShipmentEvent.shipment_id == shipment.id,
                ShipmentEvent.event_type == parsed.event_type,
                ShipmentEvent.status == parsed.status,
                ShipmentEvent.event_at == event_time,
                ShipmentEvent.source == "webhook",
            )
        )
    ).scalar_one_or_none()
    if existing is None:
        db.add(
            ShipmentEvent(
                shipment_id=shipment.id,
                event_type=parsed.event_type,
                status=parsed.status,
                description=parsed.description,
                event_at=event_time,
                source="webhook",
                payload_json=parsed.payload,
            )
        )

    shipment.status = parsed.status
    await db.commit()
    return MessageResponse(message="webhook processed")
