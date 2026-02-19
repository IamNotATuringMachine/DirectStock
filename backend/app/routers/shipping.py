import hmac
import json
from datetime import datetime
from hashlib import sha256

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_permissions
from app.models.auth import User
from app.models.inventory import GoodsIssue
from app.models.phase4 import Shipment, ShipmentEvent
from app.schemas.phase4 import (
    CarrierWebhookPayload,
    ShipmentCreate,
    ShipmentResponse,
    ShipmentTrackingResponse,
)
from app.schemas.user import MessageResponse
from app.services.carriers import get_carrier_adapter
from app.services.carriers.base import CarrierAdapterError
from app.routers.shipping_helpers import (
    _build_shipment_metadata,
    _format_dhl_express_address,
    _generate_number,
    _now,
    _resolve_customer_scope,
    _to_event_response,
    _to_shipment_response,
    _webhook_secret_for_carrier,
)
from app.routers.shipping_workflow import create_shipment_label_workflow

router = APIRouter(prefix="/api", tags=["shipping"])

READ_PERMISSION = "module.shipping.read"
WRITE_PERMISSION = "module.shipping.write"


@router.get("/shipments", response_model=list[ShipmentResponse])
async def list_shipments(
    status_filter: str | None = Query(default=None, alias="status"),
    carrier: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(READ_PERMISSION)),
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
    current_user: User = Depends(require_permissions(WRITE_PERMISSION)),
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
    _=Depends(require_permissions(READ_PERMISSION)),
) -> ShipmentResponse:
    item = (await db.execute(select(Shipment).where(Shipment.id == shipment_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shipment not found")
    return _to_shipment_response(item)


@router.post("/shipments/{shipment_id}/create-label", response_model=ShipmentResponse)
async def create_shipment_label(
    shipment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(WRITE_PERMISSION)),
) -> ShipmentResponse:
    item = await create_shipment_label_workflow(
        db=db,
        shipment_id=shipment_id,
        current_user=current_user,
    )
    return _to_shipment_response(item)


@router.get("/shipments/{shipment_id}/tracking", response_model=ShipmentTrackingResponse)
async def get_shipment_tracking(
    shipment_id: int,
    refresh: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(READ_PERMISSION)),
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
    current_user: User = Depends(require_permissions(WRITE_PERMISSION)),
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
