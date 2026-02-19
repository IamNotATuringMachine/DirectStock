import os
from datetime import UTC, datetime
from pathlib import Path
from secrets import token_hex

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.catalog import Customer, CustomerLocation
from app.models.phase4 import Shipment, ShipmentEvent
from app.schemas.phase4 import ShipmentCreate, ShipmentEventResponse, ShipmentResponse

settings = get_settings()


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
