from secrets import token_hex

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auth import User
from app.models.phase3 import Document
from app.models.phase4 import Shipment, ShipmentEvent
from app.routers.shipping_helpers import _effective_storage_root, _now
from app.services.carriers import get_carrier_adapter
from app.services.carriers.base import CarrierAdapterError


async def create_shipment_label_workflow(
    *,
    db: AsyncSession,
    shipment_id: int,
    current_user: User,
) -> Shipment:
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
    return item
